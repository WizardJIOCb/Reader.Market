import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import * as MockData from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { useToast } from '@/hooks/use-toast';
import { useShelves } from '@/hooks/useShelves';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

// Define the Book interface to match our database schema
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
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
  
  // State for comments and reviews
  const [bookComments, setBookComments] = useState<Comment[]>([]);
  const [bookReviews, setBookReviews] = useState<Review[]>([]);
  
  // State for new comment/review
  const [newComment, setNewComment] = useState('');
  const [newReview, setNewReview] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  
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
  

  // Ref for stable toast function reference
  const toastRef = useRef(toast);
  
  // Ref to track if view has already been tracked for current book
  const viewTrackedRef = useRef<Set<string>>(new Set());
  
  // Ref to track if data is currently being fetched for this book
  const isFetchingRef = useRef<Set<string>>(new Set());
  
  // Update toast ref when toast changes
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  // Fetch book data and comments/reviews
  useEffect(() => {
    const fetchBookData = async () => {
      if (!bookId) return;
      
      // Prevent duplicate fetches for the same book
      if (isFetchingRef.current.has(bookId)) {
        return; // Already fetching this book, skip
      }
      
      // Mark that we're now fetching this book
      isFetchingRef.current.add(bookId);
      
      try {
        // Skip tracking if already tracked for this bookId to prevent double counting in React Strict Mode
        if (viewTrackedRef.current.has(bookId)) {
          // Just fetch the data without tracking
          try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            if (!token) {
              throw new Error('No authentication token found');
            }
            
            // Fetch book data
            const bookResponse = await fetch(`/api/books/${bookId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!bookResponse.ok) {
              throw new Error('Failed to fetch book data');
            }
            
            const bookData = await bookResponse.json();
            setBook(bookData);
            
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
          if (!token) {
            throw new Error('No authentication token found');
          }
          
          // Fetch book data
          const bookResponse = await fetch(`/api/books/${bookId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!bookResponse.ok) {
            throw new Error('Failed to fetch book data');
          }
          
          const bookData = await bookResponse.json();
          setBook(bookData);
          
          // Fetch comments and reviews in a single call
          await fetchCommentsAndReviews();
          
          // Track card view (where reviews and comments are shown)
          // Mark as tracked to prevent double counting in React Strict Mode
          viewTrackedRef.current.add(bookId);
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
  }, [bookId]);
  
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
        if (shelf && shelf.bookIds.includes(bookId)) {
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
      
      const response = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete book');
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
                {book.coverImageUrl ? (
                  <img 
                    src={book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl} 
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
                <Link href={`/read/${book.id}/1`}>
                  <Button className="gap-2 w-full">
                    <Play className="w-4 h-4" />
                    {t('books:readNow')}
                  </Button>
                </Link>
                
                <AddToShelfDialog 
                  bookId={book.id}
                  shelves={shelves}
                  onToggleShelf={handleToggleShelf}
                  trigger={
                    <Button variant="outline" className="gap-2 w-full">
                      <Plus className="w-4 h-4" />
                      {t('books:addToMyShelves')}
                    </Button>
                  }
                />
                
                {/* Delete button - only show if the current user is the uploader */}
                {book.userId === user?.id && (
                  <Button 
                    variant="destructive" 
                    className="gap-2 w-full"
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
                    <Badge key={index} variant="secondary">
                      {g.trim()}
                    </Badge>
                  ))}
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
                
                <p className="text-foreground/90 mb-6 leading-relaxed">
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
                      <Bookmark className="w-3 h-3 mr-1" />
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
          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comments">{t('books:commentCount')} ({bookComments.length})</TabsTrigger>
              <TabsTrigger value="reviews">{t('books:reviewCount')} ({bookReviews.length})</TabsTrigger>
            </TabsList>
            
            {/* Comments Tab */}
            <TabsContent value="comments" className="mt-0">
              <CardContent className="space-y-6 pt-4">
                {/* Add Comment Form */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">{t('books:addComment')}</h4>
                  <div className="space-y-4">
                    <Textarea 
                      placeholder={t('books:commentPlaceholder')} 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleAddComment} className="gap-2">
                        <Send className="w-4 h-4" />
                        {t('books:send')}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {bookComments.map(comment => (
                  <div key={comment.id} className="border-b pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        {comment.avatarUrl ? (
                          <AvatarImage src={comment.avatarUrl} alt={comment.author} />
                        ) : null}
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {comment.userId ? (
                            <a
                              href={`/profile/${comment.userId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sm text-primary hover:underline"
                            >
                              {comment.author}
                            </a>
                          ) : (
                            <p className="font-medium text-sm">{comment.author}</p>
                          )}
                          {user?.id && (((comment.userId === user.id) ||
                            (comment.author && user.fullName && comment.author.includes(user.fullName)) ||
                            (comment.author && user.username && comment.author.includes(user.username))) ||
                            (user.accessLevel === 'admin' || user.accessLevel === 'moder')) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground cursor-help mb-3">
                                {formatDateDisplay(comment.createdAt)}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className="text-foreground/90 mb-3">{comment.content}</p>
                        <ReactionBar 
                          reactions={comment.reactions} 
                          onReact={(emoji) => handleReactToComment(comment.id, emoji)} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </TabsContent>
            
            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-0">
              <CardContent className="space-y-6 pt-4">
                {
                  (() => {
                    // Check if user has already reviewed - using a more robust approach
                    const userHasReviewed = user?.id ? bookReviews.some(review => {
                      // Direct userId comparison (most reliable)
                      if (review.userId && user.id) {
                        return review.userId === user.id;
                      }
                      // Fallback: check by author name
                      if (review.author && user.fullName) {
                        return review.author.includes(user.fullName);
                      }
                      if (review.author && user.username) {
                        return review.author.includes(user.username);
                      }
                      return false;
                    }) : false;
                    
                    // Sort reviews: user's review first, then others by date (newest first)
                    const sortedReviews = [...bookReviews].sort((a, b) => {
                      const isAUserReview = user?.id ? (a.userId === user.id || 
                                          (a.author && user.fullName && a.author.includes(user.fullName)) ||
                                          (a.author && user.username && a.author.includes(user.username))) : false;
                      const isBUserReview = user?.id ? (b.userId === user.id || 
                                          (b.author && user.fullName && b.author.includes(user.fullName)) ||
                                          (b.author && user.username && b.author.includes(user.username))) : false;
                      
                      // If one is user's review and the other isn't, user's review comes first
                      if (isAUserReview && !isBUserReview) return -1;
                      if (isBUserReview && !isAUserReview) return 1;
                      
                      // If both are user's reviews or both are others, sort by date (newest first)
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });
                    
                    return (
                      <>
                        {/* Add Review Form - only show if user hasn't reviewed yet */}
                        {!userHasReviewed && (
                          <div className="pt-4 border-t mt-4">
                            <h4 className="font-medium mb-3">{t('books:writeReview')}</h4>
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{t('books:ratingLabel')}:</span>
                                <div className="flex">
                                  {[...Array(10)].map((_, i) => (
                                    <button
                                      key={i}
                                      onClick={() => setReviewRating(i + 1)}
                                      className="p-1"
                                    >
                                      <Star 
                                        className={`w-5 h-5 ${
                                          i < reviewRating 
                                            ? 'fill-yellow-400 text-yellow-400' 
                                            : 'text-muted-foreground'
                                        }`} 
                                      />
                                    </button>
                                  ))}
                                </div>
                                <span className="text-sm font-medium">{reviewRating}/10</span>
                              </div>
                              <Textarea 
                                placeholder={t('books:reviewPlaceholder')} 
                                value={newReview}
                                onChange={(e) => setNewReview(e.target.value)}
                                rows={5}
                              />
                              <div className="flex justify-end">
                                <Button onClick={handleAddReview} className="gap-2">
                                  <Send className="w-4 h-4" />
                                  {t('books:publish')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {sortedReviews.map(review => (
                          <div key={review.id} className="border-b pb-6 last:border-0 last:pb-0">
                            <div className="flex items-start gap-3">
                              <Avatar className="w-10 h-10">
                                {review.avatarUrl ? (
                                  <AvatarImage src={review.avatarUrl} alt={review.author} />
                                ) : null}
                                <AvatarFallback>
                                  <User className="w-5 h-5" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {review.userId ? (
                                    <a
                                      href={`/profile/${review.userId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-sm text-primary hover:underline"
                                    >
                                      {review.author}
                                    </a>
                                  ) : (
                                    <p className="font-medium text-sm">{review.author}</p>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-medium">{review.rating}/10</span>
                                  </div>
                                  {user?.id && (((review.userId === user.id) ||
                                    (review.author && user.fullName && review.author.includes(user.fullName)) ||
                                    (review.author && user.username && review.author.includes(user.username))) ||
                                    (user.accessLevel === 'admin' || user.accessLevel === 'moder')) && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteReview(review.id)}
                                    >
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-xs text-muted-foreground cursor-help mb-3">
                                        {formatDateDisplay(review.createdAt)}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{format(new Date(review.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <p className="text-foreground/90 mb-3">{review.content}</p>
                                <ReactionBar 
                                  reactions={review.reactions} 
                                  onReact={(emoji) => handleReactToReview(review.id, emoji)} 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()
                }
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}