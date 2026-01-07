import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from '@/components/ui/slider';

interface SearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
  showFilters?: boolean;
  onFiltersClick?: () => void;
  // Filter props
  allGenres?: string[];
  allStyles?: string[];
  selectedGenres?: string[];
  selectedStyles?: string[];
  yearRange?: [number, number];
  onGenreChange?: (genres: string[]) => void;
  onStyleChange?: (styles: string[]) => void;
  onYearRangeChange?: (range: [number, number]) => void;
  onFiltersClear?: () => void;
}

export function SearchBar({ 
  initialQuery = '', 
  onSearch,
  showFilters = false,
  onFiltersClick,
  allGenres = [],
  allStyles = [],
  selectedGenres = [],
  selectedStyles = [],
  yearRange = [1800, new Date().getFullYear()],
  onGenreChange,
  onStyleChange,
  onYearRangeChange,
  onFiltersClear
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [, navigate] = useLocation();
  const { t } = useTranslation(['search']);
  
  // State for filter sheet
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  
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

  const clearSearch = () => {
    setSearchQuery('');
    if (onSearch) {
      onSearch('');
    }
  };
  
  const toggleGenre = (genre: string) => {
    if (!onGenreChange) return;
    const newSelected = selectedGenres?.includes(genre) 
      ? selectedGenres.filter((g: string) => g !== genre) 
      : [...selectedGenres, genre];
    onGenreChange(newSelected);
  };
  
  const toggleStyle = (style: string) => {
    if (!onStyleChange) return;
    const newSelected = selectedStyles?.includes(style) 
      ? selectedStyles.filter((s: string) => s !== style) 
      : [...selectedStyles, style];
    onStyleChange(newSelected);
  };
  
  const handleFilterClick = () => {
    setIsFilterSheetOpen(true);
  };
  
  const handleFiltersClear = () => {
    if (onFiltersClear) {
      onFiltersClear();
    }
    setIsFilterSheetOpen(false);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t('search:searchPlaceholder')}
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
              onClick={clearSearch}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <Button
          variant="outline"
          className="h-12 px-4 gap-2 border-muted bg-muted/10"
          type="button"
          onClick={handleFilterClick}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">{t('search:filters')}</span>
        </Button>
        
        <Button 
          type="submit" 
          className="h-12 px-6"
        >
          {t('search:find')}
        </Button>
      </form>
      
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent className="w-[320px] sm:w-[400px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl">{t('search:filters')}</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-8 pb-12">
            {/* Genres */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                {t('search:genres')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allGenres.map((genre) => (
                  <Button
                    key={genre}
                    variant={selectedGenres.includes(genre) ? "default" : "outline"}
                    className="px-3 py-1.5 hover:border-primary/50 transition-colors"
                    onClick={() => toggleGenre(genre)}
                    type="button"
                  >
                    {genre}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Styles */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                {t('search:styles')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allStyles.map((style) => (
                  <Button
                    key={style}
                    variant={selectedStyles.includes(style) ? "default" : "outline"}
                    className="px-3 py-1.5 hover:border-primary/50 transition-colors"
                    onClick={() => toggleStyle(style)}
                    type="button"
                  >
                    {style}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Year Range */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  {t('search:publicationYear')}
                </h3>
                <span className="text-sm font-mono text-muted-foreground">
                  {yearRange[0]} - {yearRange[1]}
                </span>
              </div>
              <Slider
                defaultValue={[1950, new Date().getFullYear()]}
                min={1800}
                max={new Date().getFullYear()}
                step={1}
                value={yearRange}
                onValueChange={onYearRangeChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{yearRange[0]}</span>
                <span>{yearRange[1]}</span>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleFiltersClear}
              type="button"
            >
              {t('search:clearAllFilters')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}