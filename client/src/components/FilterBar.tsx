import React from 'react';
import { 
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface FilterBarProps {
  allGenres: string[];
  allStyles: string[];
  selectedGenres: string[];
  selectedStyles: string[];
  yearRange: [number, number];
  onGenreChange: (genres: string[]) => void;
  onStyleChange: (styles: string[]) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onFiltersClear: () => void;
}

export function FilterBar({
  allGenres,
  allStyles,
  selectedGenres,
  selectedStyles,
  yearRange,
  onGenreChange,
  onStyleChange,
  onYearRangeChange,
  onFiltersClear
}: FilterBarProps) {
  const toggleGenre = (genre: string) => {
    const newSelected = selectedGenres.includes(genre) 
      ? selectedGenres.filter(g => g !== genre) 
      : [...selectedGenres, genre];
    onGenreChange(newSelected);
  };

  const toggleStyle = (style: string) => {
    const newSelected = selectedStyles.includes(style) 
      ? selectedStyles.filter(s => s !== style) 
      : [...selectedStyles, style];
    onStyleChange(newSelected);
  };

  return (
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
              {allGenres.map((genre) => (
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
              {allStyles.map((style) => (
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
            onClick={onFiltersClear}
            type="button"
          >
            Сбросить все фильтры
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}