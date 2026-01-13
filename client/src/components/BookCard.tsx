import React, { useState } from 'react';
import { Book } from '@/lib/mockData';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  MessageSquare,
  Star, 
  User,
  Bookmark,
  Activity
} from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ReactionBar } from '@/components/ReactionBar';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface BookCardProps {
  book: Book;
  variant?: 'standard' | 'detailed';
  readingProgress?: {
    currentPage: number;
    totalPages: number;
    percentage: number;
    lastReadAt: Date;
  };
  addToShelfButton?: React.ReactNode;
}

export const BookCard: React.FC<BookCardProps> = ({ 
  book, 
  variant = 'standard',
  readingProgress,
  addToShelfButton
}) => {
  const { t } = useTranslation(['books']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [localReactions, setLocalReactions] = useState(book.reactions || []);
  // Format dates for display in DD.MM.YYYY format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Get book dates - using created_at as fallback for uploaded_at
  const uploadedAt = book.uploadedAt || book.createdAt;
  const publishedAt = book.publishedAt;

  // Update local reactions when book changes
  React.useEffect(() => {
    setLocalReactions(book.reactions || []);
  }, [book]);

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

      const response = await fetch(`/api/books/${book.id}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Optimistically update local state
        setLocalReactions(prev => {
          const existingIndex = prev.findIndex(r => r.emoji === emoji);
          
          if (result.action === 'added') {
            if (existingIndex >= 0) {
              // Increment count and mark as user reacted
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                count: updated[existingIndex].count + 1,
                userReacted: true
              };
              return updated;
            } else {
              // Add new reaction
              return [...prev, { emoji, count: 1, userReacted: true }];
            }
          } else {
            // Removed reaction
            if (existingIndex >= 0) {
              const updated = [...prev];
              if (updated[existingIndex].count > 1) {
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  count: updated[existingIndex].count - 1,
                  userReacted: false
                };
                return updated;
              } else {
                // Remove reaction completely
                return prev.filter((_, i) => i !== existingIndex);
              }
            }
          }
          
          return prev;
        });
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 p-2">
      <Link href={`/book/${book.id}`}>
        <div className="relative cursor-pointer">
          {(book.coverImage || book.coverImageUrl) ? (
            <img 
              src={
                ((book.coverImage || book.coverImageUrl)?.startsWith('http') 
                  ? (book.coverImage || book.coverImageUrl)
                  : `/${(book.coverImage || book.coverImageUrl)?.replace(/^\//, '')}`)}
              alt={book.title}
              className="w-full rounded-t-lg object-cover aspect-[2/3] hover:opacity-90 transition-opacity"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                console.error('Failed to load cover image:', book.coverImage || book.coverImageUrl);
                // Fallback to default image if the cover image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none'; // Hide the broken image
                target.onerror = null; // Prevent infinite loop
              }}
              onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                // Image loaded successfully
              }}
            />
          ) : (
            <div className="w-full rounded-t-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center aspect-[2/3] hover:opacity-90 transition-opacity">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
          )}
                
          {(book.rating !== undefined && book.rating !== null) ? (
            <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm font-bold">
              <Star className="w-3 h-3 fill-current" />
              {book.rating.toFixed(1)}
            </div>
          ) : (
            <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm">
              <Star className="w-3 h-3 fill-current" />
              {t('books:noRating')}
            </div>
          )}
        </div>
      </Link>
      
      <CardHeader className="pb-1">
        <h3 className="font-serif font-bold text-lg line-clamp-2">{book.title}</h3>
        <p className="text-muted-foreground text-sm flex items-center gap-1">
          <User className="w-4 h-4" />
          {book.author}
        </p>
      </CardHeader>
      
      <CardContent className="pb-1">
        {variant === 'detailed' && (
          <>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              {book.description}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {Array.isArray(book.genre) 
                ? book.genre.map((genre, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))
                : book.genre && typeof book.genre === 'string' && book.genre.split(',').map((genre, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {genre.trim()}
                    </Badge>
                  ))
              }
            </div>
            
            {/* Book Reactions - after description and genres */}
            {variant === 'detailed' && (
              <div className="mb-3">
                <ReactionBar 
                  reactions={localReactions} 
                  onReact={handleBookReact}
                  bookId={book.id.toString()}
                />
              </div>
            )}
          </>
        )}
        
        {/* Book Dates Display */}
        <div className="space-y-1 mb-2">
          {/* Rating display at the top */}
          {(book.rating !== undefined && book.rating !== null) && (
            <div className="flex items-center text-xs font-bold text-yellow-600">
              <Star className="w-3 h-3 mr-1 fill-current" />
              <span>{t('books:rating')}: {book.rating.toFixed(1)}</span>
            </div>
          )}
          
          {publishedAt && (
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{t('books:published')}: {formatDate(publishedAt)}</span>
            </div>
          )}
          
          {uploadedAt && (
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3 mr-1" />
              <span>{t('books:added')}: {formatDate(uploadedAt)}</span>
            </div>
          )}
          
          {/* Review counts */}
          {(book.reviewCount !== undefined || book.commentCount !== undefined) && (
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
              <MessageSquare className="w-3 h-3 mr-1" />
              <span>
                {book.reviewCount !== undefined && `${book.reviewCount} ${t('books:reviews')}`}
                {book.reviewCount !== undefined && book.commentCount !== undefined && ', '}
                {book.commentCount !== undefined && `${book.commentCount} ${t('books:comments')}`}
              </span>
            </div>
          )}
          
          {/* Book statistics */}
          {(book.shelfCount !== undefined || book.cardViewCount !== undefined || book.readerOpenCount !== undefined) && (
            <>
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
            </>
          )}
          
          {/* Last activity date */}
          {book.lastActivityDate && (
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
              <Activity className="w-3 h-3 mr-1" />
              <span>{t('books:lastActivity')}: {formatDate(book.lastActivityDate)}</span>
            </div>
          )}
        </div>
        
        {/* TODO: Restore when reader module is fully implemented
        {readingProgress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Прогресс</span>
              <span>{Math.round(readingProgress.percentage)}%</span>
            </div>
            <Progress value={readingProgress.percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{readingProgress.currentPage} из {readingProgress.totalPages} стр.</span>
              <span>Читалось: {readingProgress.lastReadAt.toLocaleDateString('ru-RU')}</span>
            </div>
          </div>
        )}
        */}
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/read/${book.id}/1`}>
              {t('books:read')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/book/${book.id}`}>
              {t('books:moreDetails')}
            </Link>
          </Button>
        </div>
        {addToShelfButton && (
          <div className="w-full min-w-0">
            {addToShelfButton}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default BookCard;