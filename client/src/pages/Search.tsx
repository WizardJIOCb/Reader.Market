import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { mockBooks, mockShelves, recentlySearchedBooks, Shelf, mockUser } from '@/lib/mockData';
import { 
  Search, 
  Filter, 
  Book as BookIcon, 
  X,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/BookCard';
import { PageHeader } from '@/components/PageHeader';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [shelves, setShelves] = useState<Shelf[]>(mockShelves);
  
  // Filters State
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1950, 2025]);

  // Derived Data for Filters
  const allGenres = Array.from(new Set(mockBooks.flatMap(b => b.genre)));
  const allStyles = Array.from(new Set(mockBooks.map(b => b.style).filter(Boolean) as string[]));

  // Filter Logic
  const filteredBooks = useMemo(() => {
    // If there's no search query, show recently searched books
    if (!searchQuery) {
      return recentlySearchedBooks;
    }
    
    return mockBooks.filter(book => {
      // Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        book.title.toLowerCase().includes(searchLower) || 
        book.author.toLowerCase().includes(searchLower) ||
        (book.description && book.description.toLowerCase().includes(searchLower)) ||
        book.tags?.some(tag => tag.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // Genre Filter
      if (selectedGenres.length > 0) {
        const hasGenre = book.genre.some(g => selectedGenres.includes(g));
        if (!hasGenre) return false;
      }

      // Style Filter
      if (selectedStyles.length > 0) {
        if (!book.style || !selectedStyles.includes(book.style)) return false;
      }

      // Year Filter
      if (book.year && (book.year < yearRange[0] || book.year > yearRange[1])) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedGenres, selectedStyles, yearRange]);

  const handleToggleShelf = (bookId: number, shelfId: string, isAdded: boolean) => {
    setShelves(shelves.map(shelf => {
      if (shelf.id === shelfId) {
        if (isAdded) {
          return { ...shelf, bookIds: [...shelf.bookIds, bookId] };
        } else {
          return { ...shelf, bookIds: shelf.bookIds.filter(id => id !== bookId) };
        }
      }
      return shelf;
    }));
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedStyles([]);
    setYearRange([1950, 2025]);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title="Глобальный Поиск" />
        
        <div className="mb-8">
          <SearchBar 
            initialQuery={searchQuery}
            onSearch={setSearchQuery}
          />
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {!searchQuery 
                ? "Последние просмотренные книги" 
                : `Найдено книг: ${filteredBooks.length}`}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredBooks.length > 0 ? (
              filteredBooks.map(book => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === book.id) || undefined;
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    variant="detailed"
                    readingProgress={readingProgress}
                    onAddToShelf={(bookId) => console.log(`Add book ${bookId} to shelf`)}
                  />
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Ничего не найдено</h3>
                <p className="text-muted-foreground max-w-sm">
                  Попробуйте изменить поисковый запрос или сбросить фильтры
                </p>
                <Button variant="outline" className="mt-6" onClick={clearFilters}>
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}