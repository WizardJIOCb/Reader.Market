import React, { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { AuthPrompt } from '@/components/AuthPrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Send, X, Reply, ChevronDown, ChevronUp, Quote, Trash2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { readerApi, reviewsApi } from '@/lib/api';
import { readingProgressCache } from '@/lib/readingProgressCache';
import { UserNameWithRating } from './UserNameWithRating';
import { dataCache, getCachedComments, setCachedComments, getPendingRequest, trackPendingRequest, isCachedDataStale, getCachedUserReview, setCachedUserReview, getPendingUserReviewRequest, trackPendingUserReviewRequest, isUserReviewStale } from '@/lib/dataCache';
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

export interface Comment {
  id: string;
  bookId: string;
  author: string;
  username?: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  userId?: string;
  avatarUrl?: string | null;
  attachments?: Attachment[];
  isOwnComment?: boolean;
  parentCommentId?: string | null;
  quotedText?: string | null;
  parentCommentAuthor?: string | null;
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

interface CommentsProps {
  bookId: string;
  onCommentsCountChange?: (count: number) => void;
  onSwitchToReviewsTab?: () => void;
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
  bookId: string;
  onToggleReplies: (commentId: string) => void;
  onReply: (comment: Comment) => void;
  onCancelReply: () => void;
  onReplyTextChange: (text: string) => void;
  onSubmitReply: () => void;
  onDelete: (commentId: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onTextSelect: (comment: Comment) => void;
  onScrollToComment: (commentId: string) => void;
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
  bookId,
  onToggleReplies,
  onReply,
  onCancelReply,
  onReplyTextChange,
  onSubmitReply,
  onDelete,
  onReaction,
  onTextSelect,
  onScrollToComment
}: CommentItemProps) {
  const isExpanded = expandedReplies.has(comment.id);
  const isLoading = loadingReplies.has(comment.id);
  const hasReplies = (comment.replyCount && comment.replyCount > 0) || (comment.replies && comment.replies.length > 0);
  const isAuthenticated = !!user;
  const isCompact = depth > 0;
  const displayReplyCount = comment.replyCount || (comment.replies?.length || 0);
  const isHighlighted = highlightedCommentId === comment.id;
  const isReplyingToThis = replyingToId === comment.id;
  const isOwnComment = user && comment.userId === user.id;
  
  // Reading progress state
  // Use reading progress from API data if available, otherwise load it
  const [readingProgress, setReadingProgress] = useState<{percentage: number, currentPage: number, totalPages: number} | null>(comment.metadata?.readingProgress || null);
  // User's book review rating
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  
  // Log whether we're using metadata or making API calls
  useEffect(() => {
    if (comment.metadata?.readingProgress) {
      // Using metadata reading progress
    } else if (comment.userId && comment.bookId) {
      // Will fetch reading progress from API
    }
  }, [comment.id, comment.metadata?.readingProgress, comment.userId, comment.bookId]);
  
  // Get color class based on rating
  const getRatingColorClass = () => {
    if (reviewRating === null) return 'text-gray-500 bg-gray-100 dark:bg-gray-800';
    if (reviewRating >= 8) return 'text-green-700 bg-green-100 dark:bg-green-900/30';
    if (reviewRating >= 5) return 'text-amber-700 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-700 bg-red-100 dark:bg-red-900/30';
  };
  
  // Load reading progress for this user and book (fallback if not in API data)
  useEffect(() => {
    // Only load from API if readingProgress wasn't provided in the comment data
    if ((!comment.metadata || comment.metadata.readingProgress === undefined) && comment.userId && comment.bookId) {
      const loadReadingProgress = async () => {
        const bookId = comment.bookId;
        const userId = comment.userId;
        
        if (bookId && userId) {
          try {
            // Use cached API call to avoid duplicate requests
            const data = await readingProgressCache.getUserProgress(
              bookId, 
              userId,
              () => readerApi.getUserProgress(bookId, userId)
            );
            
            if (data.ok) {
              const progressData = await data.json();
              
              if (progressData) {
                // Only show progress if user has actually read something
                if (progressData.percentage > 0) {
                  setReadingProgress({
                    percentage: parseFloat(progressData.percentage),
                    currentPage: progressData.current_page || progressData.currentPage,
                    totalPages: progressData.total_pages || progressData.totalPages
                  });
                }
              }
            }
          } catch (error) {
            console.error('Failed to load reading progress:', error);
          }
        }
      };
      
      loadReadingProgress();
    } else if (comment.metadata?.readingProgress) {
      setReadingProgress(comment.metadata.readingProgress);
    }
  }, [comment.id, comment.userId, comment.bookId, comment.metadata?.readingProgress]);
  
  // Load user's review rating for this book
  useEffect(() => {
    const loadReviewRating = async () => {
      if (comment.userId && bookId) {
        // Check cache first
        const cachedReview = getCachedUserReview(bookId, comment.userId);
        if (cachedReview) {
          setReviewRating(cachedReview.rating || null);
          // Check if cache is stale and refresh in background
          const cacheKey = `${bookId}-${comment.userId}`;
          const cachedEntry = dataCache.userReviews[cacheKey];
          if (cachedEntry && isUserReviewStale(cachedEntry.timestamp)) {
            loadReviewRatingFromAPI(false); // Background refresh
          }
          return;
        }

        // Check for pending request
        const pendingRequest = getPendingUserReviewRequest(bookId, comment.userId);
        if (pendingRequest) {
          pendingRequest.then(review => {
            if (review && review.rating) {
              setReviewRating(review.rating);
            } else {
              // Explicitly set to null when no rating exists
              setReviewRating(null);
            }
          }).catch(() => {
            console.error('Failed to load review rating from pending request');
            // Set to null on error
            setReviewRating(null);
          });
          return;
        }

        // Load from API
        loadReviewRatingFromAPI(true);
      }
    };

    const loadReviewRatingFromAPI = async (showLoading: boolean = true) => {
      if (!bookId || !comment.userId) return;
      
      // Track this request to prevent duplicates
      const requestPromise = (async () => {
        try {
          const response = await reviewsApi.getUserReview(bookId!, comment.userId!);
          if (response.ok) {
            const userReview = await response.json();
            if (userReview && userReview.rating) {
              setReviewRating(userReview.rating);
              setCachedUserReview(bookId!, comment.userId!, userReview);
            } else {
              // Explicitly set to null when no rating exists
              setReviewRating(null);
              // Still cache the result to avoid repeated API calls
              setCachedUserReview(bookId!, comment.userId!, null);
            }
            return userReview;
          } else {
            throw new Error(`API Error: ${response.status}`);
          }
        } catch (error) {
          console.error('Failed to load review rating:', error);
          // Set to null on error
          setReviewRating(null);
          throw error;
        }
      })();
      
      // Track the pending request
      trackPendingUserReviewRequest(bookId!, comment.userId!, requestPromise);
      
      try {
        await requestPromise;
      } catch (error) {
        console.error(`Request failed for user: ${comment.userId}, book: ${bookId}`, error);
        // Set to null on error
        setReviewRating(null);
      }
    };

    loadReviewRating();
  }, [comment.userId, bookId]);

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
            ? (isOwnComment ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : '') 
            : `border ${isOwnComment ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : 'bg-card'}`
        } ${isCompact ? 'p-2.5' : 'p-4'}`}
      >
        <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <Avatar className={`flex-shrink-0 ${isCompact ? 'w-7 h-7' : 'w-10 h-10'}`}>
            {comment.avatarUrl ? (
              <AvatarImage src={comment.avatarUrl} alt={comment.author} />
            ) : null}
            <AvatarFallback className={isCompact ? 'text-xs' : ''}>
              {comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <UserNameWithRating
                  userId={comment.userId || ''}
                  username={comment.username || ''}
                  fullName={comment.author}
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
                
                {/* User's book review rating - only show if user has rated the book */}
                {comment.userId && reviewRating !== null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Switch to reviews tab and scroll to review
                            const switchTabFunc = (window as any).switchToReviewsTab;
                            if (typeof switchTabFunc === 'function') {
                              switchTabFunc();
                              
                              // Wait for tab switch and then scroll to review
                              setTimeout(() => {
                                // Try multiple selectors to find the review
                                const selectors = [
                                  `[data-user-id="${comment.userId}"]`,
                                  `[data-author-id="${comment.userId}"]`,
                                  `[data-review-user-id="${comment.userId}"]`,
                                  `.review-item[data-user-id="${comment.userId}"]`,
                                  `.user-review-${comment.userId}`
                                ];
                                
                                let reviewElement = null;
                                for (const selector of selectors) {
                                  reviewElement = document.querySelector(selector);
                                  if (reviewElement) break;
                                }
                                
                                // If not found, try searching by content
                                if (!reviewElement) {
                                  const allReviews = document.querySelectorAll('[id^="review-"]');
                                  for (const review of Array.from(allReviews)) {
                                    const reviewUserId = review.getAttribute('data-user-id') || 
                                                         review.getAttribute('data-author-id') ||
                                                         review.closest('[data-user-id]')?.getAttribute('data-user-id');
                                    if (reviewUserId === comment.userId) {
                                      reviewElement = review;
                                      break;
                                    }
                                  }
                                }
                                
                                if (reviewElement) {
                                  
                                  reviewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  // Highlight the review with service colors - warm orange/beige highlighting
                                  reviewElement.classList.add(
                                    'ring-4', 
                                    'ring-orange-300', 
                                    'ring-opacity-60', 
                                    'bg-orange-50', 
                                    'dark:bg-orange-900/20', 
                                    'rounded-lg',
                                    'shadow-lg'
                                  );
                                  setTimeout(() => {
                                    reviewElement.classList.remove(
                                      'ring-4', 
                                      'ring-orange-300', 
                                      'ring-opacity-60', 
                                      'bg-orange-50', 
                                      'dark:bg-orange-900/20', 
                                      'rounded-lg',
                                      'shadow-lg'
                                    );
                                  }, 3000);
                                } else {
                                  
                                  // Fallback: just scroll to top of reviews section and highlight it
                                  const reviewsSection = document.querySelector('#reviews-section, [data-tab="reviews"]');
                                  if (reviewsSection) {
                                    reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    // Highlight the reviews section with warm colors
                                    reviewsSection.classList.add(
                                      'ring-4', 
                                      'ring-orange-300', 
                                      'ring-opacity-40', 
                                      'bg-orange-50/50', 
                                      'dark:bg-orange-900/10', 
                                      'rounded-lg'
                                    );
                                    setTimeout(() => {
                                      reviewsSection.classList.remove(
                                        'ring-4', 
                                        'ring-orange-300', 
                                        'ring-opacity-40', 
                                        'bg-orange-50/50', 
                                        'dark:bg-orange-900/10', 
                                        'rounded-lg'
                                      );
                                    }, 3000);
                                  }
                                }
                              }, 1000);
                            }
                          }}
                          className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full transition-colors cursor-pointer font-medium ${
                            getRatingColorClass()
                          }`}
                        >
                          <Star className="w-3 h-3 fill-current" />
                          <span>{reviewRating}/10</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#fbf6f0] dark:bg-[#2a2520] border border-[#e8e0d0] dark:border-[#3a3530] text-[#2a2520] dark:text-[#fbf6f0]">
                        <div className="text-xs">
                          <div>{t('comments:userBookRating', "User's rating of this book")}</div>
                          <div className="mt-1 text-[#5a5550] dark:text-[#cbc6c0]">{t('comments:clickToViewReview', 'Click to view review')}</div>
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
              </div>
              
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(isOwnComment || user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
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

            {/* Attachments */}
            {comment.attachments && comment.attachments.length > 0 && (
              <AttachmentDisplay attachments={comment.attachments} className="mt-2" />
            )}

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
                onReact={(emoji) => {
                  
                  
                  
                  onReaction(comment.id, emoji);
                }}
                commentId={comment.id}
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
              bookId={bookId}
              onToggleReplies={onToggleReplies}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              onReaction={onReaction}
              onTextSelect={onTextSelect}
              onScrollToComment={onScrollToComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsSection({ bookId, onCommentsCountChange }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { t, i18n } = useTranslation(['books', 'common', 'profile']);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [quotedText, setQuotedText] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setExpandedReplies(new Set());
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/books/${bookId}/comments`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (response.ok) {
        const fetchedComments = await response.json();
        setComments(fetchedComments);
        setCachedComments(bookId, fetchedComments);
        
        if (onCommentsCountChange) {
          onCommentsCountChange(fetchedComments.length);
        }
        return fetchedComments;
      }
      throw new Error('Failed to fetch comments');
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      if (onCommentsCountChange) {
        onCommentsCountChange(0);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [bookId, onCommentsCountChange]);

  useEffect(() => {
    const cachedCommentsEntry = dataCache.comments[bookId];
    if (cachedCommentsEntry) {
      setComments(cachedCommentsEntry.data);
      if (onCommentsCountChange) {
        onCommentsCountChange(cachedCommentsEntry.data.length);
      }
      setLoading(false);
      if (bookId && isCachedDataStale(cachedCommentsEntry.timestamp)) {
        fetchComments().catch(() => {});
      }
      return;
    }

    const pendingRequest = getPendingRequest('comments', bookId);
    if (pendingRequest) {
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
      const trackedRequest = trackPendingRequest('comments', bookId, fetchComments());
      trackedRequest.catch(() => {});
    }
  }, [bookId, onCommentsCountChange, fetchComments]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/books/${bookId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          content: newComment,
          attachments: uploadedFiles.map(f => f.uploadId),
          parentCommentId: replyToComment?.id || null,
          quotedText: quotedText || null
        })
      });
      
      if (response.ok) {
        const newCommentObj = await response.json();
        
        if (replyToComment) {
          // It's a reply - add to parent's replies array
          const newReply: Comment = {
            id: newCommentObj.id,
            bookId: newCommentObj.bookId,
            author: newCommentObj.author || user.fullName || user.username || 'You',
            username: newCommentObj.username || user.username,
            content: newCommentObj.content,
            createdAt: new Date().toISOString(),
            reactions: [],
            userId: user.id,
            avatarUrl: user.avatarUrl || null,
            isOwnComment: true,
            parentCommentId: replyToComment.id,
            quotedText: quotedText || null,
            parentCommentAuthor: replyToComment.author,
            replyCount: 0,
            replies: [],
            attachments: newCommentObj.attachmentMetadata?.attachments || []
          };
          
          setComments(prevComments => 
            prevComments.map(c => addReplyToParent(c, replyToComment.id, newReply))
          );
          
          setExpandedReplies(prev => new Set(prev).add(replyToComment.id));
        } else {
          // Root comment
          const formattedComment: Comment = {
            id: newCommentObj.id,
            bookId: newCommentObj.bookId,
            author: newCommentObj.author || user.fullName || user.username || 'You',
            username: newCommentObj.username || user.username,
            content: newCommentObj.content,
            createdAt: new Date().toISOString(),
            reactions: [],
            userId: user.id,
            avatarUrl: user.avatarUrl || null,
            isOwnComment: true,
            parentCommentId: null,
            quotedText: null,
            parentCommentAuthor: null,
            replyCount: 0,
            replies: [],
            attachments: newCommentObj.attachmentMetadata?.attachments || []
          };
          
          const updatedComments = [formattedComment, ...comments];
          setComments(updatedComments);
          setCachedComments(bookId, updatedComments);
          
          if (onCommentsCountChange) {
            onCommentsCountChange(updatedComments.length);
          }
        }
        
        setNewComment('');
        setReplyToComment(null);
        setQuotedText('');
        setAttachmentFiles([]);
        setUploadedFiles([]);
      } else {
        console.error('Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleReact = async (commentId: string, emoji: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ emoji })
      });
      
      if (response.ok) {
        const data = await response.json();
        updateCommentReactions(commentId, data.reactions);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

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

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    
    try {
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
        const updatedComments = removeCommentRecursive(comments, commentId);
        setComments(updatedComments);
        setCachedComments(bookId, updatedComments);
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

  const removeCommentRecursive = (commentsList: Comment[], targetId: string): Comment[] => {
    return commentsList
      .filter(c => c.id !== targetId)
      .map(c => ({
        ...c,
        replies: c.replies ? removeCommentRecursive(c.replies, targetId) : undefined
      }));
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
      setTimeout(() => {
        setHighlightedCommentId(null);
      }, 2000);
    }
  }, []);

  const handleToggleReplies = async (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/comments/${commentId}/replies`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const replies = await response.json();
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (newComment.trim() && !submitting && !(attachmentFiles.length > 0 && uploadedFiles.length !== attachmentFiles.length)) {
        handlePostComment();
      }
    }
  };

  return (
    <div className="space-y-8">
      {authLoading ? (
        <div className="text-center py-4">
          <p>{t('common:loading')}</p>
        </div>
      ) : user ? (
        <div className="flex gap-4">
          <Avatar>
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.fullName || user.username} />
            ) : null}
            <AvatarFallback>You</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder={t('books:commentPlaceholder')}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ctrl+Enter</span>
                <Button 
                  onClick={handlePostComment} 
                  disabled={!newComment.trim() || !user || submitting || (attachmentFiles.length > 0 && uploadedFiles.length !== attachmentFiles.length)} 
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {t('books:send')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AuthPrompt 
          message={t('common:authPromptComments')} 
          variant="card"
        />
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <p>{t('common:loading')}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('books:noComments', 'No comments yet. Be the first!')}</p>
          </div>
        ) : (
          comments.map((comment) => (
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
              replyText={newComment}
              quotedText={quotedText}
              submitting={submitting}
              bookId={bookId}
              onToggleReplies={handleToggleReplies}
              onReply={handleReplyClick}
              onCancelReply={handleCancelReply}
              onReplyTextChange={setNewComment}
              onSubmitReply={handlePostComment}
              onDelete={handleDeleteComment}
              onReaction={handleReact}
              onTextSelect={handleTextSelect}
              onScrollToComment={handleScrollToComment}
            />
          ))
        )}
      </div>
    </div>
  );
}
