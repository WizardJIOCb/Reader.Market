import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { Bookmark } from 'lucide-react';
import { Shelf } from '@/hooks/useShelves';

interface BookShelfOverlayProps {
  bookId: string;
  shelves: Shelf[];
  onToggleShelf: (shelfId: string, bookId: string, isAdded: boolean) => void;
  className?: string;
}

export const BookShelfOverlay: React.FC<BookShelfOverlayProps> = ({
  bookId,
  shelves,
  onToggleShelf,
  className = ''
}) => {
  // Memoize the calculation to ensure it updates when shelves change
  const isOnShelf = useMemo(() => {
    return shelves.some(shelf => 
      (shelf.bookIds && shelf.bookIds.includes(bookId)) ||
      (shelf.books && shelf.books.some((book: any) => book.id === bookId))
    );
  }, [shelves, bookId]);

  return (
    <div className={`absolute top-2 right-2 z-10 ${className}`}>
      <AddToShelfDialog
        bookId={bookId}
        shelves={shelves}
        onToggleShelf={onToggleShelf}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className={`p-1.5 h-auto w-auto rounded-full ${isOnShelf ? 'text-orange-500' : 'text-gray-700'}`}
          >
            <Bookmark 
              className={`w-4 h-4 ${isOnShelf ? 'fill-orange-500' : ''}`} 
              aria-label={isOnShelf ? "Книга уже на полке" : "Добавить книгу на полку"}
            />
          </Button>
        }
      />
    </div>
  );
};