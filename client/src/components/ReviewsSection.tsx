import React, { useState, useEffect } from 'react';
import { Book, UseBookReturn } from '@/hooks/useBooks';

// Define Review interface locally since it's not properly exported
interface Review {
  id: string;
  bookId: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  reactions: {
    emoji: string;
    count: number;
    userReacted: boolean;
  }[];
  userId: string;
  avatarUrl?: string | null;
  attachments?: {
    url: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    thumbnailUrl?: string;
  }[];
}
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { formatDistanceToNow, format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Star, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { dataCache, getCachedReviews, setCachedReviews, getPendingRequest, trackPendingRequest, isCachedDataStale } from '@/lib/dataCache';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentDisplay } from '@/components/AttachmentDisplay';
import { type UploadedFile } from '@/lib/fileUploadManager';

interface ReviewsProps {
  bookId: string;
  onReviewsCountChange?: (count: number) => void;
  onBookRatingChange?: (newRating: number | null) => void;
  onBookDataChange?: () => void;
}

export function ReviewsSection({ bookId, onReviewsCountChange, onBookRatingChange, onBookDataChange }: ReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReviewContent, setNewReviewContent] = useState('');
  const [newRating, setNewRating] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['books', 'common']);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Get date-fns locale based on current language
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Fetch reviews when component mounts or bookId changes
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        
        // Fetch all reviews
        const response = await fetch(`/api/books/${bookId}/reviews`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const fetchedReviews = await response.json();
          setReviews(fetchedReviews);
          
          // Cache the fetched data
          setCachedReviews(bookId, fetchedReviews);
          
          // Find and set the user's review from the fetched reviews
          if (user) {
            const userReview = fetchedReviews.find((review: any) => review.userId === user.id);
            if (userReview) {
              setUserReview(userReview);
            } else {
              setUserReview(null);
            }
          }
          
          // Notify parent component of review count change
          if (onReviewsCountChange) {
            onReviewsCountChange(fetchedReviews.length);
          }
          return fetchedReviews;
        }
        throw new Error('Failed to fetch reviews');
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
        // Even on error, notify parent with 0 count
        if (onReviewsCountChange) {
          onReviewsCountChange(0);
        }
        throw error;
      } finally {
        setLoading(false);
      }
    };

    // Check if we have cached data for this book
    const cachedReviewsEntry = dataCache.reviews[bookId];
    if (cachedReviewsEntry) {
      setReviews(cachedReviewsEntry.data);
      
      // Find and set the user's review from the cached reviews
      if (user) {
        const userReview = cachedReviewsEntry.data.find((review: any) => review.userId === user.id);
        if (userReview) {
          setUserReview(userReview);
        } else {
          setUserReview(null);
        }
      }
      
      // Notify parent component of review count change
      if (onReviewsCountChange) {
        onReviewsCountChange(cachedReviewsEntry.data.length);
      }
      setLoading(false);
      // Only fetch fresh data in background if the cached data is stale
      if (bookId && isCachedDataStale(cachedReviewsEntry.timestamp)) {
        fetchReviews().catch(() => {}); // Don't block UI on background refresh
      }
      return;
    }

    // Check if there's already a pending request for this book
    const pendingRequest = getPendingRequest('reviews', bookId);
    if (pendingRequest) {
      // Wait for the pending request to complete
      pendingRequest.then((fetchedReviews) => {
        setReviews(fetchedReviews);
        // Find and set the user's review from the fetched reviews
        if (user) {
          const userReview = fetchedReviews.find((review: any) => review.userId === user.id);
          if (userReview) {
            setUserReview(userReview);
          } else {
            setUserReview(null);
          }
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
      // Track this request to prevent duplicates
      const trackedRequest = trackPendingRequest('reviews', bookId, fetchReviews());
      trackedRequest.catch(() => {}); // Prevent unhandled promise rejection
    }
  }, [bookId, user, onReviewsCountChange]);

  const handlePostReview = async () => {
    if (!newReviewContent.trim() || !user || newRating < 1 || newRating > 10) return;
    
    try {
      const response = await fetch(`/api/books/${bookId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          rating: newRating, 
          content: newReviewContent,
          attachments: uploadedFiles.map(f => f.uploadId)
        })
      });
      
      if (response.ok) {
        const newReviewObj = await response.json();
        
        // Format the review to match our frontend interface
        const formattedReview: Review = {
          id: newReviewObj.id,
          bookId: newReviewObj.bookId,
          author: newReviewObj.author || user.fullName || user.username || 'Вы',
          content: newReviewObj.content,
          rating: newReviewObj.rating,
          createdAt: newReviewObj.createdAt,
          reactions: [],
          userId: newReviewObj.userId || user.id,
          avatarUrl: newReviewObj.avatarUrl || user.avatarUrl || null,
          attachments: newReviewObj.attachmentMetadata?.attachments || []
        };
        
        setNewReviewContent('');
        setNewRating(1);
        setIsFormOpen(false);
        setAttachmentFiles([]);
        setUploadedFiles([]);
        
        // Optimistically add the new review to the beginning of the list
        const updatedReviews = [formattedReview, ...reviews];
        setReviews(updatedReviews);
        setUserReview(formattedReview);
        
        // Update cache with new review
        setCachedReviews(bookId, updatedReviews);
        
        // Notify parent component of review count change
        if (onReviewsCountChange) {
          onReviewsCountChange(updatedReviews.length);
        }
        
        // Calculate and send the new average rating to update the book display
        if (onBookRatingChange) {
          // Calculate new average rating including the newly added review
          const totalRating = updatedReviews.reduce((sum, review) => sum + review.rating, 0);
          const newAverageRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : null;
          onBookRatingChange(newAverageRating);
        }
      } else {
        const error = await response.json();
        console.error('Failed to post review:', error.error);
      }
    } catch (error) {
      console.error('Error posting review:', error);
    }
  };

  const handleReact = async (reviewId: string, emoji: string) => {
    // Since reactions are handled on the server, we need to:
    // 1. Optimistically update the UI
    // 2. Refetch the reviews to get the accurate reaction counts from the server
    
    // Optimistically update the UI for immediate feedback
    const updatedReviews = reviews.map(review => {
      if (review.id !== reviewId) return review;

      const existingReactionIndex = review.reactions.findIndex((r: { emoji: string }) => r.emoji === emoji);
      let newReactions = [...review.reactions];

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

      return { ...review, reactions: newReactions };
    });

    setReviews(updatedReviews);

    // Also update userReview if this is the user's review
    if (userReview && userReview.id === reviewId) {
      const updatedUserReview = { ...userReview };
      const existingReactionIndex = updatedUserReview.reactions.findIndex((r: { emoji: string }) => r.emoji === emoji);
      let newReactions = [...updatedUserReview.reactions];

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

      updatedUserReview.reactions = newReactions;
      setUserReview(updatedUserReview);
    }
    
    // Update cache with the updated reviews
    setCachedReviews(bookId, updatedReviews);
    
    // Now refetch the reviews to get accurate data from the server
    try {
      const response = await fetch(`/api/books/${bookId}/reviews`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const fetchedReviews = await response.json();
        setReviews(fetchedReviews);
        
        // Update userReview if it's in the fetched reviews
        if (user && userReview) {
          const updatedUserReview = fetchedReviews.find((review: any) => review.userId === user.id);
          if (updatedUserReview) {
            setUserReview(updatedUserReview);
          }
        }
        
        // Update cache with fresh data
        setCachedReviews(bookId, fetchedReviews);
      }
    } catch (error) {
      console.error('Failed to refresh reviews after reaction:', error);
      // Revert to previous state if refresh fails
      setReviews(reviews);
      if (userReview) {
        setUserReview(userReview);
      }
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user) return;
    
    // Store the review being deleted for potential rollback
    const reviewToDelete = reviews.find(review => review.id === reviewId);
    
    // Optimistically remove the review from the state
    const updatedReviews = reviews.filter(review => review.id !== reviewId);
    setReviews(updatedReviews);
    
    // Also remove from userReview if it matches
    if (userReview && userReview.id === reviewId) {
      setUserReview(null);
    }
    
    // Update cache
    setCachedReviews(bookId, updatedReviews);
    
    // Notify parent component of review count change
    if (onReviewsCountChange) {
      onReviewsCountChange(updatedReviews.length);
    }
    
    // Calculate and send the new average rating to update the book display
    if (onBookRatingChange) {
      // Calculate new average rating after deletion
      const totalRating = updatedReviews.reduce((sum, review) => sum + review.rating, 0);
      const newAverageRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : null;
      onBookRatingChange(newAverageRating);
    }
    
    try {
      // Use admin endpoint if user is admin or moderator
      const endpoint = (user.accessLevel === 'admin' || user.accessLevel === 'moder') 
        ? `/api/admin/reviews/${reviewId}`
        : `/api/reviews/${reviewId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        console.error('Failed to delete review');
        // Rollback the optimistic update
        if (reviewToDelete) {
          const rollbackReviews = [reviewToDelete, ...updatedReviews];
          setReviews(rollbackReviews);
          if (userReview && userReview.id === reviewId) {
            setUserReview(reviewToDelete);
          }
          setCachedReviews(bookId, rollbackReviews);
          if (onReviewsCountChange) {
            onReviewsCountChange(rollbackReviews.length);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      // Rollback the optimistic update
      if (reviewToDelete) {
        const rollbackReviews = [reviewToDelete, ...updatedReviews];
        setReviews(rollbackReviews);
        if (userReview && userReview.id === reviewId) {
          setUserReview(reviewToDelete);
        }
        setCachedReviews(bookId, rollbackReviews);
        if (onReviewsCountChange) {
          onReviewsCountChange(rollbackReviews.length);
        }
      }
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (rating >= 5) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  };

  return (
    <div className="space-y-8">
      {!userReview && !isFormOpen ? (
        <Button onClick={() => setIsFormOpen(true)} className="w-full gap-2" variant="outline" disabled={!user}>
          <Star className="w-4 h-4" />
          {t('books:writeReview')}
        </Button>
      ) : (
        <>
          {userReview && (
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-serif font-bold text-lg">{t('books:yourReview', 'Ваша рецензия')}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${getRatingColor(userReview.rating)}`}>
                    {userReview.rating}/10
                  </Badge>
                  {user && (userReview.userId === user.id || user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
                    <button 
                      onClick={() => handleDeleteReview(userReview.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title={t('books:delete')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Avatar className="w-10 h-10">
                  {userReview.avatarUrl ? (
                    <AvatarImage src={userReview.avatarUrl} alt={userReview.author} />
                  ) : null}
                  <AvatarFallback>{userReview.author[0]}</AvatarFallback>
                </Avatar>
                <div>
                  {userReview.userId ? (
                    <a
                      href={`/profile/${userReview.userId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm text-primary hover:underline"
                    >
                      {userReview.author}
                    </a>
                  ) : (
                    <h4 className="font-semibold text-sm">{userReview.author}</h4>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">
                          {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{format(new Date(userReview.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                {userReview.content}
              </p>

              {userReview.attachments && userReview.attachments.length > 0 && (
                <AttachmentDisplay attachments={userReview.attachments} className="mt-2" />
              )}
                  
              <div className="pt-4 border-t border-border/50">
                <ReactionBar 
                  reactions={userReview.reactions} 
                  onReact={(emoji) => handleReact(userReview.id, emoji)} 
                  reviewId={userReview.id}
                />
              </div>
            </div>
          )}
          
          {!isFormOpen && !userReview && (
            <h3 className="font-serif font-bold text-lg">{t('books:reviewsTitle', 'Рецензии')}</h3>
          )}
          {isFormOpen && (
            <div className="bg-card border rounded-lg p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-serif font-bold text-lg">{t('books:yourReview', 'Ваша рецензия')}</h3>
              
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
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setIsFormOpen(false)}>{t('books:cancel')}</Button>
                    <Button onClick={handlePostReview} disabled={!newReviewContent.trim() || !user}>
                      {t('books:publish')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-8">
            <p>{t('common:loading')}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('books:noReviews', 'Пока нет рецензий. Будьте первым!')}</p>
          </div>
        ) : (
          reviews
            .filter(review => !userReview || review.id !== userReview.id)
            .map((review) => (
              <div key={review.id} className="bg-card border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                {user && (review.userId === user.id || user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
                  <button 
                    onClick={() => handleDeleteReview(review.id)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                    title={t('books:delete')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="flex justify-between items-start">
                  <div className="flex gap-3 items-start">
                    <Avatar className="w-10 h-10">
                      {review.avatarUrl ? (
                        <AvatarImage src={review.avatarUrl} alt={review.author} />
                      ) : null}
                      <AvatarFallback>{review.author[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      {review.userId ? (
                        <a
                          href={`/profile/${review.userId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm text-primary hover:underline"
                        >
                          {review.author}
                        </a>
                      ) : (
                        <h4 className="font-semibold text-sm">{review.author}</h4>
                      )}
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
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${getRatingColor(review.rating)}`}>
                    {review.rating}/10
                  </Badge>
                </div>
                        
                <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                  {review.content}
                </p>

                {review.attachments && review.attachments.length > 0 && (
                  <AttachmentDisplay attachments={review.attachments} className="mt-2" />
                )}
        
                <div className="pt-4 border-t border-border/50">
                  <ReactionBar 
                    reactions={review.reactions} 
                    onReact={(emoji) => handleReact(review.id, emoji)} 
                    reviewId={review.id}
                  />
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
