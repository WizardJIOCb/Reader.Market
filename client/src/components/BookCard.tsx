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
  Star, 
  User 
} from 'lucide-react';
import { Link } from 'wouter';

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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative">
        {book.coverImageUrl ? (
          <img 
            src={book.coverImageUrl} 
            alt={book.title}
            className="w-full rounded-t-lg object-cover aspect-[2/3]"
          />
        ) : (
          <div className="w-full rounded-t-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center aspect-[2/3]">
            <BookOpen className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {book.rating && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm">
            <Star className="w-3 h-3 fill-current" />
            {book.rating.toFixed(1)}
          </div>
        )}
      </div>
      
      <CardHeader className="pb-2">
        <h3 className="font-serif font-bold text-lg line-clamp-2">{book.title}</h3>
        <p className="text-muted-foreground text-sm flex items-center gap-1">
          <User className="w-4 h-4" />
          {book.author}
        </p>
      </CardHeader>
      
      <CardContent className="pb-2">
        {variant === 'detailed' && (
          <>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              {book.description}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {book.genre.map((genre, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          </>
        )}
        
        {/* Book Dates Display */}
        <div className="space-y-1 mb-3">
          {publishedAt && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Calendar className="w-3 h-3 mr-1" />
              <span>Опубликовано: {formatDate(publishedAt)}</span>
            </div>
          )}
          
          {uploadedAt && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />
              <span>Добавлено: {formatDate(uploadedAt)}</span>
            </div>
          )}
        </div>
        
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
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/reader/${book.id}`}>
              Читать
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/book/${book.id}`}>
              Подробнее
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