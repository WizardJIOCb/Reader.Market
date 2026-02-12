import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import * as MockData from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  MessageSquare, 
  Star, 
  Calendar, 
  User, 
  ChevronRight,
  Play,
  Plus,
  Send,
  Clock,
  Award,
  Trash,
  Bookmark,
  Activity
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReactionBar } from '@/components/ReactionBar';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { CommentsSection } from '@/components/CommentsSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BookArticlesTab } from '@/components/books/BookArticlesTab';
import { useToast } from '@/hooks/use-toast';
import { useShelves } from '@/hooks/useShelves';
import { useAuth } from '@/lib/auth';
import { booksApi } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useBookSplash } from '@/lib/bookSplashContext';
import { joinBookReactions, leaveBookReactions, onSocketEvent } from '@/lib/socket';

// Define the Book interface to match our database schema
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
  videoCoverUrl?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  genre?: string;
  publishedYear?: number;
  rating?: number;
  commentCount?: number;
  reviewCount?: number;
  shelfCount?: number;
  cardViewCount?: number;
  readerOpenCount?: number;
  userId: string; // Added userId field
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string;
  publishedAt?: string;
  lastActivityDate?: string;
  reactions?: Reaction[]; // Added reactions field
}

// Define comment and review interfaces
interface Comment {
  id: string;
  bookId: string;
  author: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  userId?: string;
  avatarUrl?: string | null;
}

interface Review {
  id: string;
  bookId: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  reactions: Reaction[];
  userId?: string;
  avatarUrl?: string | null;
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export default function BookDetail() {
  const { t } = useTranslation(['books']);
  
  // Format dates for display in DD.MM.YYYY format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  // Format date for display based on age (relative for <24h, full for >=24h)
  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours >= 24) {
      // More than 24 hours old - show full date/time
      return format(date, 'dd.MM.yyyy HH:mm', { locale: ru });
    } else {
      // Less than 24 hours old - show relative time
      return formatDistanceToNow(date, { addSuffix: true, locale: ru });
    }
  };
  
  const [match, params] = useRoute('/book/:bookId');
  const bookId = params?.bookId || '';
  const { toast } = useToast();
  const { shelves, addBookToShelf, removeBookFromShelf } = useShelves();
  const { user } = useAuth();
  
  // State for book data
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Added state for delete operation
  const [localReactions, setLocalReactions] = useState<Reaction[]>([]); // Added state for reactions
  const recentlySubmittedReactions = useRef<Set<string>>(new Set()); // Track recently submitted reactions to prevent WebSocket conflicts
  
  // State for comments and reviews
  const [bookComments, setBookComments] = useState<Comment[]>([]);
  const [bookReviews, setBookReviews] = useState<Review[]>([]);
  const [totalCommentCount, setTotalCommentCount] = useState<number>(0);
  
  // State for new comment/review
  const [newComment, setNewComment] = useState('');
  const [newReview, setNewReview] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  
  // State for reading progress
  const [readingProgress, setReadingProgress] = useState<{
    currentPage: number;
    totalPages: number;
    percentage: number;
    lastReadAt?: string;
  } | null>(null);
  
  // State for tabs
  const [activeTab, setActiveTab] = useState('comments');
  
  // State for articles total
  const [articlesTotal, setArticlesTotal] = useState<number | null>(null);
  
  // Reset articles total when bookId changes
  useEffect(() => {
    setArticlesTotal(null);
  }, [bookId]);
  
  // Make tab switch function available globally for comments section
  useEffect(() => {
    (window as any).switchToReviewsTab = () => {
      
      setActiveTab('reviews');
    };
    
    // Cleanup on unmount
    return () => {
      delete (window as any).switchToReviewsTab;
    };
  }, []);
  
  // Global splash screen for seamless transition
  const { showSplash } = useBookSplash();
  const [, setLocation] = useLocation();
  
  // Function to fetch comments and reviews
  const fetchCommentsAndReviews = async () => {
    if (!bookId) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Fetch comments
      const commentsResponse = await fetch(`/api/books/${bookId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        setBookComments(commentsData);
      }
      
      // Fetch reviews
      const reviewsResponse = await fetch(`/api/books/${bookId}/reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setBookReviews(reviewsData);
      }
      
      // Fetch total comment count (including replies)
      const totalCountResponse = await fetch(`/api/books/${bookId}/comments/count`);
      if (totalCountResponse.ok) {
        const totalCountData = await totalCountResponse.json();
        setTotalCommentCount(totalCountData.count);
      }
    } catch (err) {
      console.error('Error fetching comments and reviews:', err);
    }
  };
  
  // Function to fetch comments and reviews with a flag to prevent duplicate calls
  const fetchCommentsAndReviewsWithTracking = useRef(false);
  
  const fetchCommentsAndReviewsOnce = async () => {
    if (fetchCommentsAndReviewsWithTracking.current) {
      return; // Already fetching, prevent duplicate calls
    }
    
    fetchCommentsAndReviewsWithTracking.current = true;
    try {
      await fetchCommentsAndReviews();
    } finally {
      fetchCommentsAndReviewsWithTracking.current = false;
    }
  };
  

  // Ref to track if effect has already run for this book (prevents React Strict Mode issues)
  const effectRunRef = useRef<Set<string>>(new Set());
  
  // Ref for stable toast function reference
  const toastRef = useRef(toast);
  
  // Ref to track if view has already been tracked for current book
  const viewTrackedRef = useRef<Set<string>>(new Set());
  
  // Ref to track if data is currently being fetched for this book
  const isFetchingRef = useRef<Set<string>>(new Set());
  
  // Ref to track if reading progress is currently being fetched for this book
  const progressFetchInProgressRef = useRef<Set<string>>(new Set());
  
  // Update toast ref when toast changes
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  // Fetch book data and comments/reviews
  useEffect(() => {
    // Prevent duplicate effects from running
    if (!bookId) {
      return;
    }
    
    // Special handling: if no user, don't block future executions
    if (!user) {
      // Remove book from fetching set to allow re-execution when user loads
      isFetchingRef.current.delete(bookId);
      return;
    }
    
    // For authenticated users, use user+book combination tracking
    const userBookKey = `${bookId}-${user.id}`;
    
    if (effectRunRef.current.has(userBookKey)) {
      return;
    }
    
    if (isFetchingRef.current.has(bookId)) {
      return;
    }
    
    // Additional check for React Strict Mode and duplicate progress requests
    if (progressFetchInProgressRef.current.has(bookId)) {
      return;
    }
    
    // Mark that we're now fetching this book for this user
    isFetchingRef.current.add(bookId);
    effectRunRef.current.add(userBookKey);
    
    const fetchBookData = async () => {
      if (!bookId) return;
      
      try {
        // Skip tracking if already tracked for this bookId to prevent double counting in React Strict Mode
        if (viewTrackedRef.current.has(bookId)) {
          // Just fetch the data without tracking
          try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            
            // Fetch book data
            const bookResponse = await fetch(`/api/books/${bookId}`, {
              headers: token ? {
                'Authorization': `Bearer ${token}`,
              } : {},
            });
            
            if (!bookResponse.ok) {
              throw new Error('Failed to fetch book data');
            }
            
            const bookData = await bookResponse.json();
            setBook(bookData);
            setLocalReactions(bookData.reactions || []); // Set reactions from book data
            
            // Use embedded reading progress if available, otherwise fetch separately
            if (bookData.readingProgress) {
              setReadingProgress(bookData.readingProgress);
            } else if (token && !progressFetchInProgressRef.current.has(bookId)) {
              // Prevent duplicate progress requests
              progressFetchInProgressRef.current.add(bookId);
              try {
                const progressResponse = await fetch(`/api/books/${bookId}/reading-progress`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                
                if (progressResponse.ok) {
                  const progressData = await progressResponse.json();
                  // Only set progress if there's actual reading progress (percentage > 0)
                  if (progressData.percentage > 0) {
                    setReadingProgress(progressData);
                  }
                }
              } catch (error) {
                console.error('Error fetching reading progress:', error);
              } finally {
                progressFetchInProgressRef.current.delete(bookId);
              }
            } else if (token) {
              // Skipping progress fetch - already in progress
            }
            
            // Fetch comments and reviews in a single call
            await fetchCommentsAndReviews();
          } catch (err) {
            console.error('Error fetching book data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load book');
            toastRef.current({
              title: t('books:error'),
              description: t('books:failedToLoad'),
              variant: "destructive",
            });
          } finally {
            setLoading(false);
            // Remove from fetching set when complete
            isFetchingRef.current.delete(bookId);
          }
          return;
        }
        
        try {
          setLoading(true);
          const token = localStorage.getItem('authToken');
          
          // Fetch book data
          const bookResponse = await fetch(`/api/books/${bookId}`, {
            headers: token ? {
              'Authorization': `Bearer ${token}`,
            } : {},
          });
          
          if (!bookResponse.ok) {
            throw new Error('Failed to fetch book data');
          }
          
          const bookData = await bookResponse.json();
          setBook(bookData);
          setLocalReactions(bookData.reactions || []); // Set reactions from book data
          
          // Use embedded reading progress if available, otherwise fetch separately
          if (bookData.readingProgress) {
            setReadingProgress(bookData.readingProgress);
          } else if (token && !progressFetchInProgressRef.current.has(bookId)) {
            // Prevent duplicate progress requests
            progressFetchInProgressRef.current.add(bookId);
            try {
              const progressResponse = await fetch(`/api/books/${bookId}/reading-progress`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (progressResponse.ok) {
                const progressData = await progressResponse.json();
                // Only set progress if there's actual reading progress (percentage > 0)
                if (progressData.percentage > 0) {
                  setReadingProgress(progressData);
                }
              }
            } catch (error) {
              console.error('Error fetching reading progress:', error);
            } finally {
              progressFetchInProgressRef.current.delete(bookId);
            }
          }
          
          // Fetch comments and reviews in a single call
          await fetchCommentsAndReviews();
          
          // Track card view (where reviews and comments are shown)
          // Mark as tracked to prevent double counting in React Strict Mode
          viewTrackedRef.current.add(bookId);
          
          // Only track view if user is authenticated
          if (token) {
            try {
              const trackResponse = await fetch(`/api/books/${bookId}/track-view`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ viewType: 'card_view' }),
              });
              
              if (!trackResponse.ok) {
                console.error('Failed to track book view:', await trackResponse.json());
              }
            } catch (trackErr) {
              console.error('Error tracking book view:', trackErr);
            }
          }
        } catch (err) {
          console.error('Error fetching book data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load book');
          toastRef.current({
            title: t('books:error'),
            description: t('books:failedToLoad'),
            variant: "destructive",
          });
        } finally {
          setLoading(false);
          // Remove from fetching set when complete
          isFetchingRef.current.delete(bookId);
        }
      } finally {
        // Ensure we always remove from fetching set
        isFetchingRef.current.delete(bookId);
      }
    };
    
    fetchBookData();
  }, [bookId, user]);
  
  // Subscribe to book reaction updates via WebSocket
  useEffect(() => {
    if (bookId) {
      // Join the book reactions room
      joinBookReactions(bookId);
      
      // Listen for reaction updates
      const cleanupReactionAdded = onSocketEvent('book-reaction-added', (data) => {
        if (data.bookId === bookId) {
          // Update both local reactions and book state when a reaction is added
          // Only update if the reaction data is different from current state
          setLocalReactions(prevReactions => {
            if (JSON.stringify(prevReactions) !== JSON.stringify(data.reactions)) {
              if (book) {
                setBook({
                  ...book,
                  reactions: data.reactions
                });
              }
              return data.reactions;
            }
            return prevReactions;
          });
        }
      });
      
      const cleanupReactionRemoved = onSocketEvent('book-reaction-removed', (data) => {
        if (data.bookId === bookId) {
          // Update both local reactions and book state when a reaction is removed
          // Only update if the reaction data is different from current state
          setLocalReactions(prevReactions => {
            if (JSON.stringify(prevReactions) !== JSON.stringify(data.reactions)) {
              if (book) {
                setBook({
                  ...book,
                  reactions: data.reactions
                });
              }
              return data.reactions;
            }
            return prevReactions;
          });
        }
      });
      
      // Cleanup function to leave the room and remove listeners
      return () => {
        leaveBookReactions(bookId);
        cleanupReactionAdded();
        cleanupReactionRemoved();
      };
    }
  }, [bookId, book]);
  
  const handleAddComment = async () => {
    if (newComment.trim() && book) {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch(`/api/books/${book.id}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: newComment }),
        });
        
        if (response.ok) {
          const commentData = await response.json();
          // Add to local state
          setBookComments(prev => [commentData, ...prev]);
          setNewComment('');
          toast({
            title: t('books:commentAdded'),
            description: t('books:commentAddedSuccess'),
          });
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add comment');
        }
      } catch (err) {
        console.error('Error adding comment:', err);
        toast({
          title: t('books:error'),
          description: err instanceof Error ? err.message : t('books:failedToAddComment'),
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Check if user is admin or moderator to use admin endpoint
      const isAdminOrModerator = user?.accessLevel === 'admin' || user?.accessLevel === 'moder';
      const endpoint = isAdminOrModerator ? `/api/admin/comments/${commentId}` : `/api/comments/${commentId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Remove from local state
        setBookComments(prev => prev.filter(comment => comment.id !== commentId));
        toast({
          title: t('books:commentDeleted'),
          description: t('books:commentDeletedSuccess'),
        });
        
        // Refresh comments and reviews to ensure proper state
        await fetchCommentsAndReviewsOnce();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete comment');
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToDeleteComment'),
        variant: "destructive",
      });
    }
  };
  
  const handleAddReview = async () => {
    if (newReview.trim() && book) {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch(`/api/books/${book.id}/reviews`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: newReview,
            rating: reviewRating
          }),
        });
        
        if (response.ok) {
          const reviewData = await response.json();
          // Add to local state
          setBookReviews(prev => [reviewData, ...prev]);
          setNewReview('');
          setReviewRating(5);
          
          // Refresh book data to update rating
          const bookResponse = await fetch(`/api/books/${book.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (bookResponse.ok) {
            const updatedBookData = await bookResponse.json();
            setBook(updatedBookData);
          }
          
          toast({
            title: t('books:reviewAdded'),
            description: t('books:reviewAddedSuccess'),
          });
          
          // Refresh comments and reviews to ensure proper state
          await fetchCommentsAndReviewsOnce();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add review');
        }
      } catch (err) {
        console.error('Error adding review:', err);
        toast({
          title: t('books:error'),
          description: err instanceof Error ? err.message : t('books:failedToAddReview'),
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Check if user is admin or moderator to use admin endpoint
      const isAdminOrModerator = user?.accessLevel === 'admin' || user?.accessLevel === 'moder';
      const endpoint = isAdminOrModerator ? `/api/admin/reviews/${reviewId}` : `/api/reviews/${reviewId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Remove from local state
        setBookReviews(prev => prev.filter(review => review.id !== reviewId));
        
        // Refresh book data to update rating
        if (book) {
          const bookResponse = await fetch(`/api/books/${book.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (bookResponse.ok) {
            const updatedBookData = await bookResponse.json();
            setBook(updatedBookData);
          }
        }
        
        toast({
          title: t('books:reviewDeleted'),
          description: t('books:reviewDeletedSuccess'),
        });
        
        // Refresh comments and reviews to ensure proper state
        await fetchCommentsAndReviewsOnce();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete review');
      }
    } catch (err) {
      console.error('Error deleting review:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToDeleteReview'),
        variant: "destructive",
      });
    }
  };
  
  const handleReactToComment = async (commentId: string, emoji: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          commentId,
          emoji
        }),
      });
      
      if (response.ok) {
        // Refresh comments and reviews to get updated reactions
        await fetchCommentsAndReviewsOnce();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reaction');
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToAddReaction'),
        variant: "destructive",
      });
    }
  };
  
  const handleReactToReview = async (reviewId: string, emoji: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reviewId,
          emoji
        }),
      });
      
      if (response.ok) {
        // Refresh comments and reviews to get updated reactions
        await fetchCommentsAndReviewsOnce();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reaction');
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToAddReaction'),
        variant: "destructive",
      });
    }
  };

  const handleToggleShelf = async (shelfId: string, bookId: string, isAdded: boolean) => {
    try {
      if (isAdded) {
        // Check if book is already in shelf
        const shelf = shelves.find(s => s.id === shelfId);
        if (shelf && shelf.bookIds?.includes(bookId)) {
          return;
        }
        
        await addBookToShelf(shelfId, bookId);
        
        toast({
          title: t('books:bookAdded'),
          description: t('books:bookAddedToShelf'),
        });
      } else {
        await removeBookFromShelf(shelfId, bookId);
        
        toast({
          title: t('books:bookRemoved'),
          description: t('books:bookRemovedFromShelf'),
        });
      }
    } catch (err) {
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToUpdateShelf'),
        variant: "destructive",
      });
    }
  };

  // Handle "Read Now" click with transition splash
  const handleReadNow = () => {
    if (!book) return;
    showSplash({
      id: book.id,
      title: book.title,
      author: book.author,
      coverImageUrl: book.videoCoverUrl || book.coverImageUrl, // Use video cover if available, otherwise image cover
      description: book.description,
      rating: book.rating,
    });
    // Navigate after delay to let splash appear and be visible
    setTimeout(() => {
      setLocation(`/read/${book.id}/1`);
    }, 400);
  };

  const handleDeleteBook = async () => {
    if (!book || !user) return;
    
    // Confirm deletion
    if (!window.confirm(t('books:confirmDelete'))) {
      return;
    }
    
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Use booksApi.deleteBook which bypasses Vite proxy in development
      const response = await booksApi.deleteBook(book.id);
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete book';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response might not be JSON
        }
        throw new Error(errorMessage);
      }
      
      // Show success message
      toast({
        title: t('books:bookDeleted'),
        description: t('books:bookDeletedSuccess'),
      });
      
      // Redirect to shelves page after successful deletion
      window.location.href = '/shelves';
    } catch (err) {
      console.error('Error deleting book:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToDeleteBook'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle book reaction
  const handleBookReact = async (emoji: string) => {
    if (!user) {
      toast({
        title: t('books:error'),
        description: t('books:loginRequired'),
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/books/${book?.id}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Just wait for the WebSocket event to update the state
        // The optimistic update has been removed to prevent conflicts
        // The WebSocket event will update the state after the API call completes
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reaction');
      }
    } catch (err) {
      console.error('Error adding book reaction:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToAddReaction'),
        variant: "destructive",
      });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('books:loadingBook')}</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{t('books:loadError')}</h2>
          <p className="text-muted-foreground mb-4">{error || t('books:failedToLoad')}</p>
          <Link href="/library">
            <Button>{t('books:backToLibrary')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Book Card - Matching the design from library */}
        <Card className="overflow-hidden mb-8">
          <div className="flex flex-col md:flex-row">
            {/* Book Cover and Buttons Column */}
            <div className="w-full md:w-64 flex flex-col">
              {/* Book Cover */}
              <div className="h-96 relative flex-shrink-0">
                {book.videoCoverUrl ? (
                  <video 
                    src={book.videoCoverUrl?.startsWith('http') ? book.videoCoverUrl : book.videoCoverUrl?.startsWith('/') ? book.videoCoverUrl : `/${book.videoCoverUrl}`} 
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                  />
                ) : book.coverImageUrl ? (
                  <img 
                    src={
                      book.coverImageUrl?.startsWith('http')
                        ? book.coverImageUrl
                        : book.coverImageUrl
                        ? book.coverImageUrl.startsWith('/')
                          ? book.coverImageUrl
                          : `/${book.coverImageUrl}`
                        : ''
                    } 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center`}>
                    <BookOpen className="w-16 h-16 text-white/30" />
                  </div>
                )}
              </div>
              
              {/* Buttons positioned under the cover image */}
              <div className="p-4 flex flex-col gap-3">
                <Button className="gap-2 w-full text-black" onClick={handleReadNow}
                  style={{ backgroundColor: '#ffe3af', border: '1px solid #979797' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffd995'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffe3af'}>
                  <Play className="w-4 h-4" />
                  {t('books:readNow')}
                </Button>
                
                {/* Reading Progress Display */}
                {readingProgress && readingProgress.percentage > 0 && (
                  <div className="mt-1 mb-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{t('books:progress')}</span>
                      <span>{Math.round(readingProgress.percentage)}%</span>
                    </div>
                    <Progress value={readingProgress.percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{readingProgress.currentPage} {t('books:of')} {readingProgress.totalPages} {t('books:pages')}</span>
                      {readingProgress.lastReadAt && (
                        <span>{t('books:lastRead')}: {new Date(readingProgress.lastReadAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}
                
                <AddToShelfDialog 
                  bookId={book.id}
                  shelves={shelves}
                  onToggleShelf={handleToggleShelf}
                  trigger={
                    <Button variant="outline" className="gap-2 w-full"
                      style={{ backgroundColor: '#ffedb2', border: '1px solid #979797' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffe499'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffedb2'}>
                      <Plus className="w-4 h-4" />
                      {t('books:addToMyShelves')}
                    </Button>
                  }
                />
                
                {/* Delete button - only show if the current user is the uploader */}
                {book.userId === user?.id && (
                  <Button 
                    variant="outline" 
                    className="gap-2 w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    onClick={handleDeleteBook}
                    disabled={isDeleting}
                  >
                    <Trash className="w-4 h-4" />
                    {isDeleting ? t('books:deleting') : t('books:delete')}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Book Info */}
            <div className="flex-1">
              <CardHeader className="p-6 pb-4">
                <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">{book.title}</h1>
                <p className="text-lg text-muted-foreground mb-4">{t('books:authorLabel')}: {book.author}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {book.genre && book.genre.split(',').map((g, index) => (
                    <Badge key={index} variant="secondary" className="text-xs" style={{ backgroundColor: '#ffe69e' }}>
                      {g.trim()}
                    </Badge>
                  ))}
                </div>
                
                {/* Book Reactions - after description and genres */}
                <div className="mb-4">
                  <ReactionBar 
                    key={`reaction-bar-${book.id}-${localReactions.map(r => r.emoji).sort().join('-')}-${localReactions.reduce((sum, r) => sum + r.count, 0)}`}
                    reactions={localReactions} 
                    onReact={handleBookReact}
                    bookId={book.id}
                  />
                </div>
              </CardHeader>
              
              <CardContent className="px-6 py-0">
                {book.rating && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      <div className="flex">
                        {[...Array(10)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-5 h-5 ${i < Math.floor(book.rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                          />
                        ))}
                      </div>
                      <span className="font-medium ml-2">{book.rating}/10 [{book.reviewCount || 0}]</span>
                    </div>
                  </div>
                )}
                
                <p className="text-foreground/90 mb-6 leading-relaxed whitespace-pre-line">
                  {book.description || t('books:noDescription')}
                </p>
              </CardContent>
              
              {/* Book statistics */}
              <CardContent className="px-6 pt-0 pb-2">
                <div className="space-y-1 mb-4">
                  {book.publishedAt && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{t('books:published')}: {book.publishedAt ? formatDate(book.publishedAt) : ''}</span>
                    </div>
                  )}
                  
                  {book.uploadedAt && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="w-3 h-3 mr-1" />
                      <span>{t('books:added')}: {book.uploadedAt ? formatDate(book.uploadedAt) : ''}</span>
                    </div>
                  )}
                  
                  {typeof book.shelfCount === 'number' && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <span className="mr-1">📚</span>
                      <span>{t('books:addedToShelf')}: {book.shelfCount}</span>
                    </div>
                  )}
                  
                  {book.cardViewCount !== undefined && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <span>👁️ {book.cardViewCount} {t('books:cardViews')}</span>
                    </div>
                  )}
                  
                  {book.readerOpenCount !== undefined && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <span>📖 {book.readerOpenCount} {t('books:readerOpens')}</span>
                    </div>
                  )}
                  
                  {book.lastActivityDate && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <Activity className="w-3 h-3 mr-1" />
                      <span>{t('books:lastActivity')}: {book.lastActivityDate ? formatDate(book.lastActivityDate) : ''}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              

            </div>
          </div>
        </Card>
        

        
        {/* Tabs for Comments and Reviews */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3" style={{ backgroundColor: '#ffedbb' }}>
              <TabsTrigger value="comments">{t('books:commentCount')} ({totalCommentCount})</TabsTrigger>
              <TabsTrigger value="reviews">{t('books:reviewCount')} ({bookReviews.length})</TabsTrigger>
              <TabsTrigger value="articles" className="gap-2">
                Статьи
                <span className="ml-1 inline-flex min-w-[24px] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {articlesTotal === null ? "…" : articlesTotal}
                </span>
              </TabsTrigger>
            </TabsList>
            {/* Comments Tab */}
            <TabsContent value="comments" className="mt-0">
              <CardContent className="pt-4">
                <CommentsSection 
                  bookId={bookId} 
                  onCommentsCountChange={(count) => setTotalCommentCount(count)}
                  onSwitchToReviewsTab={() => setActiveTab('reviews')}
                />
              </CardContent>
            </TabsContent>
            
            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-0">
              <CardContent className="pt-4">
                <ReviewsSection 
                  bookId={bookId}
                  onReviewsCountChange={(count) => setBookReviews(prev => {
                    // Only update state without triggering refetch
                    return prev;
                  })}
                  onBookRatingChange={(newRating) => {
                    if (book) {
                      setBook({ ...book, rating: newRating || undefined });
                    }
                  }}
                />
              </CardContent>
            </TabsContent>
            
            {/* Articles Tab */}
            <TabsContent value="articles" className="mt-0">
              <CardContent className="pt-4">
                <BookArticlesTab bookId={bookId} onTotalChange={setArticlesTotal} />
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}