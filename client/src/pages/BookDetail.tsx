import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import * as MockData from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  Download
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReactionBar } from '@/components/ReactionBar';
import { PageHeader } from '@/components/PageHeader';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { CommentsSection } from '@/components/CommentsSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { useToast } from '@/hooks/use-toast';
import { useShelves } from '@/hooks/useShelves';
import { useAuth } from '@/lib/auth';
import { useBook } from '@/hooks/useBooks';
import { setCachedComments, setCachedReviews, getPendingRequest, trackPendingRequest } from '@/lib/dataCache';

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
  uploadedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  reviewCount?: number;
}

export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { shelves, addBookToShelf, removeBookFromShelf } = useShelves();
  
  // Use the real book hook instead of mock data
  const { book, loading, error, refresh } = useBook(bookId);
  
  // Form states for comments and reviews
  const [newComment, setNewComment] = useState('');
  const [newReview, setNewReview] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  
  // Comment and review counts
  const [commentsCount, setCommentsCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  
  // Book rating state
  const [bookRating, setBookRating] = useState<number | null>(book?.rating || null);
  
  // Fetch full comment and review data when book changes
  useEffect(() => {
    // Check if there are already pending requests for this book
    const pendingCommentsRequest = getPendingRequest('comments', bookId);
    const pendingReviewsRequest = getPendingRequest('reviews', bookId);
    
    if (pendingCommentsRequest || pendingReviewsRequest) {
      // Wait for pending requests to complete
      Promise.all([
        pendingCommentsRequest || Promise.resolve(),
        pendingReviewsRequest || Promise.resolve()
      ]).then(([commentsData, reviewsData]) => {
        if (commentsData) {
          setCommentsCount(commentsData.length);
        }
        if (reviewsData) {
          setReviewsCount(reviewsData.length);
        }
      }).catch(err => {
        console.error('Error waiting for pending requests:', err);
      });
      return;
    }

    const fetchData = async () => {
      if (!bookId) return;
      
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        
        // Track comments request
        const commentsPromise = trackPendingRequest('comments', bookId, fetch(`/api/books/${bookId}/comments`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to fetch comments');
        }));
        
        // Track reviews request
        const reviewsPromise = trackPendingRequest('reviews', bookId, fetch(`/api/books/${bookId}/reviews`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to fetch reviews');
        }));
        
        // Wait for both requests
        const [commentsResponse, reviewsResponse] = await Promise.allSettled([commentsPromise, reviewsPromise]);
        
        if (commentsResponse.status === 'fulfilled') {
          const commentsData = commentsResponse.value;
          setCommentsCount(commentsData.length);
          // Cache the comments data
          setCachedComments(bookId, commentsData);
        }
        
        if (reviewsResponse.status === 'fulfilled') {
          const reviewsData = reviewsResponse.value;
          setReviewsCount(reviewsData.length);
          // Cache the reviews data
          setCachedReviews(bookId, reviewsData);
        }
        
        // Return promises for potential pending request handlers
        return {
          comments: commentsResponse.status === 'fulfilled' ? commentsResponse.value : null,
          reviews: reviewsResponse.status === 'fulfilled' ? reviewsResponse.value : null
        };
      } catch (err) {
        console.error('Error fetching comment/review data:', err);
        throw err;
      }
    };
    
    if (bookId) {
      // Track this request to prevent duplicates
      const trackedRequest = trackPendingRequest('book-data', bookId, fetchData());
      trackedRequest.catch(() => {}); // Prevent unhandled promise rejection
    }
  }, [bookId]);
  
  // Update bookRating when book prop changes
  useEffect(() => {
    if (book) {
      setBookRating(book.rating || null);
    }
  }, [book]);
  
  // For reading stats
  const [readingProgress, setReadingProgress] = useState<number | null>(null);
  const [timeSpent, setTimeSpent] = useState<number | null>(null);
  const [lastRead, setLastRead] = useState<Date | null>(null);
  


  
  const handleDownload = async () => {
    if (!book?.filePath) {
      toast({
        title: "Ошибка",
        description: "Файл книги недоступен для скачивания",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // In a real implementation, this would download the actual file
      // For now, we'll just show a message
      toast({
        title: "Скачивание",
        description: "Файл книги готов к скачиванию",
      });
      
      // Simulate download
      const link = document.createElement('a');
      link.href = `/api/books/${book.id}/download`;
      link.download = `${book.title}.${book.fileType?.split('/')[1] || 'txt'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скачать файл книги",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleShelf = async (shelfId: string, bookId: string, isAdded: boolean) => {
    try {
      if (isAdded) {
        await addBookToShelf(shelfId, bookId);
        toast({
          title: "Успех",
          description: "Книга добавлена на полку",
        });
      } else {
        await removeBookFromShelf(shelfId, bookId);
        toast({
          title: "Успех",
          description: "Книга удалена с полки",
        });
      }
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось обновить полку",
        variant: "destructive",
      });
    }
  };
  

  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Format bytes to human readable format
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Russian pluralization for "голос" (vote)
  const formatVotesCount = (count: number) => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    
    // Exceptions for 11-19
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return `${count} голосов`;
    }
    
    // 1 vote
    if (lastDigit === 1) {
      return `${count} голос`;
    }
    
    // 2-4 votes
    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${count} голоса`;
    }
    
    // 5-9, 0 votes
    return `${count} голосов`;
  };
  
  // Get book dates - using created_at as fallback for uploaded_at
  const uploadedAt = book?.uploadedAt || book?.createdAt;
  const publishedAt = book?.publishedAt;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !book) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-destructive mb-4">Ошибка загрузки информации о книге</p>
              <Button onClick={() => window.location.reload()}>
                Повторить попытку
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        
        <Card className="overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Cover Image */}
            <div className="md:w-1/3">
              <div className="h-full sticky top-8 p-6">
                {book.coverImageUrl ? (
                  <img 
                    src={book.coverImageUrl.startsWith('http') ? book.coverImageUrl : `http://localhost:5001/${book.coverImageUrl.startsWith('/') ? book.coverImageUrl.substring(1) : book.coverImageUrl}`} 
                    alt={book.title}
                    className="w-full rounded-lg shadow-lg object-cover aspect-[2/3]"
                  />
                ) : (
                  <div className="w-full rounded-lg shadow-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center aspect-[2/3]">
                    <BookOpen className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                
                <div className="mt-6 space-y-3">
                  <Button className="w-full gap-2" asChild>
                    <Link href={`/reader/${book.id}`}>
                      <Play className="w-4 h-4" />
                      Читать
                    </Link>
                  </Button>
                  
                  {book.filePath && (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4" />
                      Скачать
                    </Button>
                  )}
                  
                  {user && (
                    <AddToShelfDialog 
                      bookId={book.id}
                      shelves={shelves.map(s => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        bookIds: s.bookIds || [],
                        color: s.color
                      }))}
                      onToggleShelf={(shelfId, bookId, isAdded) => handleToggleShelf(shelfId, bookId, isAdded)}
                      trigger={
                        <Button variant="outline" className="w-full gap-2 truncate">
                          <Plus className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">Добавить на полку</span>
                        </Button>
                      }
                    />
                  )}
                </div>
                
                {/* Reading Stats */}
                {(readingProgress !== null || timeSpent !== null || lastRead !== null) && (
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Ваши достижения
                    </h3>
                    <div className="space-y-2 text-sm">
                      {readingProgress !== null && (
                        <div className="flex justify-between">
                          <span>Прогресс:</span>
                          <span className="font-medium">{readingProgress}%</span>
                        </div>
                      )}
                      {timeSpent !== null && (
                        <div className="flex justify-between">
                          <span>Время чтения:</span>
                          <span className="font-medium">{Math.round(timeSpent / 60)} мин</span>
                        </div>
                      )}
                      {lastRead && (
                        <div className="flex justify-between">
                          <span>Последнее чтение:</span>
                          <span className="font-medium">{formatDistanceToNow(lastRead, { addSuffix: true, locale: ru })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Main Content with Tabs */}
            <div className="md:w-2/3 border-l">
              <div className="pt-6">
                <h1 className="text-2xl font-bold px-6 mb-6">{book.title}</h1>
                <CardContent className="space-y-6 pt-0">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-5 h-5 ${i < Math.floor((bookRating || 0) / 2) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-lg font-medium">{(bookRating || 0).toFixed(1)}/10</span>
                      <span className="text-muted-foreground text-sm">({formatVotesCount(reviewsCount)})</span>
                    </div>
                    
                    <p className="text-muted-foreground">{book.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Автор</h3>
                      <p className="font-medium">{book.author}</p>
                    </div>
                    
                    {book.genre && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Жанры</h3>
                        <div className="flex flex-wrap gap-2">
                          {book.genre.split(',').map((g: string, i: number) => (
                            <Badge key={i} variant="secondary">
                              {g.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Дата публикации</h3>
                      <p>{publishedAt ? formatDate(publishedAt) : 'Не указана'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Добавлено</h3>
                      <p>{uploadedAt ? formatDate(uploadedAt) : 'Не указана'}</p>
                    </div>
                    
                    {book.publishedYear && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Год издания</h3>
                        <p>{book.publishedYear}</p>
                      </div>
                    )}
                    
                    {book.fileSize && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Размер файла</h3>
                        <p>{formatFileSize(book.fileSize)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
              

            </div>
          </div>
        </Card>
        
        {/* Comments and Reviews Section */}
        <div className="mt-8">
          <Card>
            <Tabs defaultValue="comments">
              <CardHeader className="pb-0">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                  <TabsTrigger value="comments" className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Комментарии ({commentsCount})
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Рецензии ({reviewsCount})
                    </div>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-6">
                <TabsContent value="comments" className="mt-0">
                  <CommentsSection 
                    bookId={bookId} 
                    onCommentsCountChange={setCommentsCount}
                  />
                </TabsContent>
                <TabsContent value="reviews" className="mt-0">
                  <ReviewsSection 
                    bookId={bookId} 
                    onReviewsCountChange={setReviewsCount}
                    onBookRatingChange={setBookRating}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}