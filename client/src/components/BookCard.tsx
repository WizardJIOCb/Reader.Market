import React from 'react';
import { Link } from 'wouter';
import { BookOpen, Star, MessageSquare, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Book, ReadingProgress } from '@/lib/mockData';

interface Book {
  id: number | string; // Support both number and string IDs
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
  coverColor?: string;
  rating?: number;
  genre: string[];
  style?: string;
  year?: number;
  readTime?: string;
  tags?: string[];
  chapters?: any[];
}

interface BookCardProps {
  book: Book;
  variant?: 'compact' | 'standard' | 'detailed' | 'shelf';
  readingProgress?: ReadingProgress;
  onAddToShelf?: (bookId: number) => void;
  addToShelfButton?: React.ReactNode;
}

export function BookCard({ 
  book, 
  variant = 'standard',
  readingProgress,
  onAddToShelf,
  addToShelfButton
}: BookCardProps) {
  const renderCover = () => {
    // Check if book has a cover image URL
    if (book.coverImageUrl) {
      // For uploaded books, the cover image URL will be a path like "uploads/bookFile-123456789.jpg"
      // We need to construct the full URL to the backend server
      const imageUrl = book.coverImageUrl.startsWith('uploads/') 
        ? `http://localhost:3000/${book.coverImageUrl}` 
        : book.coverImageUrl;
      
      if (variant === 'compact') {
        return (
          <img 
            src={imageUrl} 
            alt={book.title} 
            className="w-16 h-24 rounded-md shadow-sm object-cover"
          />
        );
      }
      
      if (variant === 'shelf') {
        return (
          <img 
            src={imageUrl} 
            alt={book.title} 
            className="aspect-[2/3] rounded-lg shadow-md object-cover w-full h-full"
          />
        );
      }
      
      return (
        <img 
          src={imageUrl} 
          alt={book.title} 
          className={`${variant === 'detailed' ? 'h-48' : 'h-32'} object-cover w-full`}
        />
      );
    }
    
    // Fallback to colored placeholders if no cover image
    if (variant === 'compact') {
      return (
        <div className={`w-16 h-24 rounded-md shadow-sm flex-shrink-0 ${book.coverColor || 'bg-gray-200'} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white/30" />
          </div>
        </div>
      );
    }
    
    if (variant === 'shelf') {
      return (
        <div className={`aspect-[2/3] rounded-lg shadow-md overflow-hidden ${book.coverColor || 'bg-gray-200'} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-white/30" />
          </div>
        </div>
      );
    }
    
    return (
      <div className={`${variant === 'detailed' ? 'h-48' : 'h-32'} ${book.coverColor || 'bg-gray-200'} relative`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-white/30" />
        </div>
      </div>
    );
  };

  const renderProgress = () => {
    if (!readingProgress) return null;
    
    return (
      <div className="space-y-2 mt-2">
        <div className="flex justify-between text-sm">
          <span>Прогресс:</span>
          <span>{readingProgress.percentage}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full" 
            style={{ width: `${readingProgress.percentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Последнее чтение: {readingProgress.lastReadAt.toLocaleDateString('ru-RU')}
        </p>
      </div>
    );
  };

  const renderContent = () => {
    if (variant === 'compact') {
      return (
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-bold truncate">{book.title}</h3>
          <p className="text-sm text-muted-foreground truncate">{book.author}</p>
          
          {renderProgress()}
          
          {onAddToShelf && (
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs h-8"
                onClick={() => onAddToShelf(book.id)}
              >
                Добавить на полку
              </Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <CardHeader className="p-4">
          <Link href={`/book/${book.id}`}>
            <h3 
              className={`font-serif font-bold hover:text-primary transition-colors ${
                variant === 'detailed' ? 'line-clamp-2 text-lg' : 'line-clamp-1'
              }`}
            >
              {book.title}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground">{book.author}</p>
          
          {(variant === 'detailed' || variant === 'shelf') && book.description && (
            <p className="text-sm text-foreground/80 line-clamp-2 mt-2">
              {book.description}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {book.genre && book.genre.slice(0, variant === 'detailed' ? 3 : 2).map((genre, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {genre}
              </Badge>
            ))}
          </div>
          
          {renderProgress()}
        </CardContent>
      </>
    );
  };

  const renderFooter = () => {
    if (variant === 'compact') return null;
    
    if (variant === 'shelf') {
      return (
        <CardFooter className="px-4 py-3">
          <Link href={`/book/${book.id}`}>
            <Button size="sm">Подробнее</Button>
          </Link>
        </CardFooter>
      );
    }
    
    return (
      <CardFooter className="px-4 py-3 flex items-center justify-between border-t">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          <span>24</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Award className="w-4 h-4" />
          <span>18</span>
        </div>
        <div className="flex items-center gap-1">
          {book.rating && (
            <>
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{book.rating}</span>
            </>
          )}
        </div>
      </CardFooter>
    );
  };

  if (variant === 'compact') {
    return (
      <div className="bg-card border rounded-xl p-4 flex gap-4 hover:shadow-lg transition-all cursor-pointer">
        {renderCover()}
        {renderContent()}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <Link href={`/book/${book.id}`}>
        {renderCover()}
      </Link>
      {renderContent()}
      {addToShelfButton && (
        <div className="px-4 pb-4">
          {addToShelfButton}
        </div>
      )}
      {renderFooter()}
    </Card>
  );
}