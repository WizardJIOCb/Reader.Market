import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../lib/auth';
import { readerApi } from '../lib/api';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Star, ChevronDown, ChevronUp, Trash2, User, Reply, Quote } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { ReactionBar } from './ReactionBar';
import { UserNameWithRating } from './UserNameWithRating';

interface ProfileRatingsSectionProps {
  profileId: string;
  profileUsername: string;
  isOwnProfile: boolean;
  averageRating: number | null;
  ratingCount: number;
  onRatingChange?: (newRating: number | null) => void;
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface Comment {
  id: string;
  userId: string;
  profileId: string;
  content: string;
  createdAt: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  rating: number | null;
  isOwnComment?: boolean;
  parentCommentId?: string | null;
  quotedText?: string | null;
  parentCommentAuthor?: string | null;
  reactions?: Reaction[];
  replyCount?: number;
  replies?: Comment[];
  metadata?: {
    readingProgress?: {
      percentage: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

// Recursive component for rendering nested comments
interface CommentItemProps {
  comment: Comment;
  depth: number;
  user: any;
  dateLocale: any;
  t: any;
  expandedReplies: Set<string>;
  loadingReplies: Set<string>;
  highlightedCommentId: string | null;
  replyingToId: string | null;
  replyText: string;
  quotedText: string;
  submitting: boolean;
  onToggleReplies: (commentId: string) => void;
  onReply: (comment: Comment) => void;
  onCancelReply: () => void;
  onReplyTextChange: (text: string) => void;
  onSubmitReply: () => void;
  onDelete: (commentId: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onTextSelect: (comment: Comment) => void;
  onScrollToComment: (commentId: string) => void;
  getRatingBadgeVariant: (rating: number | null) => string;
  onUpdateCommentReactions: (commentId: string, reactions: Reaction[]) => void;
}

export function CommentItem({
  comment,
  depth,
  user,
  dateLocale,
  t,
  expandedReplies,
  loadingReplies,
  highlightedCommentId,
  replyingToId,
  replyText,
  quotedText,
  submitting,
  onToggleReplies,
  onReply,
  onCancelReply,
  onReplyTextChange,
  onSubmitReply,
  onDelete,
  onReaction,
  onTextSelect,
  onScrollToComment,
  getRatingBadgeVariant,
  onUpdateCommentReactions
}: CommentItemProps) {
  const isExpanded = expandedReplies.has(comment.id);
  const isLoading = loadingReplies.has(comment.id);
  const hasReplies = (comment.replyCount && comment.replyCount > 0) || (comment.replies && comment.replies.length > 0);
  const isAuthenticated = !!user;
  const isCompact = depth > 0;
  const displayReplyCount = comment.replyCount || (comment.replies?.length || 0);
  const isHighlighted = highlightedCommentId === comment.id;
  const isReplyingToThis = replyingToId === comment.id;
  
  // Reading progress state
  // Use reading progress from API data if available, otherwise don't show it
  const [readingProgress, setReadingProgress] = useState<{percentage: number, currentPage: number, totalPages: number} | null>(comment.metadata?.readingProgress || null);
  
  // Log whether we're using metadata or not showing reading progress
  useEffect(() => {
    
    
    
    
    if (comment.metadata?.readingProgress) {
      
      setReadingProgress(comment.metadata.readingProgress);
    } else {
      
    }
  }, [comment.id, comment.metadata?.readingProgress]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (replyText.trim() && !submitting) {
        onSubmitReply();
      }
    }
  };
  
  return (
    <div 
      id={`comment-${comment.id}`}
      className={depth > 0 ? 'ml-4 border-l-2 border-muted-foreground/20 pl-3' : ''}
    >
      <div
        className={`rounded-lg transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-primary ring-offset-2 bg-primary/10' : ''
        } ${
          isCompact 
            ? (comment.isOwnComment ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : '') 
            : `border ${comment.isOwnComment ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : 'bg-card'}`
        } ${isCompact ? 'p-2.5' : 'p-4'}`}
      >
        <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <Avatar className={`flex-shrink-0 ${isCompact ? 'w-7 h-7' : 'w-10 h-10'}`}>
            {comment.avatarUrl ? (
              <AvatarImage src={comment.avatarUrl} alt={comment.username} />
            ) : null}
            <AvatarFallback>
              <User className={isCompact ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <UserNameWithRating
                  userId={comment.userId || ''}
                  username={comment.username || ''}
                  fullName={comment.fullName}
                  profileRating={null}
                  showRating={true}
                />
                
                {/* Reading progress indicator */}
                {readingProgress && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full cursor-help">
                          📖 {Math.round(readingProgress.percentage)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#fbf6f0] dark:bg-[#2a2520] border border-[#e8e0d0] dark:border-[#3a3530] text-[#2a2520] dark:text-[#fbf6f0]">
                        <div className="text-xs">
                          <div>{t('books:readingProgress.title', 'Reading progress: {{percentage}}%', { percentage: Math.round(readingProgress.percentage) })}</div>
                          <div className="mt-1 text-[#5a5550] dark:text-[#cbc6c0]">{t('books:readingProgress.pageInfo', 'Page: {{currentPage}} of {{totalPages}}', { currentPage: readingProgress.currentPage, totalPages: readingProgress.totalPages })}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {comment.parentCommentAuthor && comment.parentCommentId && (
                  <button
                    onClick={() => onScrollToComment(comment.parentCommentId!)}
                    className="text-xs text-muted-foreground flex items-center gap-0.5 hover:text-primary cursor-pointer transition-colors"
                  >
                    <Reply className="w-3 h-3" />
                    {comment.parentCommentAuthor}
                  </button>
                )}
                {comment.rating && (
                  <Badge variant={getRatingBadgeVariant(comment.rating) as any} className="text-xs h-5">
                    {comment.rating}/10
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', {
                    locale: dateLocale
                  })}
                </span>
                {(comment.isOwnComment || user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDelete(comment.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Quoted text */}
            {comment.quotedText && (
              <div className={`bg-muted/50 border-l-2 border-muted-foreground/50 pl-2 py-1 italic text-muted-foreground rounded-r ${isCompact ? 'text-xs' : 'text-sm'}`}>
                <Quote className="w-3 h-3 inline mr-1" />
                {comment.quotedText}
              </div>
            )}

            <p 
              className={`whitespace-pre-wrap ${isCompact ? 'text-sm' : 'text-sm'}`}
              onMouseUp={() => onTextSelect(comment)}
            >
              {comment.content}
            </p>

            {/* Actions row: Reply button + Reactions + Show replies */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAuthenticated && !isReplyingToThis && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onReply(comment)}
                >
                  <Reply className="w-3 h-3 mr-1" />
                  {t('profile:ratings.reply')}
                </Button>
              )}
              
              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleReplies(comment.id)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="animate-pulse">{t('profile:ratings.loadingReplies')}</span>
                  ) : isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      {t('profile:ratings.hideReplies')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      {t('profile:ratings.repliesCount', { count: displayReplyCount })}
                    </>
                  )}
                </Button>
              )}
              
              <ReactionBar
                reactions={comment.reactions || []}
                onReact={(emoji) => onReaction(comment.id, emoji)}
              />
            </div>

            {/* Inline reply input */}
            {isReplyingToThis && (
              <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
                {quotedText && (
                  <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2 py-0.5">
                    <Quote className="w-3 h-3 inline mr-1" />
                    {quotedText}
                  </div>
                )}
                <div className="relative">
                  <Textarea
                    placeholder={`${t('profile:ratings.replyPlaceholder')}...`}
                    value={replyText}
                    onChange={(e) => onReplyTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="pr-10 text-sm min-h-[50px] bg-background border-muted"
                    autoFocus
                  />
                  <div className="absolute bottom-1 right-1">
                    <EmojiPicker
                      onEmojiSelect={(emoji) => onReplyTextChange(replyText + emoji)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs text-muted-foreground mr-auto">Ctrl+Enter</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={onCancelReply}
                  >
                    {t('profile:cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs px-3"
                    onClick={onSubmitReply}
                    disabled={submitting || !replyText.trim()}
                  >
                    {t('profile:ratings.postReply')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Nested replies */}
      {isExpanded && comment.replies && comment.replies.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              user={user}
              dateLocale={dateLocale}
              t={t}
              expandedReplies={expandedReplies}
              loadingReplies={loadingReplies}
              highlightedCommentId={highlightedCommentId}
              replyingToId={replyingToId}
              replyText={replyText}
              quotedText={quotedText}
              submitting={submitting}
              onToggleReplies={onToggleReplies}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              onReaction={onReaction}
              onTextSelect={onTextSelect}
              onScrollToComment={onScrollToComment}
              getRatingBadgeVariant={getRatingBadgeVariant}
              onUpdateCommentReactions={onUpdateCommentReactions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileRatingsSection({
  profileId,
  profileUsername,
  isOwnProfile,
  averageRating,
  ratingCount,
  onRatingChange
}: ProfileRatingsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n, t } = useTranslation(['profile', 'common']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  const [isExpanded, setIsExpanded] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [userComment, setUserComment] = useState<string>('');
  const [hasUserRating, setHasUserRating] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [commentsPerPage, setCommentsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [quotedText, setQuotedText] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Fetch comment count on mount for header display
  useEffect(() => {
    fetchCommentCount();
  }, [profileId]);

  // Fetch comments when expanded or user changes
  useEffect(() => {
    if (isExpanded && !loading) {
      fetchComments();
    }
  }, [isExpanded, currentPage, commentsPerPage, user]);

  // Fetch user's existing rating and comment
  useEffect(() => {
    if (user && !isOwnProfile) {
      fetchUserRatingAndComment();
    }
  }, [user, profileId]);

  const fetchCommentCount = async () => {
    try {
      const response = await fetch(
        `/api/profile/${profileId}/comments?limit=1&offset=0`,
        {
          headers: user
            ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            : {}
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTotalComments(data.total);
      }
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

  const fetchUserRatingAndComment = async () => {
    if (!user) return;

    try {
      // Fetch user's rating
      const ratingsResponse = await fetch(`/api/profile/${profileId}/ratings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (ratingsResponse.ok) {
        const ratings = await ratingsResponse.json();
        const myRating = ratings.find((r: any) => r.userId === user.id);
        if (myRating) {
          setUserRating(myRating.rating);
          setHasUserRating(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    // Reset expanded replies when refetching - fresh data doesn't have replies loaded
    setExpandedReplies(new Set());
    try {
      const offset = (currentPage - 1) * commentsPerPage;
      const response = await fetch(
        `/api/profile/${profileId}/comments?limit=${commentsPerPage}&offset=${offset}`,
        {
          headers: user
            ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            : {}
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
        setTotalComments(data.total);
      } else {
        toast({
          title: t('profile:ratings.error'),
          description: t('profile:ratings.failedToLoadComments'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToLoadComments'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!user || !userRating) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/profile/${profileId}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: userRating })
      });

      if (response.ok) {
        setHasUserRating(true);
        toast({
          title: t('profile:ratings.success'),
          description: hasUserRating ? t('profile:ratings.ratingUpdated') : t('profile:ratings.ratingSubmitted')
        });
        
        // Refresh ratings
        if (onRatingChange) {
          onRatingChange(userRating);
        }
        
        // Refresh comments to update rating badge
        if (isExpanded) {
          fetchComments();
        }
      } else {
        const error = await response.json();
        toast({
          title: t('profile:ratings.error'),
          description: error.error || t('profile:ratings.failedToSubmitRating'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToSubmitRating'),
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !userComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/profile/${profileId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          content: userComment,
          parentCommentId: replyToComment?.id,
          quotedText: quotedText || undefined
        })
      });

      if (response.ok) {
        const newComment = await response.json();
        
        toast({
          title: t('profile:ratings.success'),
          description: t('profile:ratings.commentPosted')
        });
        
        // Add the new comment dynamically
        if (replyToComment) {
          // It's a reply - add to the parent's replies array
          const newReply: Comment = {
            id: newComment.id,
            userId: user.id,
            profileId: profileId,
            content: userComment,
            createdAt: new Date().toISOString(),
            username: user.username,
            fullName: user.fullName || null,
            avatarUrl: user.avatarUrl || null,
            rating: null,
            isOwnComment: true,
            parentCommentId: replyToComment.id,
            quotedText: quotedText || null,
            parentCommentAuthor: replyToComment.fullName || replyToComment.username,
            reactions: [],
            replyCount: 0,
            replies: []
          };
          
          // Add reply to the correct parent and increment reply count
          setComments(prevComments => 
            prevComments.map(c => addReplyToParent(c, replyToComment.id, newReply))
          );
          
          // Expand the parent so the new reply is visible
          setExpandedReplies(prev => new Set(prev).add(replyToComment.id));
        } else {
          // It's a root comment - add to the beginning of the list
          const newRootComment: Comment = {
            id: newComment.id,
            userId: user.id,
            profileId: profileId,
            content: userComment,
            createdAt: new Date().toISOString(),
            username: user.username,
            fullName: user.fullName || null,
            avatarUrl: user.avatarUrl || null,
            rating: null,
            isOwnComment: true,
            parentCommentId: null,
            quotedText: null,
            parentCommentAuthor: null,
            reactions: [],
            replyCount: 0,
            replies: []
          };
          
          setComments(prevComments => [newRootComment, ...prevComments]);
          setTotalComments(prev => prev + 1);
        }
        
        // Clear comment input and reply state
        setUserComment('');
        setReplyToComment(null);
        setQuotedText('');
      } else {
        const error = await response.json();
        toast({
          title: t('profile:ratings.error'),
          description: error.error || t('profile:ratings.failedToPostComment'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToPostComment'),
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to add a reply to a parent comment recursively
  const addReplyToParent = (comment: Comment, parentId: string, newReply: Comment): Comment => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replyCount: (comment.replyCount || 0) + 1,
        replies: [...(comment.replies || []), newReply]
      };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: comment.replies.map(reply => addReplyToParent(reply, parentId, newReply))
      };
    }
    return comment;
  };

  // Keyboard handler for Ctrl+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (userComment.trim() && !submitting) {
        handleSubmitComment();
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t('profile:ratings.deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/profile/comment/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        toast({
          title: t('profile:ratings.success'),
          description: t('profile:ratings.commentDeleted')
        });
        
        // Refresh
        fetchComments();
        fetchCommentCount();
      } else {
        toast({
          title: t('profile:ratings.error'),
          description: t('profile:ratings.failedToDeleteComment'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToDeleteComment'),
        variant: 'destructive'
      });
    }
  };

  const handleReplyClick = (comment: Comment) => {
    setReplyToComment(comment);
    setQuotedText('');
  };

  const handleCancelReply = () => {
    setReplyToComment(null);
    setQuotedText('');
  };

  const handleTextSelect = useCallback((comment: Comment) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (selectedText.length > 0 && selectedText.length <= 500) {
        setReplyToComment(comment);
        setQuotedText(selectedText);
      }
    }
  }, []);

  const handleScrollToComment = useCallback((commentId: string) => {
    const element = document.getElementById(`comment-${commentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCommentId(commentId);
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedCommentId(null);
      }, 2000);
    }
  }, []);

  const handleReaction = async (commentId: string, emoji: string) => {
    if (!user) {
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.loginToReact'),
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/profile/comment/${commentId}/reaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      });

      if (response.ok) {
        const data = await response.json();
        // Update comments with new reactions (including nested)
        updateCommentReactions(commentId, data.reactions);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  // Recursively update reactions in nested comment structure
  const updateCommentReactions = (commentId: string, reactions: Reaction[]) => {
    setComments(prevComments => 
      prevComments.map(c => updateCommentReactionsRecursive(c, commentId, reactions))
    );
  };

  const updateCommentReactionsRecursive = (comment: Comment, targetId: string, reactions: Reaction[]): Comment => {
    if (comment.id === targetId) {
      return { ...comment, reactions };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: comment.replies.map(reply => updateCommentReactionsRecursive(reply, targetId, reactions))
      };
    }
    return comment;
  };

  // Toggle replies visibility and fetch if needed
  const handleToggleReplies = async (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      // Collapse
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      // Expand - fetch replies if not already loaded
      const comment = findCommentById(comments, commentId);
      if (comment && (!comment.replies || comment.replies.length === 0)) {
        await fetchReplies(commentId);
      }
      setExpandedReplies(prev => new Set(prev).add(commentId));
    }
  };

  const findCommentById = (commentsList: Comment[], id: string): Comment | null => {
    for (const comment of commentsList) {
      if (comment.id === id) return comment;
      if (comment.replies) {
        const found = findCommentById(comment.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchReplies = async (commentId: string) => {
    setLoadingReplies(prev => new Set(prev).add(commentId));
    
    try {
      const response = await fetch(`/api/profile/comment/${commentId}/replies`, {
        headers: user
          ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
          : {}
      });

      if (response.ok) {
        const replies = await response.json();
        // Update the comment with its replies
        setComments(prevComments => 
          prevComments.map(c => addRepliesToComment(c, commentId, replies))
        );
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const addRepliesToComment = (comment: Comment, targetId: string, replies: Comment[]): Comment => {
    if (comment.id === targetId) {
      return { ...comment, replies };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: comment.replies.map(reply => addRepliesToComment(reply, targetId, replies))
      };
    }
    return comment;
  };

  const totalPages = Math.ceil(totalComments / commentsPerPage);
  const isAuthenticated = !!user;
  const canComment = isAuthenticated;
  const canRate = isAuthenticated && !isOwnProfile;

  const getRatingBadgeVariant = (rating: number | null) => {
    if (!rating) return 'secondary';
    if (rating >= 8) return 'default';
    if (rating >= 5) return 'secondary';
    return 'destructive';
  };

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">{t('profile:ratings.title')}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({totalComments} {totalComments === 1 ? t('profile:ratings.comment') : t('profile:ratings.comments')})
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Rating and Comment Input */}
          {isAuthenticated && (
            <div className="space-y-4 border-b pb-6">
              {/* Star Rating Input - only for other profiles */}
              {canRate && (
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-medium">{t('profile:ratings.yourRatingFor', { name: profileUsername })}</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="transition-transform hover:scale-110"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setUserRating(star)}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            (hoverRating !== null && star <= hoverRating) ||
                            (hoverRating === null && userRating !== null && star <= userRating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-medium">
                      {hoverRating || userRating || 0}/10
                    </span>
                  </div>
                  {userRating && (
                    <Button
                      onClick={handleSubmitRating}
                      disabled={submitting}
                      size="sm"
                    >
                      {hasUserRating ? t('profile:ratings.updateRating') : t('profile:ratings.submitRating')}
                    </Button>
                  )}
                </div>
              )}

              {/* Comment Input - available for all authenticated users, only for new root comments */}
              {canComment && !replyToComment && (
                <div className="space-y-2 mt-4">
                  <div className="relative">
                    <Textarea
                      placeholder={`${t('profile:ratings.yourComment')}...`}
                      value={userComment}
                      onChange={(e) => setUserComment(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={3}
                      className="pr-12"
                    />
                    <div className="absolute bottom-2 right-2">
                      <EmojiPicker
                        onEmojiSelect={(emoji) => setUserComment(prev => prev + emoji)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSubmitComment}
                      disabled={submitting || !userComment.trim()}
                      size="sm"
                    >
                      {t('profile:ratings.postComment')}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Ctrl+Enter
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('profile:ratings.loadingComments')}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('profile:ratings.noComments')}
              </div>
            ) : (
              <>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    depth={0}
                    user={user}
                    dateLocale={dateLocale}
                    t={t}
                    expandedReplies={expandedReplies}
                    loadingReplies={loadingReplies}
                    highlightedCommentId={highlightedCommentId}
                    replyingToId={replyToComment?.id || null}
                    replyText={userComment}
                    quotedText={quotedText}
                    submitting={submitting}
                    onToggleReplies={handleToggleReplies}
                    onReply={handleReplyClick}
                    onCancelReply={handleCancelReply}
                    onReplyTextChange={setUserComment}
                    onSubmitReply={handleSubmitComment}
                    onDelete={handleDeleteComment}
                    onReaction={handleReaction}
                    onTextSelect={handleTextSelect}
                    onScrollToComment={handleScrollToComment}
                    getRatingBadgeVariant={getRatingBadgeVariant}
                    onUpdateCommentReactions={updateCommentReactions}
                  />
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      <Select
                        value={commentsPerPage.toString()}
                        onValueChange={(value) => {
                          setCommentsPerPage(parseInt(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="10">10 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="20">20 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="50">50 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="100">100 {t('profile:ratings.perPage')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {t('profile:ratings.previous')}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {t('profile:ratings.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
