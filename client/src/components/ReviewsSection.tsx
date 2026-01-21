import React, { useState, useEffect, useCallback } from 'react';
import { Book, UseBookReturn } from '@/hooks/useBooks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Star, X, Reply, ChevronDown, ChevronUp, Quote, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { dataCache, getCachedReviews, setCachedReviews, getPendingRequest, trackPendingRequest, isCachedDataStale } from '@/lib/dataCache';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentDisplay } from '@/components/AttachmentDisplay';
import { type UploadedFile } from '@/lib/fileUploadManager';
import { AuthPrompt } from '@/components/AuthPrompt';

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

interface Review {
  id: string;
  bookId: string;
  author: string;
  username?: string;
  content: string;
  rating: number | null;
  userBookRating?: number | null; // User's rating from their root review
  createdAt: string;
  reactions: Reaction[];
  userId: string;
  avatarUrl?: string | null;
  attachments?: Attachment[];
  isOwnReview?: boolean;
  parentReviewId?: string | null;
  quotedText?: string | null;
  parentReviewAuthor?: string | null;
  replyCount?: number;
  replies?: Review[];
}

interface ReviewsProps {
  bookId: string;
  onReviewsCountChange?: (count: number) => void;
  onBookRatingChange?: (newRating: number | null) => void;
  onBookDataChange?: () => void;
}

// Recursive component for rendering nested reviews
interface ReviewItemProps {
  review: Review;
  depth: number;
  user: any;
  dateLocale: any;
  t: any;
  expandedReplies: Set<string>;
  loadingReplies: Set<string>;
  highlightedReviewId: string | null;
  replyingToId: string | null;
  replyText: string;
  quotedText: string;
  submitting: boolean;
  onToggleReplies: (reviewId: string) => void;
  onReply: (review: Review) => void;
  onCancelReply: () => void;
  onReplyTextChange: (text: string) => void;
  onSubmitReply: () => void;
  onDelete: (reviewId: string) => void;
  onReaction: (reviewId: string, emoji: string) => void;
  onTextSelect: (review: Review) => void;
  onScrollToReview: (reviewId: string) => void;
  getRatingColor: (rating: number) => string;
}

function ReviewItem({
  review,
  depth,
  user,
  dateLocale,
  t,
  expandedReplies,
  loadingReplies,
  highlightedReviewId,
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
  onScrollToReview,
  getRatingColor
}: ReviewItemProps) {
  const isExpanded = expandedReplies.has(review.id);
  const isLoading = loadingReplies.has(review.id);
  const hasReplies = (review.replyCount && review.replyCount > 0) || (review.replies && review.replies.length > 0);
  const isAuthenticated = !!user;
  const isCompact = depth > 0;
  const displayReplyCount = review.replyCount || (review.replies?.length || 0);
  const isHighlighted = highlightedReviewId === review.id;
  const isReplyingToThis = replyingToId === review.id;
  const isOwnReview = user && review.userId === user.id;

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
      id={`review-${review.id}`}
      className={depth > 0 ? 'ml-4 border-l-2 border-muted-foreground/20 pl-3' : ''}
    >
      <div
        className={`rounded-lg transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-primary ring-offset-2 bg-primary/10' : ''
        } ${
          isCompact 
            ? (isOwnReview ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : '') 
            : `border ${isOwnReview ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : 'bg-card'}`
        } ${isCompact ? 'p-2.5' : 'p-4'}`}
      >
        <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <Avatar className={`flex-shrink-0 ${isCompact ? 'w-7 h-7' : 'w-10 h-10'}`}>
            {review.avatarUrl ? (
              <AvatarImage src={review.avatarUrl} alt={review.author} />
            ) : null}
            <AvatarFallback className={isCompact ? 'text-xs' : ''}>
              {review.author ? review.author.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {review.userId ? (
                  <a
                    href={`/profile/${review.username || review.userId}`}
                    className={`font-medium hover:underline ${isCompact ? 'text-sm' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {review.author}
                  </a>
                ) : (
                  <span className={`font-medium ${isCompact ? 'text-sm' : ''}`}>{review.author}</span>
                )}
                {review.parentReviewAuthor && review.parentReviewId && (
                  <button
                    onClick={() => onScrollToReview(review.parentReviewId!)}
                    className="text-xs text-muted-foreground flex items-center gap-0.5 hover:text-primary cursor-pointer transition-colors"
                  >
                    <Reply className="w-3 h-3" />
                    {review.parentReviewAuthor}
                  </button>
                )}
                {/* Rating badge - show review rating or user's book rating for replies */}
                {(review.rating || review.userBookRating) && (
                  <Badge variant="outline" className={`${isCompact ? 'text-xs px-1.5 py-0' : 'text-sm px-2 py-0.5'} font-bold ${getRatingColor(review.rating || review.userBookRating)}`}>
                    {review.rating || review.userBookRating}/10
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(review.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(isOwnReview || user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDelete(review.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Quoted text */}
            {review.quotedText && (
              <div className={`bg-muted/50 border-l-2 border-muted-foreground/50 pl-2 py-1 italic text-muted-foreground rounded-r ${isCompact ? 'text-xs' : 'text-sm'}`}>
                <Quote className="w-3 h-3 inline mr-1" />
                {review.quotedText}
              </div>
            )}

            <p 
              className={`whitespace-pre-wrap ${isCompact ? 'text-sm' : 'text-sm'}`}
              onMouseUp={() => onTextSelect(review)}
            >
              {review.content}
            </p>

            {/* Attachments */}
            {review.attachments && review.attachments.length > 0 && (
              <AttachmentDisplay attachments={review.attachments} className="mt-2" />
            )}

            {/* Actions row: Reply button + Reactions + Show replies */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAuthenticated && !isReplyingToThis && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onReply(review)}
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
                  onClick={() => onToggleReplies(review.id)}
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
                reactions={review.reactions || []}
                onReact={(emoji) => onReaction(review.id, emoji)}
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
      {isExpanded && review.replies && review.replies.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {review.replies.map((reply) => (
            <ReviewItem
              key={reply.id}
              review={reply}
              depth={depth + 1}
              user={user}
              dateLocale={dateLocale}
              t={t}
              expandedReplies={expandedReplies}
              loadingReplies={loadingReplies}
              highlightedReviewId={highlightedReviewId}
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
              onScrollToReview={onScrollToReview}
              getRatingColor={getRatingColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewsSection({ bookId, onReviewsCountChange, onBookRatingChange, onBookDataChange }: ReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReviewContent, setNewReviewContent] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const { t, i18n } = useTranslation(['books', 'common', 'profile']);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [replyToReview, setReplyToReview] = useState<Review | null>(null);
  const [quotedText, setQuotedText] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  const getRatingColor = (rating: number | null | undefined) => {
    if (!rating) return 'bg-muted text-muted-foreground border-muted';
    if (rating >= 8) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (rating >= 5) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  };

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setExpandedReplies(new Set());
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/books/${bookId}/reviews`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (response.ok) {
        const fetchedReviews = await response.json();
        setReviews(fetchedReviews);
        setCachedReviews(bookId, fetchedReviews);
        
        // Find and set the user's review from the fetched reviews
        if (user) {
          const foundUserReview = fetchedReviews.find((review: any) => review.userId === user.id && !review.parentReviewId);
          setUserReview(foundUserReview || null);
        }
        
        if (onReviewsCountChange) {
          onReviewsCountChange(fetchedReviews.length);
        }
        return fetchedReviews;
      }
      throw new Error('Failed to fetch reviews');
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      if (onReviewsCountChange) {
        onReviewsCountChange(0);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [bookId, user, onReviewsCountChange]);

  useEffect(() => {
    const cachedReviewsEntry = dataCache.reviews[bookId];
    if (cachedReviewsEntry) {
      setReviews(cachedReviewsEntry.data);
      
      if (user) {
        const foundUserReview = cachedReviewsEntry.data.find((review: any) => review.userId === user.id && !review.parentReviewId);
        setUserReview(foundUserReview || null);
      }
      
      if (onReviewsCountChange) {
        onReviewsCountChange(cachedReviewsEntry.data.length);
      }
      setLoading(false);
      if (bookId && isCachedDataStale(cachedReviewsEntry.timestamp)) {
        fetchReviews().catch(() => {});
      }
      return;
    }

    const pendingRequest = getPendingRequest('reviews', bookId);
    if (pendingRequest) {
      pendingRequest.then((fetchedReviews) => {
        setReviews(fetchedReviews);
        if (user) {
          const foundUserReview = fetchedReviews.find((review: any) => review.userId === user.id && !review.parentReviewId);
          setUserReview(foundUserReview || null);
        }
        if (onReviewsCountChange) {
          onReviewsCountChange(fetchedReviews.length);
        }
        setLoading(false);
      }).catch(() => {
        if (onReviewsCountChange) {
          onReviewsCountChange(0);
        }
        setLoading(false);
      });
      return;
    }

    if (bookId) {
      const trackedRequest = trackPendingRequest('reviews', bookId, fetchReviews());
      trackedRequest.catch(() => {});
    }
  }, [bookId, user, onReviewsCountChange, fetchReviews]);

  const handlePostReview = async () => {
    if (!newReviewContent.trim() || !user) return;
    // Only validate rating for root reviews, not for replies
    if (!replyToReview && (newRating < 1 || newRating > 10)) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/books/${bookId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          rating: replyToReview ? null : newRating, 
          content: newReviewContent,
          attachments: uploadedFiles.map(f => f.uploadId),
          parentReviewId: replyToReview?.id || null,
          quotedText: quotedText || null
        })
      });
      
      if (response.ok) {
        const newReviewObj = await response.json();
        
        if (replyToReview) {
          // It's a reply - add to parent's replies array
          const newReply: Review = {
            id: newReviewObj.id,
            bookId: newReviewObj.bookId,
            author: newReviewObj.author || user.fullName || user.username || 'You',
            username: newReviewObj.username || user.username,
            content: newReviewObj.content,
            rating: newReviewObj.rating,
            userBookRating: userReview?.rating || null, // User's rating from their root review
            createdAt: new Date().toISOString(),
            reactions: [],
            userId: user.id,
            avatarUrl: user.avatarUrl || null,
            isOwnReview: true,
            parentReviewId: replyToReview.id,
            quotedText: quotedText || null,
            parentReviewAuthor: replyToReview.author,
            replyCount: 0,
            replies: [],
            attachments: newReviewObj.attachmentMetadata?.attachments || []
          };
          
          setReviews(prevReviews => 
            prevReviews.map(r => addReplyToParent(r, replyToReview.id, newReply))
          );
          
          // Also update userReview if we're replying to user's own review or nested reply
          if (userReview) {
            setUserReview(prev => prev ? addReplyToParent(prev, replyToReview.id, newReply) : null);
          }
          
          setExpandedReplies(prev => new Set(prev).add(replyToReview.id));
        } else {
          // Root review
          const formattedReview: Review = {
            id: newReviewObj.id,
            bookId: newReviewObj.bookId,
            author: newReviewObj.author || user.fullName || user.username || 'You',
            username: newReviewObj.username || user.username,
            content: newReviewObj.content,
            rating: newReviewObj.rating,
            createdAt: new Date().toISOString(),
            reactions: [],
            userId: user.id,
            avatarUrl: user.avatarUrl || null,
            isOwnReview: true,
            parentReviewId: null,
            quotedText: null,
            parentReviewAuthor: null,
            replyCount: 0,
            replies: [],
            attachments: newReviewObj.attachmentMetadata?.attachments || []
          };
          
          const updatedReviews = [formattedReview, ...reviews];
          setReviews(updatedReviews);
          setUserReview(formattedReview);
          setCachedReviews(bookId, updatedReviews);
          
          if (onReviewsCountChange) {
            onReviewsCountChange(updatedReviews.length);
          }
          
          // Calculate and send the new average rating
          if (onBookRatingChange) {
            const totalRating = updatedReviews.reduce((sum, review) => sum + review.rating, 0);
            const newAverageRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : null;
            onBookRatingChange(newAverageRating);
          }
        }
        
        setNewReviewContent('');
        setNewRating(5);
        setIsFormOpen(false);
        setReplyToReview(null);
        setQuotedText('');
        setAttachmentFiles([]);
        setUploadedFiles([]);
      } else {
        const error = await response.json();
        console.error('Failed to post review:', error.error);
      }
    } catch (error) {
      console.error('Error posting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const addReplyToParent = (review: Review, parentId: string, newReply: Review): Review => {
    if (review.id === parentId) {
      return {
        ...review,
        replyCount: (review.replyCount || 0) + 1,
        replies: [...(review.replies || []), newReply]
      };
    }
    if (review.replies && review.replies.length > 0) {
      return {
        ...review,
        replies: review.replies.map(reply => addReplyToParent(reply, parentId, newReply))
      };
    }
    return review;
  };

  const handleReact = async (reviewId: string, emoji: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/reviews/${reviewId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ emoji })
      });
      
      if (response.ok) {
        const data = await response.json();
        updateReviewReactions(reviewId, data.reactions);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const updateReviewReactions = (reviewId: string, reactions: Reaction[]) => {
    setReviews(prevReviews => 
      prevReviews.map(r => updateReviewReactionsRecursive(r, reviewId, reactions))
    );
    // Also update userReview (including nested replies)
    if (userReview) {
      setUserReview(prev => prev ? updateReviewReactionsRecursive(prev, reviewId, reactions) : null);
    }
  };

  const updateReviewReactionsRecursive = (review: Review, targetId: string, reactions: Reaction[]): Review => {
    if (review.id === targetId) {
      return { ...review, reactions };
    }
    if (review.replies && review.replies.length > 0) {
      return {
        ...review,
        replies: review.replies.map(reply => updateReviewReactionsRecursive(reply, targetId, reactions))
      };
    }
    return review;
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user) return;
    
    try {
      const endpoint = (user.accessLevel === 'admin' || user.accessLevel === 'moder') 
        ? `/api/admin/reviews/${reviewId}`
        : `/api/reviews/${reviewId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const updatedReviews = removeReviewRecursive(reviews, reviewId);
        setReviews(updatedReviews);
        setCachedReviews(bookId, updatedReviews);
        
        // Clear userReview if it was deleted
        if (userReview && userReview.id === reviewId) {
          setUserReview(null);
        }
        
        if (onReviewsCountChange) {
          onReviewsCountChange(updatedReviews.length);
        }
        
        // Recalculate average rating
        if (onBookRatingChange) {
          const totalRating = updatedReviews.reduce((sum, review) => sum + review.rating, 0);
          const newAverageRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : null;
          onBookRatingChange(newAverageRating);
        }
      } else {
        console.error('Failed to delete review');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  const removeReviewRecursive = (reviewsList: Review[], targetId: string): Review[] => {
    return reviewsList
      .filter(r => r.id !== targetId)
      .map(r => ({
        ...r,
        replies: r.replies ? removeReviewRecursive(r.replies, targetId) : undefined
      }));
  };

  const handleReplyClick = (review: Review) => {
    setReplyToReview(review);
    setQuotedText('');
  };

  const handleCancelReply = () => {
    setReplyToReview(null);
    setQuotedText('');
  };

  const handleTextSelect = useCallback((review: Review) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (selectedText.length > 0 && selectedText.length <= 500) {
        setReplyToReview(review);
        setQuotedText(selectedText);
      }
    }
  }, []);

  const handleScrollToReview = useCallback((reviewId: string) => {
    const element = document.getElementById(`review-${reviewId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedReviewId(reviewId);
      setTimeout(() => {
        setHighlightedReviewId(null);
      }, 2000);
    }
  }, []);

  const handleToggleReplies = async (reviewId: string) => {
    if (expandedReplies.has(reviewId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    } else {
      // Check in reviews array first, then in userReview
      let review = findReviewById(reviews, reviewId);
      if (!review && userReview?.id === reviewId) {
        review = userReview;
      }
      if (review && (!review.replies || review.replies.length === 0)) {
        await fetchReplies(reviewId);
      }
      setExpandedReplies(prev => new Set(prev).add(reviewId));
    }
  };

  const findReviewById = (reviewsList: Review[], id: string): Review | null => {
    for (const review of reviewsList) {
      if (review.id === id) return review;
      if (review.replies) {
        const found = findReviewById(review.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchReplies = async (reviewId: string) => {
    setLoadingReplies(prev => new Set(prev).add(reviewId));
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/reviews/${reviewId}/replies`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const replies = await response.json();
        setReviews(prevReviews => 
          prevReviews.map(r => addRepliesToReview(r, reviewId, replies))
        );
        // Also update userReview if it's the one being expanded
        if (userReview && userReview.id === reviewId) {
          setUserReview(prev => prev ? { ...prev, replies } : null);
        }
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    }
  };

  const addRepliesToReview = (review: Review, targetId: string, replies: Review[]): Review => {
    if (review.id === targetId) {
      return { ...review, replies };
    }
    if (review.replies && review.replies.length > 0) {
      return {
        ...review,
        replies: review.replies.map(reply => addRepliesToReview(reply, targetId, replies))
      };
    }
    return review;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (newReviewContent.trim() && !submitting && !(attachmentFiles.length > 0 && uploadedFiles.length !== attachmentFiles.length)) {
        handlePostReview();
      }
    }
  };

  return (
    <div className="space-y-8">
      {authLoading ? (
        <div className="text-center py-4">
          <p>{t('common:loading')}</p>
        </div>
      ) : !user ? (
        <AuthPrompt 
          message={t('books:authRequiredForReviews')} 
          variant="card"
        />
      ) : !userReview && !isFormOpen && !replyToReview ? (
        <Button onClick={() => setIsFormOpen(true)} className="w-full gap-2" variant="outline">
          <Star className="w-4 h-4" />
          {t('books:writeReview')}
        </Button>
      ) : isFormOpen && !replyToReview && (
        <div className="bg-card border rounded-lg p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-serif font-bold text-lg">{t('books:yourReview', 'Your Review')}</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('books:ratingLabel')}: {newRating}/10</label>
              <div className="flex items-center gap-1">
                {[...Array(10)].map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNewRating(i + 1)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star 
                      className={`w-6 h-6 ${
                        i < newRating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-muted-foreground'
                      }`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder={t('books:reviewPlaceholder')}
              value={newReviewContent}
              onChange={(e) => setNewReviewContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[150px]"
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
                <EmojiPicker onEmojiSelect={(emoji) => setNewReviewContent(prev => prev + emoji)} />
                <AttachmentButton 
                  onFilesSelected={(files) => setAttachmentFiles(prev => [...prev, ...files])}
                  maxFiles={5}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Ctrl+Enter</span>
                <Button variant="ghost" onClick={() => setIsFormOpen(false)}>{t('books:cancel')}</Button>
                <Button onClick={handlePostReview} disabled={!newReviewContent.trim() || !user || submitting}>
                  {t('books:publish')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User's own review displayed at top */}
      {userReview && (
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-lg">{t('books:yourReview', 'Your Review')}</h3>
          <ReviewItem
            review={userReview}
            depth={0}
            user={user}
            dateLocale={dateLocale}
            t={t}
            expandedReplies={expandedReplies}
            loadingReplies={loadingReplies}
            highlightedReviewId={highlightedReviewId}
            replyingToId={replyToReview?.id || null}
            replyText={newReviewContent}
            quotedText={quotedText}
            submitting={submitting}
            onToggleReplies={handleToggleReplies}
            onReply={handleReplyClick}
            onCancelReply={handleCancelReply}
            onReplyTextChange={setNewReviewContent}
            onSubmitReply={handlePostReview}
            onDelete={handleDeleteReview}
            onReaction={handleReact}
            onTextSelect={handleTextSelect}
            onScrollToReview={handleScrollToReview}
            getRatingColor={getRatingColor}
          />
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <p>{t('common:loading')}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('books:noReviews', 'No reviews yet. Be the first!')}</p>
          </div>
        ) : (
          reviews
            .filter(review => !userReview || review.id !== userReview.id)
            .map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                depth={0}
                user={user}
                dateLocale={dateLocale}
                t={t}
                expandedReplies={expandedReplies}
                loadingReplies={loadingReplies}
                highlightedReviewId={highlightedReviewId}
                replyingToId={replyToReview?.id || null}
                replyText={newReviewContent}
                quotedText={quotedText}
                submitting={submitting}
                onToggleReplies={handleToggleReplies}
                onReply={handleReplyClick}
                onCancelReply={handleCancelReply}
                onReplyTextChange={setNewReviewContent}
                onSubmitReply={handlePostReview}
                onDelete={handleDeleteReview}
                onReaction={handleReact}
                onTextSelect={handleTextSelect}
                onScrollToReview={handleScrollToReview}
                getRatingColor={getRatingColor}
              />
            ))
        )}
      </div>
    </div>
  );
}
