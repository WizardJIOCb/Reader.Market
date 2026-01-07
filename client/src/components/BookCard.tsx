import React from 'react';
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
  // Format dates for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get book dates - using created_at as fallback for uploaded_at
  const uploadedAt = book.uploadedAt || book.createdAt;
  const publishedAt = book.publishedAt;

  // Debugging - log book data to console
  React.useEffect(() => {
    console.log('BookCard rendered with book:', book);
  }, [book]);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 p-2">
      <div className="relative">
        {(book.coverImage || book.coverImageUrl) ? (
          <img 
            src={
              ((book.coverImage || book.coverImageUrl)?.startsWith('http') 
                ? (book.coverImage || book.coverImageUrl)
                : `/${(book.coverImage || book.coverImageUrl)?.replace(/^\//, '')}`)
            } 
            alt={book.title}
            className="w-full rounded-t-lg object-cover aspect-[2/3]"
            onError={(e) => {
              console.error('Failed to load cover image:', book.coverImage || book.coverImageUrl);
              // Fallback to default image if the cover image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none'; // Hide the broken image
              target.onerror = null; // Prevent infinite loop
            }}
            onLoad={(e) => {
              console.log('Cover image loaded successfully:', book.coverImage || book.coverImageUrl);
            }}
          />
        ) : (
          <div className="w-full rounded-t-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center aspect-[2/3]">
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