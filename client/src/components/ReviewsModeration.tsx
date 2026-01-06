import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { apiCall, reviewsApi } from '@/lib/api';

interface Review {
  id: string;
  content: string;
  author: string;
  userId?: string;
  avatarUrl?: string | null;
  rating: number;
  bookId: string;
  bookTitle?: string;
  createdAt: string;
  updatedAt: string;
}

const ReviewsModeration: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<{id: string, content: string, rating: number} | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchPendingReviews();
    }
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/admin/reviews/pending');
      const data = await response.json();
      
      // Fetch book titles for each review
      const reviewsWithBooks = await Promise.all(data.map(async (review: Review) => {
        try {
          const bookResponse = await apiCall(`/api/books/${review.bookId}`);
          const bookData = await bookResponse.json();
          return {
            ...review,
            bookTitle: bookData.title
          };
        } catch (err) {
          console.error(`Error fetching book ${review.bookId} for review ${review.id}:`, err);
          return {
            ...review,
            bookTitle: 'Unknown Book'
          };
        }
      }));
      
      setReviews(reviewsWithBooks);
      setError(null);
    } catch (err) {
      console.error('Error fetching pending reviews:', err);
      setError('Failed to load pending reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }
    
    try {
      await reviewsApi.adminDeleteReview(id);
      setReviews(reviews.filter(review => review.id !== id));
    } catch (err) {
      console.error('Error deleting review:', err);
      setError('Failed to delete review');
    }
  };

  const handleEdit = (review: Review) => {
    setEditingReview({id: review.id, content: review.content, rating: review.rating});
  };

  const handleSaveEdit = async (reviewId: string) => {
    if (!editingReview || editingReview.id !== reviewId) return;
    
    try {
      await reviewsApi.adminUpdateReview(reviewId, {content: editingReview.content, rating: editingReview.rating});
      setReviews(reviews.map(review => 
        review.id === reviewId ? {...review, content: editingReview.content, rating: editingReview.rating} : review
      ));
      setEditingReview(null);
    } catch (err) {
      console.error('Error updating review:', err);
      setError('Failed to update review');
    }
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            Loading pending reviews...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-red-500">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reviews Moderation</h2>
        <p className="text-sm text-muted-foreground">
          {reviews.length} pending review{reviews.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reviews Awaiting Moderation</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        {review.avatarUrl ? (
                          <AvatarImage src={review.avatarUrl} alt={review.author} />
                        ) : null}
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center">
                          {review.userId ? (
                            <a
                              href={`/profile/${review.userId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline"
                            >
                              {review.author}
                            </a>
                          ) : (
                            <span className="font-medium">{review.author}</span>
                          )}
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-sm font-medium text-yellow-600">
                            Rating: {review.rating}/10
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Book: <span className="font-medium">{review.bookTitle || 'Unknown Book'}</span>
                        </div>
                      {editingReview && editingReview.id === review.id ? (
                        <div className="mt-2">
                          <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">Rating (1-10):</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={editingReview.rating}
                              onChange={(e) => setEditingReview({...editingReview, rating: parseInt(e.target.value) || 0})}
                              className="w-20 p-2 border rounded"
                            />
                          </div>
                          <textarea
                            value={editingReview.content}
                            onChange={(e) => setEditingReview({...editingReview, content: e.target.value})}
                            className="w-full p-2 border rounded"
                            rows={3}
                          />
                          <div className="flex space-x-2 mt-2">
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleSaveEdit(review.id)}
                            >
                              Save
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="mt-2 text-muted-foreground">{review.content}</p>
                          <div className="flex space-x-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEdit(review)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => handleDelete(review.id)}
                            >
                              Delete
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => window.open(`/book/${review.bookId}`, '_blank', 'noopener,noreferrer')}
                            >
                              Show
                            </Button>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No pending reviews to moderate.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewsModeration;