import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { dataCache, getCachedComments, setCachedComments, getPendingRequest, trackPendingRequest, isCachedDataStale } from '@/lib/dataCache';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentDisplay } from '@/components/AttachmentDisplay';
import { fileUploadManager, type UploadedFile } from '@/lib/fileUploadManager';

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface Attachment {
  url: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

interface Comment {
  id: string;
  bookId: string;
  author: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  userId?: string;
  avatarUrl?: string | null;
  attachments?: Attachment[];
}

interface CommentsProps {
  bookId: string;
  onCommentsCountChange?: (count: number) => void;
}

export function CommentsSection({ bookId, onCommentsCountChange }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['books', 'common']);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Get date-fns locale based on current language
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Fetch comments when component mounts or bookId changes
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/books/${bookId}/comments`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const fetchedComments = await response.json();
          setComments(fetchedComments);
          // Cache the fetched data
          setCachedComments(bookId, fetchedComments);
          // Notify parent component of comment count change
          if (onCommentsCountChange) {
            onCommentsCountChange(fetchedComments.length);
          }
          return fetchedComments;
        }
        throw new Error('Failed to fetch comments');
      } catch (error) {
        console.error('Failed to fetch comments:', error);
        // Even on error, notify parent with 0 count
        if (onCommentsCountChange) {
          onCommentsCountChange(0);
        }
        throw error;
      } finally {
        setLoading(false);
      }
    };

    // Check if we have cached data for this book
    const cachedCommentsEntry = dataCache.comments[bookId];
    if (cachedCommentsEntry) {
      setComments(cachedCommentsEntry.data);
      if (onCommentsCountChange) {
        onCommentsCountChange(cachedCommentsEntry.data.length);
      }
      setLoading(false);
      // Only fetch fresh data in background if the cached data is stale
      if (bookId && isCachedDataStale(cachedCommentsEntry.timestamp)) {
        fetchComments().catch(() => {}); // Don't block UI on background refresh
      }
      return;
    }

    // Check if there's already a pending request for this book
    const pendingRequest = getPendingRequest('comments', bookId);
    if (pendingRequest) {
      // Wait for the pending request to complete
      pendingRequest.then((fetchedComments) => {
        setComments(fetchedComments);
        if (onCommentsCountChange) {
          onCommentsCountChange(fetchedComments.length);
        }
        setLoading(false);
      }).catch(() => {
        if (onCommentsCountChange) {
          onCommentsCountChange(0);
        }
        setLoading(false);
      });
      return;
    }

    if (bookId) {
      // Track this request to prevent duplicates
      const trackedRequest = trackPendingRequest('comments', bookId, fetchComments());
      trackedRequest.catch(() => {}); // Prevent unhandled promise rejection
    }
  }, [bookId, onCommentsCountChange]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;
    
    try {
      const response = await fetch(`/api/books/${bookId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          content: newComment,
          attachments: uploadedFiles.map(f => f.uploadId)
        })
      });
      
      if (response.ok) {
        const newCommentObj = await response.json();
        
        // Format the comment to match our frontend interface
        const formattedComment: Comment = {
          id: newCommentObj.id,
          bookId: newCommentObj.bookId,
          author: newCommentObj.author || user.fullName || user.username || 'Вы',
          content: newCommentObj.content,
          createdAt: newCommentObj.createdAt,
          reactions: [],
          userId: newCommentObj.userId || user.id,
          avatarUrl: newCommentObj.avatarUrl || user.avatarUrl || null,
          attachments: newCommentObj.attachmentMetadata?.attachments || []
        };
        
        // Optimistically add the new comment to the beginning of the list
        const updatedComments = [formattedComment, ...comments];
        setComments(updatedComments);
        setNewComment('');
        setAttachmentFiles([]);
        setUploadedFiles([]);
        
        // Update cache with new comment
        setCachedComments(bookId, updatedComments);
        
        // Notify parent component of comment count change
        if (onCommentsCountChange) {
          onCommentsCountChange(updatedComments.length);
        }
      } else {
        console.error('Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleReact = async (commentId: string, emoji: string) => {
    // Since reactions are handled on the server, we need to:
    // 1. Optimistically update the UI
    // 2. Refetch the comments to get the accurate reaction counts from the server
    
    // Optimistically update the UI for immediate feedback
    const updatedComments = comments.map(comment => {
      if (comment.id !== commentId) return comment;

      const existingReactionIndex = comment.reactions.findIndex(r => r.emoji === emoji);
      let newReactions = [...comment.reactions];

      if (existingReactionIndex >= 0) {
        const reaction = newReactions[existingReactionIndex];
        // Toggle the userReacted flag for the current user
        newReactions[existingReactionIndex] = {
          ...reaction,
          userReacted: !reaction.userReacted,
          count: reaction.userReacted ? reaction.count - 1 : reaction.count + 1
        };
        
        // Remove reaction if count becomes 0
        if (newReactions[existingReactionIndex].count === 0) {
          newReactions.splice(existingReactionIndex, 1);
        }
      } else {
        // Add new reaction
        newReactions.push({
          emoji,
          count: 1,
          userReacted: true
        });
      }

      return { ...comment, reactions: newReactions };
    });

    setComments(updatedComments);
    
    // Update cache with the updated comments
    setCachedComments(bookId, updatedComments);
    
    // Now refetch the comments to get accurate data from the server
    try {
      const response = await fetch(`/api/books/${bookId}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const fetchedComments = await response.json();
        setComments(fetchedComments);
        
        // Update cache with fresh data
        setCachedComments(bookId, fetchedComments);
      }
    } catch (error) {
      console.error('Failed to refresh comments after reaction:', error);
      // Revert to previous state if refresh fails
      setComments(comments);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      // Use admin endpoint if user is admin or moderator
      const endpoint = (user.accessLevel === 'admin' || user.accessLevel === 'moder') 
        ? `/api/admin/comments/${commentId}`
        : `/api/comments/${commentId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        // Remove the comment from the state
        const updatedComments = comments.filter(comment => comment.id !== commentId);
        setComments(updatedComments);
        // Update cache
        setCachedComments(bookId, updatedComments);
        // Notify parent component of comment count change
        if (onCommentsCountChange) {
          onCommentsCountChange(updatedComments.length);
        }
      } else {
        console.error('Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Avatar>
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.fullName || user.username} />
          ) : null}
          <AvatarFallback>Вы</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder={t('books:commentPlaceholder')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          {attachmentFiles.length > 0 && (
            <AttachmentPreview
              files={attachmentFiles}
              onRemove={(index) => {
                setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
                setUploadedFiles(prev => prev.filter((_, i) => i !== index));
              }}
              onUploadComplete={(files) => setUploadedFiles(files)}
              autoUpload={true}
            />
          )}
          <div className="flex justify-between items-center">
            <div className="flex gap-1">
              <EmojiPicker onEmojiSelect={(emoji) => setNewComment(prev => prev + emoji)} />
              <AttachmentButton 
                onFilesSelected={(files) => setAttachmentFiles(prev => [...prev, ...files])}
                maxFiles={5}
              />
            </div>
            <Button 
              onClick={handlePostComment} 
              disabled={!newComment.trim() || !user || (attachmentFiles.length > 0 && uploadedFiles.length !== attachmentFiles.length)} 
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {t('books:send')}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-8">
            <p>{t('common:loading')}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('books:noComments', 'Пока нет комментариев. Будьте первым!')}</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Avatar className="w-10 h-10 border">
                {comment.avatarUrl ? (
                  <AvatarImage src={comment.avatarUrl} alt={comment.author} />
                ) : null}
                <AvatarFallback>{comment.author[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2 relative">
                {user && (comment.userId === user.id || user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
                  <button 
                    onClick={() => handleDeleteComment(comment.id)}
                    className="absolute top-0 right-0 text-muted-foreground hover:text-destructive transition-colors"
                    title={t('books:delete')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="flex items-center gap-2 mb-1">
                  {comment.userId ? (
                    <a
                      href={`/profile/${comment.userId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm text-primary hover:underline"
                    >
                      {comment.author}
                    </a>
                  ) : (
                    <span className="font-semibold text-sm">{comment.author}</span>
                  )}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
                {comment.attachments && comment.attachments.length > 0 && (
                  <AttachmentDisplay attachments={comment.attachments} className="mt-2" />
                )}
                <ReactionBar 
                  reactions={comment.reactions} 
                  onReact={(emoji) => handleReact(comment.id, emoji)} 
                  commentId={comment.id}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
