import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { mockBooks, mockShelves, Shelf } from '@/lib/mockData';
import { 
  Search, 
  Filter, 
  Book as BookIcon, 
  ArrowLeft,
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
        {/* Header */}
        <header className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Назад в библиотеку</span>
              </Button>
            </Link>
            <h1 className="font-serif text-2xl font-bold">Глобальный Поиск</h1>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Название, автор, жанр или тег..." 
                className="pl-9 h-12 bg-muted/30 border-muted focus-visible:ring-1 text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-12 px-4 gap-2 border-muted bg-muted/10">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Фильтры</span>
                  {(selectedGenres.length > 0 || selectedStyles.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {selectedGenres.length + selectedStyles.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[320px] sm:w-[400px] overflow-y-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle className="font-serif text-2xl">Фильтры</SheetTitle>
                </SheetHeader>
                
                <div className="space-y-8 pb-12">
                  {/* Genres */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                      Жанры
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allGenres.map(genre => (
                        <Badge
                          key={genre}
                          variant={selectedGenres.includes(genre) ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 hover:border-primary/50 transition-colors"
                          onClick={() => toggleGenre(genre)}
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Styles */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                      Стилистика
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allStyles.map(style => (
                        <Badge
                          key={style}
                          variant={selectedStyles.includes(style) ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 hover:border-primary/50 transition-colors"
                          onClick={() => toggleStyle(style)}
                        >
                          {style}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Year Range */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                        Год издания
                      </h3>
                      <span className="text-sm font-mono text-muted-foreground">
                        {yearRange[0]} - {yearRange[1]}
                      </span>
                    </div>
                    <Slider
                      defaultValue={[1950, 2025]}
                      min={1950}
                      max={2025}
                      step={1}
                      value={yearRange}
                      onValueChange={(vals) => setYearRange(vals as [number, number])}
                    />
                  </div>

                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={clearFilters}
                  >
                    Сбросить все фильтры
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Найдено книг: {filteredBooks.length}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBooks.length > 0 ? (
              filteredBooks.map(book => (
                <div key={book.id} className="bg-card border rounded-xl p-4 flex gap-5 hover:border-primary/30 transition-all group">
                  <div className={`w-24 h-36 rounded-lg shadow-md flex-shrink-0 ${book.coverColor} relative overflow-hidden`}>
                     <Link href={`/read/${book.id}/1`}>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors cursor-pointer" />
                     </Link>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <Link href={`/read/${book.id}/1`}>
                          <h3 className="font-serif font-bold text-lg truncate hover:text-primary cursor-pointer transition-colors">
                            {book.title}
                          </h3>
                        </Link>
                        {book.rating && (
                          <div className="flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                            <Star className="w-3 h-3 fill-current" />
                            {book.rating}
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{book.author} • {book.year}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {book.genre.slice(0, 2).map(g => (
                          <Badge key={g} variant="secondary" className="text-[10px] h-5 px-1.5">
                            {g}
                          </Badge>
                        ))}
                        {book.style && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-dashed">
                            {book.style}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-foreground/80 line-clamp-2 mb-4">
                        {book.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-dashed">
                       <Link href={`/read/${book.id}/1`}>
                          <Button variant="ghost" size="sm" className="h-8 -ml-2 text-xs">
                            Подробнее
                          </Button>
                       </Link>
                       <AddToShelfDialog 
                          bookId={book.id}
                          shelves={shelves}
                          onToggleShelf={handleToggleShelf}
                        />
                    </div>
                  </div>
                </div>
              ))
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
