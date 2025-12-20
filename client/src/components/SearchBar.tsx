import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { mockBooks } from '@/lib/mockData';
import { useLocation } from 'wouter';

interface SearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
  showFilters?: boolean;
}

export function SearchBar({ initialQuery = '', onSearch, showFilters = true }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1950, 2025]);
  const [, navigate] = useLocation();

  // Derived Data for Filters
  const allGenres = Array.from(new Set(mockBooks.flatMap(b => b.genre)));
  const allStyles = Array.from(new Set(mockBooks.map(b => b.style).filter(Boolean) as string[]));

  // Check for query parameter in URL when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
      setSearchQuery(decodeURIComponent(queryParam));
      if (onSearch) {
        onSearch(decodeURIComponent(queryParam));
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      // Default behavior: navigate to search page
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
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
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Название, автор, жанр или тег..." 
            className="pl-9 h-12 bg-muted/30 border-muted focus-visible:ring-1 text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus={initialQuery === ''}
          />
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {showFilters && (
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
                  type="button"
                >
                  Сбросить все фильтры
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
        
        <Button 
          type="submit" 
          className="h-12 px-6"
        >
          Найти
        </Button>
      </form>
    </div>
  );
}