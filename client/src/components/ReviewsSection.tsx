import React, { useState, useEffect } from 'react';
import { Review } from '@/hooks/useBooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Star, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { dataCache, getCachedReviews, setCachedReviews, getPendingRequest, trackPendingRequest, isCachedDataStale } from '@/lib/dataCache';

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

  // Fetch reviews when component mounts or bookId changes
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        
        // Fetch all reviews
        const response = await fetch(`http://localhost:5001/api/books/${bookId}/reviews`, {
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
      const response = await fetch(`http://localhost:5001/api/books/${bookId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ rating: newRating, content: newReviewContent })
      });
      
      if (response.ok) {
        const newReviewObj = await response.json();
        
        // Format the review to match our frontend interface
        const formattedReview: Review = {
          id: newReviewObj.id,
          bookId: newReviewObj.bookId,
          author: user.fullName || user.username || 'Вы',
          content: newReviewObj.content,
          rating: newReviewObj.rating,
          createdAt: newReviewObj.createdAt,
          reactions: [],
          userId: user.id
        };
        
        setNewReviewContent('');
        setNewRating(1);
        setIsFormOpen(false);
        
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

      const existingReactionIndex = review.reactions.findIndex(r => r.emoji === emoji);
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
      const existingReactionIndex = updatedUserReview.reactions.findIndex(r => r.emoji === emoji);
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
      const response = await fetch(`http://localhost:5001/api/books/${bookId}/reviews`, {
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
      const response = await fetch(`http://localhost:5001/api/reviews/${reviewId}`, {
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
          Написать рецензию
        </Button>
      ) : (
        <>
          {userReview && (
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <h3 className="font-serif font-bold text-lg">Ваша рецензия</h3>
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>{userReview.author[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-sm">{userReview.author}</h4>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-help">
                            {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true, locale: ru })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{format(new Date(userReview.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${getRatingColor(userReview.rating)}`}>
                    {userReview.rating}/10
                  </Badge>
                  {user && userReview.userId === user.id && (
                    <button 
                      onClick={() => handleDeleteReview(userReview.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
              
              <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                {userReview.content}
              </p>
                  
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
            <h3 className="font-serif font-bold text-lg">Рецензии</h3>
          )}
          {isFormOpen && (
            <div className="bg-card border rounded-lg p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-serif font-bold text-lg">Ваша рецензия</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Оценка: {newRating}/10</label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">1</span>
                    <Slider
                      value={[newRating]}
                      onValueChange={(vals) => setNewRating(vals[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">10</span>
                  </div>
                </div>

                <Textarea
                  placeholder="Поделитесь развернутым мнением о книге..."
                  value={newReviewContent}
                  onChange={(e) => setNewReviewContent(e.target.value)}
                  className="min-h-[150px]"
                />

                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Отмена</Button>
                  <Button onClick={handlePostReview} disabled={!newReviewContent.trim() || !user}>
                    Опубликовать
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-8">
            <p>Загрузка рецензий...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Пока нет рецензий. Будьте первым!</p>
          </div>
        ) : (
          reviews
            .filter(review => !userReview || review.id !== userReview.id)
            .map((review) => (
              <div key={review.id} className="bg-card border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3 items-center">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{review.author[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-sm">{review.author}</h4>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-help">
                              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: ru })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{format(new Date(review.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${getRatingColor(review.rating)}`}>
                      {review.rating}/10
                    </Badge>
                    {user && review.userId === user.id && (
                      <button 
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
                        
                <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                  {review.content}
                </p>
        
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
