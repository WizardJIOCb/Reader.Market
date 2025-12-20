import React, { useState, useEffect } from 'react';
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
  Trash
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReactionBar } from '@/components/ReactionBar';
import { PageHeader } from '@/components/PageHeader';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { useToast } from '@/hooks/use-toast';
import { useShelves } from '@/hooks/useShelves';
import { useAuth } from '@/lib/auth';

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
  userId: string; // Added userId field
  createdAt: string;
  updatedAt: string;
}

// Define comment and review interfaces
interface Comment {
  id: string;
  bookId: string;
  author: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
}

interface Review {
  id: string;
  bookId: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  reactions: Reaction[];
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export default function BookDetail() {
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
  
  // Fetch book data
  useEffect(() => {
    const fetchBook = async () => {
      if (!bookId) return;
      
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
        
        // For now, we'll use mock comments and reviews
        // In a real implementation, these would be fetched from the backend
        setBookComments(MockData.mockComments.filter(c => c.bookId === parseInt(bookId) || Math.random() > 0.5));
        setBookReviews(MockData.mockReviews.filter(r => r.bookId === parseInt(bookId) || Math.random() > 0.5));
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить данные книги",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchBook();
  }, [bookId, toast]);
  
  const handleAddComment = () => {
    if (newComment.trim() && book) {
      // In a real app, this would send to backend
      console.log('Adding comment:', newComment);
      setNewComment('');
      toast({
        title: "Комментарий добавлен",
        description: "Ваш комментарий успешно добавлен!",
      });
    }
  };
  
  const handleAddReview = () => {
    if (newReview.trim() && book) {
      // In a real app, this would send to backend
      console.log('Adding review:', newReview, 'Rating:', reviewRating);
      setNewReview('');
      setReviewRating(5);
      toast({
        title: "Рецензия добавлена",
        description: "Ваша рецензия успешно добавлена!",
      });
    }
  };
  
  const handleReactToComment = (commentId: string, emoji: string) => {
    setBookComments(bookComments.map(comment => {
      if (comment.id !== commentId) return comment;

      const existingReactionIndex = comment.reactions.findIndex((r: Reaction) => r.emoji === emoji);
      let newReactions = [...comment.reactions];

      if (existingReactionIndex >= 0) {
        const reaction = newReactions[existingReactionIndex];
        if (reaction.userReacted) {
          // Unlike
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count - 1,
            userReacted: false
          };
          if (newReactions[existingReactionIndex].count === 0) {
            newReactions.splice(existingReactionIndex, 1);
          }
        } else {
          // Like existing emoji
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count + 1,
            userReacted: true
          };
        }
      } else {
        // Add new reaction
        newReactions.push({
          emoji,
          count: 1,
          userReacted: true
        });
      }

      return { ...comment, reactions: newReactions };
    }));
  };
  
  const handleReactToReview = (reviewId: string, emoji: string) => {
    setBookReviews(bookReviews.map(review => {
      if (review.id !== reviewId) return review;

      const existingReactionIndex = review.reactions.findIndex((r: Reaction) => r.emoji === emoji);
      let newReactions = [...review.reactions];

      if (existingReactionIndex >= 0) {
        const reaction = newReactions[existingReactionIndex];
        if (reaction.userReacted) {
          // Unlike
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count - 1,
            userReacted: false
          };
          if (newReactions[existingReactionIndex].count === 0) {
            newReactions.splice(existingReactionIndex, 1);
          }
        } else {
          // Like existing emoji
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count + 1,
            userReacted: true
          };
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
    }));
  };

  const handleToggleShelf = async (bookId: number | string, shelfId: string, isAdded: boolean) => {
    try {
      const bookIdStr = bookId.toString();
      
      if (isAdded) {
        // Check if book is already in shelf
        const shelf = shelves.find(s => s.id === shelfId);
        if (shelf && shelf.bookIds.includes(bookIdStr)) {
          return;
        }
        
        await addBookToShelf(shelfId, bookIdStr);
        
        toast({
          title: "Книга добавлена",
          description: "Книга успешно добавлена на полку!",
        });
      } else {
        await removeBookFromShelf(shelfId, bookIdStr);
        
        toast({
          title: "Книга удалена",
          description: "Книга удалена с полки!",
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

  const handleDeleteBook = async () => {
    if (!book || !user) return;
    
    // Confirm deletion
    if (!window.confirm('Вы уверены, что хотите удалить эту книгу? Это действие нельзя отменить.')) {
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
        title: "Книга удалена",
        description: "Книга успешно удалена из вашей библиотеки",
      });
      
      // Redirect to library page after successful deletion
      window.location.href = '/library';
    } catch (err) {
      console.error('Error deleting book:', err);
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось удалить книгу',
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
          <p>Загрузка данных книги...</p>
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
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-muted-foreground mb-4">{error || 'Не удалось загрузить данные книги'}</p>
          <Link href="/library">
            <Button>Вернуться в библиотеку</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader title="Детали книги" />
        
        {/* Book Card - Matching the design from library */}
        <Card className="overflow-hidden mb-8">
          <div className="flex flex-col md:flex-row">
            {/* Book Cover */}
            <div className="w-full md:w-64 h-96 relative">
              {book.coverImageUrl ? (
                <img 
                  src={book.coverImageUrl.startsWith('uploads/') ? `http://localhost:3000/${book.coverImageUrl}` : book.coverImageUrl} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center`}>
                  <BookOpen className="w-16 h-16 text-white/30" />
                </div>
              )}
            </div>
            
            {/* Book Info */}
            <div className="flex-1">
              <CardHeader className="p-6 pb-4">
                <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">{book.title}</h1>
                <p className="text-lg text-muted-foreground mb-4">Автор: {book.author}</p>
                
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
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-5 h-5 ${i < Math.floor(book.rating! / 2) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                          />
                        ))}
                      </div>
                      <span className="font-medium ml-2">{book.rating}</span>
                    </div>
                  </div>
                )}
                
                <p className="text-foreground/90 mb-6 leading-relaxed">
                  {book.description || 'Описание отсутствует'}
                </p>
              </CardContent>
              
              <CardFooter className="p-6 pt-0 flex flex-wrap gap-3">
                <Link href={`/read/${book.id}/1`}>
                  <Button className="gap-2">
                    <Play className="w-4 h-4" />
                    Читать сейчас
                  </Button>
                </Link>
                
                <AddToShelfDialog 
                  bookId={book.id}
                  shelves={shelves}
                  onToggleShelf={handleToggleShelf}
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <Plus className="w-4 h-4" />
                      В мои полки
                    </Button>
                  }
                />
                
                {/* Delete button - only show if the current user is the uploader */}
                {book.userId === user?.id && (
                  <Button 
                    variant="destructive" 
                    className="gap-2"
                    onClick={handleDeleteBook}
                    disabled={isDeleting}
                  >
                    <Trash className="w-4 h-4" />
                    {isDeleting ? 'Удаление...' : 'Удалить'}
                  </Button>
                )}
              </CardFooter>
            </div>
          </div>
        </Card>
        
        {/* Additional Sections in Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Reading Stats */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium">Статистика чтения</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Прочитано</span>
                <span className="font-medium">0%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">страниц</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">~0ч</p>
                  <p className="text-xs text-muted-foreground">осталось</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium">Теги</h3>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Теги отсутствуют</Badge>
              </div>
            </CardContent>
          </Card>
          
          {/* Key Takeaways Preview */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium">Ключевые моменты</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Ключевые моменты будут доступны после начала чтения книги.</p>
            </CardContent>
            <CardFooter>
              <Link href={`/read/${book.id}/1`} className="text-sm text-primary hover:underline">
                Начать чтение
              </Link>
            </CardFooter>
          </Card>
        </div>
        
        {/* Tabs for Table of Contents, Comments, and Reviews */}
        <Card>
          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="toc">Оглавление</TabsTrigger>
              <TabsTrigger value="comments">Комментарии ({bookComments.length})</TabsTrigger>
              <TabsTrigger value="reviews">Рецензии ({bookReviews.length})</TabsTrigger>
            </TabsList>
            
            {/* Table of Contents Tab */}
            <TabsContent value="toc" className="mt-0">
              <CardContent className="p-0">
                <div className="p-4 text-center text-muted-foreground">
                  Оглавление будет доступно после начала чтения книги.
                </div>
              </CardContent>
            </TabsContent>
            
            {/* Comments Tab */}
            <TabsContent value="comments" className="mt-0">
              <CardContent className="space-y-6 pt-4">
                {bookComments.map(comment => (
                  <div key={comment.id} className="border-b pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{comment.author}</p>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground cursor-help mb-3">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ru })}
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
                
                {/* Add Comment Form */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">Добавить комментарий</h4>
                  <div className="space-y-4">
                    <Textarea 
                      placeholder="Ваш комментарий..." 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleAddComment} className="gap-2">
                        <Send className="w-4 h-4" />
                        Отправить
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </TabsContent>
            
            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-0">
              <CardContent className="space-y-6 pt-4">
                {bookReviews.map(review => (
                  <div key={review.id} className="border-b pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{review.author}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{review.rating}/10</span>
                          </div>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground cursor-help mb-3">
                                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: ru })}
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
                
                {/* Add Review Form */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">Написать рецензию</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Оценка:</span>
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
                      placeholder="Ваша рецензия..." 
                      value={newReview}
                      onChange={(e) => setNewReview(e.target.value)}
                      rows={5}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleAddReview} className="gap-2">
                        <Send className="w-4 h-4" />
                        Опубликовать
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}