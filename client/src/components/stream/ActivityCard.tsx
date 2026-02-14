import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Newspaper, BookOpen, MessageCircle, Star, Trash2, Edit, Reply } from "lucide-react";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { ReactionBar } from "@/components/ReactionBar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { AttachmentButton } from "@/components/AttachmentButton";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { useAuth } from "@/lib/auth";
import { Send, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

// Recursive component for rendering nested replies
interface ReplyItemProps {
  reply: any;
  depth: number;
  expandedReplies: Set<string>;
  loadingNestedReplies: Set<string>;
  nestedRepliesMap: Record<string, any[]>;
  onToggleNested: (replyId: string) => void;
  onReact: (emoji: string, commentId?: string) => void;
  currentUserId?: string;
  onReply?: (replyId: string) => void;
  onStartReply?: (replyOrCommentId: any) => void; // NEW: handler for starting reply
  // Inline reply form props
  replyingToCommentId?: string | null;
  replyContent?: string;
  onReplyContentChange?: (content: string) => void;
  onSubmitReply?: () => void;
  onCancelReply?: () => void;
  isSubmittingReply?: boolean;
  // Attachment props
  attachmentFiles?: File[];
  onAttachmentFilesChange?: (files: File[]) => void;
  // NEW: State setters for nested replies to show reply form
  setReplyingToCommentId?: (id: string | null) => void;
  setShowReplyForm?: (show: boolean) => void;
  setReplyContent?: (content: string) => void;
}

function ReplyItem({ reply, depth, expandedReplies, loadingNestedReplies, nestedRepliesMap, onToggleNested, onReact, currentUserId, onReply, onStartReply, replyingToCommentId, replyContent, onReplyContentChange, onSubmitReply, onCancelReply, isSubmittingReply, attachmentFiles, onAttachmentFilesChange, setReplyingToCommentId, setShowReplyForm, setReplyContent }: ReplyItemProps) {
  const { t, i18n } = useTranslation(['stream', 'common', 'profile']);
  const isExpanded = expandedReplies.has(reply.id);
  const isLoading = loadingNestedReplies.has(reply.id);
  // Combine both sources: lazy-loaded from API (nestedRepliesMap) and real-time from WebSocket (reply.replies)
  // Deduplicate by ID to prevent same reply appearing twice
  const allReplies = [...(nestedRepliesMap[reply.id] || []), ...(reply.replies || [])];
  const uniqueRepliesMap = new Map();
  allReplies.forEach((r: any) => {
    if (!uniqueRepliesMap.has(r.id)) {
      uniqueRepliesMap.set(r.id, r);
    }
  });
  const nestedReplies = Array.from(uniqueRepliesMap.values());
  const hasNestedReplies = (reply.replyCount > 0) || (reply.replies && reply.replies.length > 0) || (nestedReplies.length > 0);
  const isOwnReply = currentUserId && reply.userId === currentUserId;
  const isCompact = depth > 0;
  const isReplyingToThis = replyingToCommentId === (reply.id || reply.entityId);
  if (replyingToCommentId) {
    console.log('[ReplyItem] isReplyingToThis check:', replyingToCommentId, '===', reply.id, '||', reply.entityId, '=', isReplyingToThis, 'content:', reply.content);
  }
  if (isReplyingToThis) {
    console.log('[ReplyItem] Showing form for reply.id:', reply.id, 'reply.content:', reply.content);
  }
  
  return (
    <div className={depth > 0 ? 'ml-4 border-l-2 border-muted-foreground/20 pl-3' : ''}>
      <div className={`rounded-lg transition-all duration-500 ${isOwnReply ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : ''}`}>
        <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-3'} ${isCompact ? 'p-2.5' : 'p-3'}`}>
          <Avatar className={`flex-shrink-0 ${isCompact ? 'w-7 h-7' : 'w-8 h-8'}`}>
            {reply.avatarUrl || reply.author_avatar ? (
              <AvatarImage src={reply.avatarUrl || reply.author_avatar} alt={reply.author_name || reply.author || reply.username} />
            ) : null}
            <AvatarFallback className={isCompact ? 'text-xs' : 'text-sm'}>
              {(reply.author_name || reply.author || reply.username || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-medium ${isCompact ? 'text-sm' : 'text-sm'}`}>{reply.author_name || reply.author || reply.username || 'User'}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {reply.createdAt ? formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: i18n.language === 'ru' ? ru : enUS }) : ''}
              </span>
            </div>
            
            {/* Quoted text if present */}
            {reply.quotedText && (
              <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2 py-0.5">
                <Reply className="w-3 h-3 inline mr-1" />
                {reply.quotedText}
              </div>
            )}
            
            <p className="text-sm">{reply.content_preview || reply.content}</p>
            
            {/* Actions row: Reply + Show replies + Reactions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Reply button */}
              {currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (onStartReply) {
                      onStartReply(reply);
                    } else if (onReply) {
                      onReply(reply);
                    }
                  }}
                >
                  <Reply className="w-3 h-3 mr-1" />
                  {t('stream:reply')}
                </Button>
              )}
              
              {hasNestedReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onToggleNested(reply.id);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      {t('stream:hideReplies')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      {t('stream:showReplies', { count: reply.replyCount || nestedReplies.length || 0 })}
                    </>
                  )}
                </Button>
              )}
              <ReactionBar
                reactions={reply.reactions || []}
                onReact={onReact}
                commentId={reply.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline reply form - show BEFORE nested replies */}
      {isReplyingToThis && (
        <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
          <div className="relative">
            <Textarea
              placeholder={t('stream:writeReply')}
              value={replyContent || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onReplyContentChange && onReplyContentChange(e.target.value)}
              className="pr-10 text-sm min-h-[50px] bg-background border-muted"
              rows={2}
              disabled={isSubmittingReply}
            />
            <div className="absolute bottom-1 right-1 flex gap-1">
              <EmojiPicker
                onEmojiSelect={(emoji) => onReplyContentChange && onReplyContentChange((replyContent || '') + emoji)}
              />
              <AttachmentButton
                onFilesSelected={(files) => onAttachmentFilesChange && onAttachmentFilesChange(files)}
                maxFiles={5}
              />
            </div>
          </div>
          {attachmentFiles && attachmentFiles.length > 0 && (
            <AttachmentPreview
              files={attachmentFiles}
              onRemove={(index) => {
                const newFiles = attachmentFiles.filter((_, i) => i !== index);
                onAttachmentFilesChange && onAttachmentFilesChange(newFiles);
              }}
              onUploadComplete={(files) => {
                // Handle uploaded files - would need to pass to parent
              }}
              autoUpload={true}
              entityType="comment"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelReply}
              disabled={isSubmittingReply}
              className="h-7"
            >
              {t('stream:cancel')}
            </Button>
            <Button
              size="sm"
              onClick={onSubmitReply}
              disabled={!replyContent?.trim() || isSubmittingReply}
              className="h-7"
            >
              <Send className="w-3 h-3 mr-1" />
              {isSubmittingReply ? t('stream:sending') : t('stream:send')}
            </Button>
          </div>
        </div>
      )}
      
      {/* Recursively render nested replies */}
      {isExpanded && nestedReplies.length > 0 && (
        <div className="mt-1 space-y-0">
          {nestedReplies.map((nestedReply: any, index: number) => (
            <ReplyItem
              key={nestedReply.id || index}
              reply={nestedReply}
              depth={depth + 1}
              expandedReplies={expandedReplies}
              loadingNestedReplies={loadingNestedReplies}
              nestedRepliesMap={nestedRepliesMap}
              onToggleNested={onToggleNested}
              onReact={onReact}
              currentUserId={currentUserId}
              // Use inline handler to directly set local state (show form)
              onReply={(reply: any) => {
                const commentId = typeof reply === 'object' ? (reply.entityId || reply.id) : reply;
                console.log('[ActivityCard] nested reply onReply, commentId:', commentId);
                setReplyingToCommentId?.(commentId);
                setShowReplyForm?.(true);
                setReplyContent?.('');
              }}
              replyingToCommentId={replyingToCommentId}
              replyContent={replyContent}
              onReplyContentChange={onReplyContentChange}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              isSubmittingReply={isSubmittingReply}
              attachmentFiles={attachmentFiles}
              onAttachmentFilesChange={onAttachmentFilesChange}
              setReplyingToCommentId={setReplyingToCommentId}
              setShowReplyForm={setShowReplyForm}
              setReplyContent={setReplyContent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Activity {
  id: string;
  type: 'news' | 'book' | 'comment' | 'review';
  entityId: string;
  userId: string;
  targetUserId?: string;
  newsId?: string;
  bookId?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface ActivityCardProps {
  activity: Activity;
  onReply?: (reply: any) => void;
  onStartReply?: (replyOrCommentId: any) => void;
}

export function ActivityCard({ activity, onReply, onStartReply }: ActivityCardProps) {
  const { t, i18n } = useTranslation(['stream']);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  
  // Reply form state
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  
  // onStartReply from parent (StreamPage) should call our local handleStartReply
  // We use useEffect to set this up properly
  
  // Wrapper for onReply that calls both local handleStartReply and parent onReply prop
  const handleNestedReply = (reply: any) => {
    console.log('[ActivityCard] handleNestedReply called, content:', reply?.content);
    // Call local handleStartReply to show form in this ActivityCard
    const commentId = typeof reply === 'object' ? (reply.entityId || reply.id) : reply;
    setReplyingToCommentId(commentId);
    setShowReplyForm(true);
    setReplyContent('');
    // Also call parent onReply if provided
    if (onReply) {
      onReply(reply);
    }
  };
  const [replyAttachmentFiles, setReplyAttachmentFiles] = useState<Record<string, File[]>>({});
  const [replyUploadedFiles, setReplyUploadedFiles] = useState<Record<string, { url: string; name: string; type: string }[]>>({});
  const [showReplies, setShowReplies] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [loadedReplies, setLoadedReplies] = useState<any[]>(activity.metadata?.replies || []);
  // Track which replies have their nested replies expanded
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  // Track loading state for nested replies
  const [loadingNestedReplies, setLoadingNestedReplies] = useState<Set<string>>(new Set());
  // Store nested replies: parentId -> array of replies
  const [nestedRepliesMap, setNestedRepliesMap] = useState<Record<string, any[]>>({});
  
  // Local state for reactions to enable immediate UI updates
  const [localReactions, setLocalReactions] = useState(activity.metadata?.reactions || []);
  
  // Sync local state when activity prop changes (from WebSocket updates)
  // Use JSON.stringify for deep comparison of reactions array
  const [lastSyncedReactions, setLastSyncedReactions] = useState<string>('');
  
  // Sync loadedReplies when activity.metadata.replies changes (from StreamPage updates)
  const [lastSyncedReplies, setLastSyncedReplies] = useState<string>('');
  useEffect(() => {
    const metadataReplies = activity.metadata?.replies || [];
    
    const currentRepliesStr = JSON.stringify(metadataReplies);
    if (currentRepliesStr !== lastSyncedReplies) {
      // Always sync with metadata replies - this is the source of truth for WebSocket updates
      setLoadedReplies(metadataReplies);
      // Auto-show replies when new replies are added via WebSocket
      if (metadataReplies.length > 0 && !showReplies) {
        setShowReplies(true);
      }
      setLastSyncedReplies(currentRepliesStr);
    }
  }, [activity.metadata?.replies, activity.id, lastSyncedReplies, showReplies]);
  
  useEffect(() => {
    const currentReactionsStr = JSON.stringify(activity.metadata?.reactions || []);
    if (currentReactionsStr !== lastSyncedReactions) {
      setLocalReactions(activity.metadata?.reactions || []);
      setLastSyncedReactions(currentReactionsStr);
    }
  }, [activity.metadata?.reactions, activity.id, lastSyncedReactions]);
  
  // Listen for comment reaction updates via WebSocket
  useEffect(() => {
    if (activity.type !== 'comment') return;
    
    const socket = getSocket();
    if (!socket) return;
    
    // Listen for both 'stream:reaction-update' and 'comment-reaction-updated' events
    const handleReactionUpdate = (data: { commentId: string; entityId?: string; entityType?: string; reactions: any[] }) => {
      const commentId = data.commentId || data.entityId;
      
      // Check if this update is for the root comment or any of its replies
      if (commentId === activity.entityId) {
        // Update root comment reactions
        setLocalReactions(data.reactions);
      }
      
      // Check if this update is for any loaded reply
      setLoadedReplies(prev => prev.map(r => 
        r.id === commentId ? { ...r, reactions: data.reactions } : r
      ));
      
      // Also check nested replies embedded in loadedReplies
      setLoadedReplies(prev => prev.map((r: any) => ({
        ...r,
        replies: (r.replies || []).map((nr: any) => 
          nr.id === commentId ? { ...nr, reactions: data.reactions } : nr
        )
      })));
      
      // Check if this update is for any nested reply in nestedRepliesMap
      setNestedRepliesMap(prev => {
        const updated: Record<string, any[]> = {};
        Object.keys(prev).forEach(key => {
          updated[key] = prev[key].map(r => 
            r.id === commentId ? { ...r, reactions: data.reactions } : r
          );
        });
        return updated;
      });
    };
    
    socket.on('stream:reaction-update', handleReactionUpdate);
    socket.on('comment-reaction-updated', handleReactionUpdate);
    
    return () => {
      socket.off('stream:reaction-update', handleReactionUpdate);
      socket.off('comment-reaction-updated', handleReactionUpdate);
    };
  }, [activity.type, activity.entityId]);
  
  // Listen for new comment activities (replies) via WebSocket
  useEffect(() => {
    if (activity.type !== 'comment') return;
    
    const socket = getSocket();
    if (!socket) return;
    
    const handleNewActivity = (newActivity: any) => {
      if (newActivity.type !== 'comment') return;
      
      const isReply = newActivity.metadata?.parentCommentId;
      if (!isReply) return;
      
      const parentCommentId = newActivity.metadata.parentCommentId;
      
      // Check if this is a reply to the root comment (current activity)
      if (parentCommentId === activity.entityId) {
        // Add the new reply to loadedReplies - copy metadata fields to top level for compatibility
        setLoadedReplies(prev => {
          // Check if already exists in direct replies
          if (prev.some(r => r.id === newActivity.id)) {
            return prev;
          }
          
          // Flatten metadata fields to top level for UI compatibility
          const flattenedReply = {
            ...newActivity,
            content: newActivity.metadata?.content || newActivity.content,
            content_preview: newActivity.metadata?.content_preview || newActivity.content_preview,
            author_name: newActivity.metadata?.author_name || newActivity.author_name,
            authorId: newActivity.metadata?.authorId || newActivity.authorId,
            userId: newActivity.userId,
            parentCommentId: newActivity.metadata?.parentCommentId,
            avatarUrl: newActivity.metadata?.author_avatar || newActivity.author_avatar,
            username: newActivity.metadata?.username || newActivity.username
          };
          
          return [...prev, flattenedReply];
        });
        
        // Show replies section
        setShowReplies(true);
        return;
      }
      
      // Check if this is a reply to one of the loaded replies (nested reply)
      setLoadedReplies(prev => {
        // Helper function to recursively find and update nested reply
        const findAndUpdateNestedReply = (replies: any[], targetId: string, newReply: any): any[] => {
          for (let i = 0; i < replies.length; i++) {
            const reply = replies[i];
            // Check BOTH id and entityId for the parent
            const replyId = reply.entityId || reply.id;
            if (replyId === targetId) {
              // Found the parent - add nested reply
              const existingReplies = reply.replies || [];
              if (existingReplies.some((nr: any) => nr.id === newReply.id)) {
                return replies;
              }
              return [
                ...replies.slice(0, i),
                { ...reply, replies: [...existingReplies, newReply] },
                ...replies.slice(i + 1)
              ];
            }
            // Check nested replies
            if (reply.replies && reply.replies.length > 0) {
              const updated = findAndUpdateNestedReply(reply.replies, targetId, newReply);
              if (updated !== replies) {
                return [
                  ...replies.slice(0, i),
                  { ...reply, replies: updated },
                  ...replies.slice(i + 1)
                ];
              }
            }
          }
          return replies; // Not found
        };
        
        // First check if parent is in direct replies
        for (const reply of prev) {
          if (reply.id === parentCommentId) {
            // This is a nested reply - add to parent reply's replies
            const existingReplies = reply.replies || [];
            if (existingReplies.some((nr: any) => nr.id === newActivity.id)) {
              return prev;
            }
            // Flatten metadata fields
            const flattenedReply = {
              ...newActivity,
              content: newActivity.metadata?.content || newActivity.content,
              content_preview: newActivity.metadata?.content_preview || newActivity.content_preview,
              author_name: newActivity.metadata?.username || newActivity.metadata?.author_name || newActivity.author_name || newActivity.username,
              authorId: newActivity.metadata?.authorId || newActivity.authorId,
              userId: newActivity.userId,
              parentCommentId: newActivity.metadata?.parentCommentId,
              avatarUrl: newActivity.metadata?.author_avatar || newActivity.author_avatar,
              username: newActivity.metadata?.username || newActivity.username
            };
            return prev.map(r => {
              if (r.id === parentCommentId) {
                return {
                  ...r,
                  replies: [...existingReplies, flattenedReply]
                };
              }
              return r;
            });
          }
        }
        // Parent not found in direct replies - use recursive search in nested replies
        const updatedReplies = findAndUpdateNestedReply(prev, parentCommentId, {
          ...newActivity,
          content: newActivity.metadata?.content || newActivity.content,
          content_preview: newActivity.metadata?.content_preview || newActivity.content_preview,
          author_name: newActivity.metadata?.username || newActivity.metadata?.author_name || newActivity.author_name || newActivity.username,
          authorId: newActivity.metadata?.authorId || newActivity.authorId,
          userId: newActivity.userId,
          parentCommentId: newActivity.metadata?.parentCommentId
        });
        
        if (updatedReplies !== prev) {
          return updatedReplies;
        }
        
        // Parent not found in loaded replies - check if parent is the root comment (activity.entityId)
        if (parentCommentId === activity.entityId) {
          // This is a reply to root - add to top-level replies
          if (prev.some(r => r.id === newActivity.id)) {
            return prev;
          }
          // Flatten metadata fields
          const flattenedReply = {
            ...newActivity,
            content: newActivity.metadata?.content || newActivity.content,
            content_preview: newActivity.metadata?.content_preview || newActivity.content_preview,
            author_name: newActivity.metadata?.username || newActivity.metadata?.author_name || newActivity.author_name || newActivity.username,
            authorId: newActivity.metadata?.authorId || newActivity.authorId,
            userId: newActivity.userId,
            parentCommentId: newActivity.metadata?.parentCommentId,
            avatarUrl: newActivity.metadata?.author_avatar || newActivity.author_avatar,
            username: newActivity.metadata?.username || newActivity.username
          };
          return [...prev, flattenedReply];
        }
        // Parent not found anywhere - add as top-level reply anyway
        // Flatten metadata fields
        const flattenedReply = {
          ...newActivity,
          content: newActivity.metadata?.content || newActivity.content,
          content_preview: newActivity.metadata?.content_preview || newActivity.content_preview,
          author_name: newActivity.metadata?.username || newActivity.metadata?.author_name || newActivity.author_name || newActivity.username,
          authorId: newActivity.metadata?.authorId || newActivity.authorId,
          userId: newActivity.userId,
          parentCommentId: newActivity.metadata?.parentCommentId,
          avatarUrl: newActivity.metadata?.author_avatar || newActivity.author_avatar,
          username: newActivity.metadata?.username || newActivity.username
        };
        return [...prev, flattenedReply];
      });
    };
    
    socket.on('stream:new-activity', handleNewActivity);
    
    return () => {
      socket.off('stream:new-activity', handleNewActivity);
    };
  }, [activity.type, activity.entityId]);
  
  // Debug logging for news comments
  if (activity.type === 'comment') {
    
  }
  
  // Get date-fns locale based on current language
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Check if admin/moder
  const isAdminOrModer = currentUser?.accessLevel === 'admin' || currentUser?.accessLevel === 'moder';

  // Delete activity mutation with optimistic updates
  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiCall(`/api/stream/activities/${activityId}`, {
        method: 'DELETE'
      });
    },
    onMutate: async (activityId: string) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'global'] });
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'personal'] });
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'shelves'] });
      
      // Snapshot the previous values for rollback
      const previousGlobal = queryClient.getQueryData<Activity[]>(['api', 'stream', 'global']);
      const previousPersonal = queryClient.getQueryData<Activity[]>(['api', 'stream', 'personal']);
      const previousShelves = queryClient.getQueriesData({ queryKey: ['api', 'stream', 'shelves'] });
      
      // Optimistically remove the activity from all caches
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (old = []) => {
        return old.filter(a => a.id !== activityId);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (old = []) => {
        return old.filter(a => a.id !== activityId);
      });
      
      // Update all shelf query variations
      queryClient.setQueriesData<Activity[]>({ queryKey: ['api', 'stream', 'shelves'] }, (old) => {
        // old might be undefined for queries that don't exist yet
        if (!old || !Array.isArray(old)) {
          return old;
        }
        return old.filter(a => a.id !== activityId);
      });
      
      // Return context with snapshots for potential rollback
      return { previousGlobal, previousPersonal, previousShelves };
    },
    onSuccess: () => {
      toast({
        title: t('stream:activityDeleted'),
        description: t('stream:activityDeletedDescription')
      });
    },
    onError: (error: any, entityId, context) => {
      // Rollback to the previous state on error
      if (context?.previousGlobal) {
        queryClient.setQueryData(['api', 'stream', 'global'], context.previousGlobal);
      }
      if (context?.previousPersonal) {
        queryClient.setQueryData(['api', 'stream', 'personal'], context.previousPersonal);
      }
      if (context?.previousShelves) {
        context.previousShelves.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast({
        title: t('stream:error'),
        description: error.message || t('stream:deleteError'),
        variant: 'destructive'
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'shelves'] });
    }
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteActivityMutation.mutateAsync(activity.id);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle reaction on activity items
  const handleReact = async (emoji: string, commentId?: string) => {
    if (isReacting || !currentUser) {
      return;
    }
    
    setIsReacting(true);
    try {
      let endpoint = '';
      let body: any = { emoji };
      
      // Use commentId if provided (for replies), otherwise use activity.entityId
      const targetId = commentId || activity.entityId;
      
      // Determine the correct endpoint and body based on activity type
      if (activity.type === 'news') {
        endpoint = `/api/news/${activity.entityId}/reactions`;
      } else if (activity.type === 'comment') {
        endpoint = `/api/comments/${targetId}/reaction`;
      } else if (activity.type === 'review') {
        endpoint = `/api/reviews/${activity.entityId}/reaction`;
      } else if (activity.type === 'book') {
        endpoint = `/api/books/${activity.bookId}/reactions`;
      } else {
        return;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ActivityCard] Failed to add reaction:', errorText);
        throw new Error('Failed to add reaction');
      }
      
      // Parse response and update local reactions immediately
      try {
        const data = await response.json();
        if (data.reactions) {
          // Force immediate update with new reference
          const newReactions = [...data.reactions];
          
          // If this is a reaction to a reply, update the reply's reactions
          if (commentId) {
            // Check if it's a direct reply (in loadedReplies)
            setLoadedReplies(prev => prev.map(r => 
              r.id === commentId ? { ...r, reactions: newReactions } : r
            ));
            // Also update nested replies that might be embedded in loadedReplies[i].replies
            setLoadedReplies(prev => prev.map((r: any) => ({
              ...r,
              replies: (r.replies || []).map((nr: any) => 
                nr.id === commentId ? { ...nr, reactions: newReactions } : nr
              )
            })));
            // Check if it's a nested reply (in nestedRepliesMap)
            setNestedRepliesMap(prev => {
              const updated: Record<string, any[]> = {};
              Object.keys(prev).forEach(key => {
                updated[key] = prev[key].map(r => 
                  r.id === commentId ? { ...r, reactions: newReactions } : r
                );
              });
              return updated;
            });
          } else {
            // This is a reaction to the root comment
            setLocalReactions(newReactions);
          }
          
          // Also update React Query cache directly for global stream
          // Only update root comment reactions if we're not reacting to a reply
          if (!commentId) {
            queryClient.setQueryData<any[]>(['api', 'stream', 'global'], (old) => {
              if (!old || !Array.isArray(old)) return old;
              return old.map(act => {
                if (act.id === activity.id || act.entityId === activity.entityId) {
                  return {
                    ...act,
                    metadata: {
                      ...act.metadata,
                      reactions: newReactions
                    }
                  };
                }
                return act;
              });
            });
            
            // Update personal stream cache
            queryClient.setQueryData<any[]>(['api', 'stream', 'personal'], (old) => {
              if (!old || !Array.isArray(old)) return old;
              return old.map(act => {
                if (act.id === activity.id || act.entityId === activity.entityId) {
                  return {
                    ...act,
                    metadata: {
                      ...act.metadata,
                      reactions: newReactions
                    }
                  };
                }
                return act;
              });
            });
          }
        }
      } catch (parseError) {
        console.error('[ActivityCard] Failed to parse reaction response:', parseError);
      }
      
      // The WebSocket will handle updating the UI via stream:reaction-update event
      // But we can also optimistically update the local state
      toast({
        title: t('stream:reactionAdded'),
        description: t('stream:reactionAddedDescription'),
      });
    } catch (error: any) {
      console.error('[ActivityCard] Error adding reaction:', error);
      toast({
        title: t('stream:error'),
        description: error.message || t('stream:reactionError'),
        variant: 'destructive'
      });
    } finally {
      setIsReacting(false);
    }
  };

  // Handle reply submission
  const handleReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    
    setIsSubmittingReply(true);
    try {
      // Use replyingToCommentId if set, otherwise use root comment entityId
      const parentCommentId = replyingToCommentId || activity.entityId;
      
      const response = await fetch(`/api/books/${activity.bookId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          content: replyContent,
          parentCommentId
        })
      });
      
      if (response.ok) {
        const newReply = await response.json();
        setReplyContent('');
        setShowReplyForm(false);
        setReplyingToCommentId(null);
        
        // Add new reply to the correct place and show replies
        // Check if replying to root comment (activity.entityId) or to a nested reply
        const isReplyToRoot = replyingToCommentId === activity.entityId;
        
        if (replyingToCommentId && !isReplyToRoot) {
          // It's a reply to another reply (nested) - add to nestedRepliesMap
          // Check for duplicates first
          const existingReplies = nestedRepliesMap[replyingToCommentId] || [];
          if (!existingReplies.some((r: any) => r.id === newReply.id)) {
            setNestedRepliesMap(prev => ({
              ...prev,
              [replyingToCommentId]: [...(prev[replyingToCommentId] || []), newReply]
            }));
            // Expand the parent reply to show the new reply
            setExpandedReplies(prev => new Set([...Array.from(prev), replyingToCommentId]));
          }
        } else {
          // It's a reply to the root comment
          // Check for duplicates first
          if (!loadedReplies.some((r: any) => r.id === newReply.id)) {
            setLoadedReplies(prev => [...prev, newReply]);
          }
          // Show the replies section
          setShowReplies(true);
        }
        
        toast({
          title: t('stream:replyAdded'),
          description: t('stream:replyAddedDescription')
        });
      } else {
        throw new Error('Failed to post reply');
      }
    } catch (error: any) {
      console.error('[ActivityCard] Error posting reply:', error);
      toast({
        title: t('stream:error'),
        description: error.message || t('stream:replyError'),
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Handler to start replying to a specific comment (root or reply)
  const handleStartReply = (replyOrCommentId: any) => {
    // Use entityId (comment ID) FIRST, then fallback to id (activity ID)
    const commentId = typeof replyOrCommentId === 'object' 
      ? (replyOrCommentId.entityId || replyOrCommentId.id) 
      : replyOrCommentId;
    console.log('[ActivityCard] handleStartReply, FULL OBJECT:', JSON.stringify({id: replyOrCommentId?.id, entityId: replyOrCommentId?.entityId, content: replyOrCommentId?.content}));
    console.log('[ActivityCard] handleStartReply, commentId:', commentId);
    setReplyingToCommentId(commentId);
    setShowReplyForm(true);
    setReplyContent('');
  };

  // Handler for attachment changes
  const handleReplyAttachmentChange = (commentId: string, files: File[]) => {
    setReplyAttachmentFiles(prev => ({ ...prev, [commentId]: files }));
  };

  // Load replies on demand
  const loadReplies = async () => {
    if (loadedReplies.length > 0) {
      setShowReplies(!showReplies);
      return;
    }
    
    setIsLoadingReplies(true);
    try {
      const response = await fetch(`/api/comments/${activity.entityId}/replies`);
      if (response.ok) {
        const replies = await response.json();
        setLoadedReplies(replies);
        setShowReplies(true);
      }
    } catch (error) {
      console.error('[ActivityCard] Error loading replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  // Toggle nested replies for a specific reply
  const toggleNestedReplies = async (replyId: string) => {
    const isExpanded = expandedReplies.has(replyId);
    
    if (isExpanded) {
      // Collapse
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(replyId);
        return next;
      });
    } else {
      // Check if we already have nested replies loaded
      if (nestedRepliesMap[replyId]) {
        setExpandedReplies(prev => new Set(prev).add(replyId));
        return;
      }
      
      // Load nested replies
      setLoadingNestedReplies(prev => new Set(prev).add(replyId));
      try {
        const response = await fetch(`/api/comments/${replyId}/replies`);
        if (response.ok) {
          const nestedReplies = await response.json();
          setNestedRepliesMap(prev => ({ ...prev, [replyId]: nestedReplies }));
          setExpandedReplies(prev => new Set(prev).add(replyId));
        }
      } catch (error) {
        console.error('[ActivityCard] Error loading nested replies:', error);
      } finally {
        setLoadingNestedReplies(prev => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
    }
  };

  // Get icon based on activity type
  const getActivityIcon = () => {
    switch (activity.type) {
      case 'news':
        return <Newspaper className="w-5 h-5 text-blue-500" />;
      case 'book':
        return <BookOpen className="w-5 h-5 text-green-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-purple-500" />;
      case 'review':
        return <Star className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Render activity content based on type
  const renderActivityContent = () => {
    const { metadata } = activity;

    switch (activity.type) {
      case 'news':
        return (
          <div>
            <Link href={`/news/${activity.entityId}`}>
              <h3 className="font-semibold text-lg hover:underline cursor-pointer">
                {metadata.title}
              </h3>
            </Link>
            {metadata.content_preview && (
              <p className="text-sm text-muted-foreground mt-1">
                {metadata.content_preview}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>👁️ {metadata.view_count || 0}</span>
              <span>💬 {metadata.comment_count || 0}</span>
              <span>❤️ {metadata.reaction_count || 0}</span>
            </div>
            {/* Interactive reaction bar */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ReactionBar 
                reactions={localReactions} 
                onReact={handleReact}
                newsId={activity.entityId}
              />
            </div>
          </div>
        );

      case 'book':
        return (
          <div className="flex gap-4">
            {(metadata.videoCoverUrl || metadata.cover_url) ? (
              metadata.videoCoverUrl ? (
                <Link href={`/book/${activity.bookId}`}>
                  <div className="relative w-20 h-28 flex-shrink-0 cursor-pointer">
                    {/* Placeholder image shown initially */}
                    {metadata.cover_url && (
                      <img 
                        src={metadata.cover_url}
                        alt={metadata.title}
                        className="w-20 h-28 object-cover rounded-md shadow-sm absolute inset-0"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    {/* Video cover loaded behind the image */}
                    <video
                      src={metadata.videoCoverUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-20 h-28 object-cover rounded-md shadow-sm"
                      onError={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                        const target = e.target as HTMLVideoElement;
                        target.style.display = 'none';
                      }}
                      onLoadedData={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                        const videoElement = e.target as HTMLVideoElement;
                        const parentDiv = videoElement.parentElement;
                        if (parentDiv) {
                          const imgElements = parentDiv.querySelectorAll('img');
                          imgElements.forEach(img => img.style.display = 'none');
                        }
                      }}
                    />
                  </div>
                </Link>
              ) : (
                <Link href={`/book/${activity.bookId}`}>
                  <img 
                    src={metadata.cover_url} 
                    alt={metadata.title}
                    className="w-20 h-28 object-cover rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0"
                  />
                </Link>
              )
            ) : (
              <div className="w-20 h-28 bg-muted rounded-md flex-shrink-0 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <Link href={`/book/${activity.bookId}`}>
                <h3 className="font-semibold text-lg hover:underline cursor-pointer">
                  {metadata.title}
                </h3>
              </Link>
              {metadata.author && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('stream:author')}: {metadata.author}
                </p>
              )}
              {metadata.genre && (
                <p className="text-xs text-muted-foreground mt-1">
                  {metadata.genre}
                </p>
              )}
              {/* Stats row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {metadata.average_rating && (
                  <span className="font-medium">⭐ {metadata.average_rating}/10</span>
                )}
                <span>❤️ {metadata.reaction_count || 0}</span>
                <span>💬 {metadata.comment_count || 0}</span>
                <span>📝 {metadata.review_count || 0}</span>
              </div>
              {/* Interactive reaction bar */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <ReactionBar 
                  reactions={metadata.reactions || []} 
                  onReact={handleReact}
                  bookId={activity.bookId}
                />
              </div>
            </div>
          </div>
        );

      case 'comment':
        const replyCount = metadata.reply_count || metadata.replies?.length || 0;
        const hasReplies = replyCount > 0 || (metadata.replies && metadata.replies.length > 0);
        const isReplyTo = metadata.parentCommentId;
        
        return (
          <div>
            {/* Reply indicator */}
            {isReplyTo && (
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <span className="text-lg leading-none">←</span>
                {t('stream:replyTo') || 'Reply to'}
              </div>
            )}
            <p className="text-sm whitespace-pre-line">{metadata.content_preview}</p>
            
            {/* Actions row: Reply + Show replies + Reactions */}
            <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
              {/* Reply button */}
              {currentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setReplyingToCommentId(activity.entityId); setShowReplyForm(true); }}
                >
                  <Reply className="w-3 h-3 mr-1" />
                  {t('stream:reply') || 'Reply'}
                </Button>
              )}
              
              {/* Show replies button */}
              {replyCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={loadReplies}
                  disabled={isLoadingReplies}
                >
                  {isLoadingReplies ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : showReplies ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      {t('stream:hideReplies') || 'Hide replies'}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      {t('stream:showReplies', { count: replyCount }) || `${replyCount} replies`}
                    </>
                  )}
                </Button>
              )}
              
              {/* Reaction bar */}
              <ReactionBar 
                reactions={metadata.reactions || []} 
                onReact={handleReact}
                commentId={activity.entityId}
              />
            </div>
            
            {/* Inline reply form for root comment - only show when replying to root */}
            {showReplyForm && replyingToCommentId === activity.entityId && replyingToCommentId && (
              <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
                <div className="relative">
                  <Textarea
                    placeholder={t('stream:writeReply')}
                    value={replyContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                    className="pr-10 text-sm min-h-[50px] bg-background border-muted"
                    rows={2}
                    disabled={isSubmittingReply}
                  />
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <EmojiPicker
                      onEmojiSelect={(emoji) => setReplyContent(replyContent + emoji)}
                    />
                    <AttachmentButton
                      onFilesSelected={(files) => handleReplyAttachmentChange(activity.entityId, files)}
                      maxFiles={5}
                    />
                  </div>
                </div>
                {replyAttachmentFiles[activity.entityId] && replyAttachmentFiles[activity.entityId].length > 0 && (
                  <AttachmentPreview
                    files={replyAttachmentFiles[activity.entityId]}
                    onRemove={(index) => {
                      const newFiles = replyAttachmentFiles[activity.entityId].filter((_, i) => i !== index);
                      setReplyAttachmentFiles(prev => ({ ...prev, [activity.entityId]: newFiles }));
                    }}
                    onUploadComplete={(files) => {}}
                    autoUpload={true}
                    entityType="comment"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowReplyForm(false); setReplyContent(''); setReplyingToCommentId(null); }}
                    disabled={isSubmittingReply}
                    className="h-7"
                  >
                    {t('stream:cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={!replyContent.trim() || isSubmittingReply}
                    className="h-7"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {isSubmittingReply ? t('stream:sending') : t('stream:send')}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Nested replies */}
            {showReplies && loadedReplies && loadedReplies.length > 0 && (
              <div className="mt-3 space-y-0">
                {loadedReplies.map((reply: any, index: number) => (
                  <ReplyItem 
                    key={reply.id || index} 
                    reply={reply} 
                    depth={0}
                    expandedReplies={expandedReplies}
                    loadingNestedReplies={loadingNestedReplies}
                    nestedRepliesMap={nestedRepliesMap}
                    onToggleNested={toggleNestedReplies}
                    onReact={handleReact}
                    currentUserId={currentUser?.id}
                    onReply={() => handleStartReply(reply)}
                    replyingToCommentId={replyingToCommentId}
                    replyContent={replyContent}
                    onReplyContentChange={setReplyContent}
                    onSubmitReply={handleReply}
                    onCancelReply={() => { setReplyingToCommentId(null); setShowReplyForm(false); setReplyContent(''); }}
                    isSubmittingReply={isSubmittingReply}
                    attachmentFiles={replyingToCommentId === (reply.entityId || reply.id) ? replyAttachmentFiles[reply.id] : undefined}
                    onAttachmentFilesChange={(files) => handleReplyAttachmentChange(reply.id, files)}
                    setReplyingToCommentId={setReplyingToCommentId}
                    setShowReplyForm={setShowReplyForm}
                    setReplyContent={setReplyContent}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {metadata.rating && (
                <div className="flex items-center">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold ml-1">{metadata.rating}/10</span>
                </div>
              )}
            </div>
            <p className="text-sm whitespace-pre-line">{metadata.content_preview}</p>
            {/* Interactive reaction bar */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ReactionBar 
                reactions={metadata.reactions || []} 
                onReact={handleReact}
                reviewId={activity.entityId}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Format date display based on how long ago it was
  const activityDate = new Date(activity.createdAt);
  const isValidDate = !isNaN(activityDate.getTime());
  const hoursSinceCreated = isValidDate ? differenceInHours(new Date(), activityDate) : 0;
  const showFullDate = hoursSinceCreated >= 24;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              {getActivityIcon()}
              <span className="text-sm font-medium">
                {t(`stream:activityTypes.${activity.type}`)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isValidDate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">
                      {showFullDate 
                        ? format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })
                        : formatDistanceToNow(activityDate, { addSuffix: true, locale: dateLocale })
                      }
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!isValidDate && (
              <span className="text-xs text-muted-foreground">Invalid date</span>
            )}
            {isAdminOrModer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-6 w-6 min-h-6 p-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {/* User info section */}
        {activity.metadata && (activity.metadata.author_name || activity.metadata.uploader_name) && (
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="w-8 h-8">
              {/* For book activities, use uploader_avatar; for others use author_avatar */}
              {(activity.type === 'book' ? activity.metadata.uploader_avatar : (activity.metadata.author_avatar || activity.metadata.uploader_avatar)) && (
                <AvatarImage 
                  src={activity.type === 'book' ? activity.metadata.uploader_avatar : (activity.metadata.author_avatar || activity.metadata.uploader_avatar)} 
                  alt={activity.metadata.author_name || activity.metadata.uploader_name} 
                />
              )}
              <AvatarFallback>
                {(activity.metadata.author_name || activity.metadata.uploader_name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Link href={`/profile/${activity.userId}`}>
              <span className="text-sm hover:underline cursor-pointer">
                {/* For book activities, show uploader name; for others show author name */}
                {activity.type === 'book' ? (activity.metadata.uploader_name || activity.metadata.author_name) : (activity.metadata.author_name || activity.metadata.uploader_name)}
              </span>
            </Link>
            {/* Show uploader rating for book activities */}
            {activity.type === 'book' && activity.metadata.uploader_rating && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  ⭐ {activity.metadata.uploader_rating}/10
                </span>
              </>
            )}
            {/* Context for comments and reviews */}
            {/* News title for news comments */}
            {activity.type === 'comment' && activity.metadata.news_title && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link href={`/news/${activity.metadata.news_id}`}>
                  <span className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                    {activity.metadata.news_title}
                  </span>
                </Link>
              </>
            )}
            {/* Book title for book comments and reviews (only if no news_title) */}
            {(activity.type === 'comment' || activity.type === 'review') && !activity.metadata.news_title && activity.metadata.book_title && activity.metadata.book_title !== 'Unknown' && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link href={`/book/${activity.metadata.book_id}`}>
                  <span className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                    {activity.metadata.book_title}
                  </span>
                </Link>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className={activity.type === 'comment' && currentUser && activity.userId === currentUser.id ? 'bg-[#fbf6f0] dark:bg-[#2a2520] rounded-lg' : ''}>
        {renderActivityContent()}
      </CardContent>
    </Card>
  );
}
