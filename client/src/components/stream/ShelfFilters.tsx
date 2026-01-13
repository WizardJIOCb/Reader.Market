import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, ChevronDown, ChevronUp, Filter } from "lucide-react";

interface ShelfFiltersData {
  selectedShelf: string | null;
  selectedBooks: string[];
}

interface ShelfFiltersProps {
  filters: ShelfFiltersData;
  onFilterChange: (filters: ShelfFiltersData) => void;
}

interface Shelf {
  id: string;
  name: string;
  bookCount: number;
}

interface Book {
  id: string;
  title: string;
  shelfId: string;
}

interface FiltersData {
  shelves: Shelf[];
  books: Book[];
}

export function ShelfFilters({ filters, onFilterChange }: ShelfFiltersProps) {
  const { t } = useTranslation(['stream']);
  const [localFilters, setLocalFilters] = useState(filters);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch shelves and books for filtering
  const { data: filtersData } = useQuery<FiltersData>({
    queryKey: ['api', 'stream', 'shelves', 'filters'],
  });

  // Get books for selected shelf
  const availableBooks = filtersData?.books.filter(book => 
    !localFilters.selectedShelf || book.shelfId === localFilters.selectedShelf
  ) || [];

  // Handle shelf selection
  const handleShelfChange = (shelfId: string) => {
    const newFilters: ShelfFiltersData = {
      selectedShelf: shelfId === 'all' ? null : shelfId,
      selectedBooks: []
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Handle book selection
  const handleBookToggle = (bookId: string) => {
    const newSelectedBooks = localFilters.selectedBooks.includes(bookId)
      ? localFilters.selectedBooks.filter(id => id !== bookId)
      : [...localFilters.selectedBooks, bookId];
    
    const newFilters: ShelfFiltersData = {
      ...localFilters,
      selectedBooks: newSelectedBooks
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Clear filters
  const handleClearFilters = () => {
    const newFilters: ShelfFiltersData = {
      selectedShelf: null,
      selectedBooks: []
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const hasActiveFilters = localFilters.selectedShelf || localFilters.selectedBooks.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent">
                <Filter className="w-4 h-4" />
                <CardTitle className="text-sm font-medium">
                  {t('stream:myShelvesStream.filters.title')}
                  {hasActiveFilters && (
                    <span className="ml-2 text-xs text-primary">({localFilters.selectedBooks.length > 0 ? localFilters.selectedBooks.length : '1'})</span>
                  )}
                </CardTitle>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8"
              >
                <X className="w-4 h-4 mr-1" />
                {t('stream:myShelvesStream.filters.clearFilter')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Shelf selector */}
            <div className="space-y-2">
              <Label htmlFor="shelf-select" className="text-sm">
                {t('stream:myShelvesStream.filters.specificShelf')}
              </Label>
              <Select
                value={localFilters.selectedShelf || 'all'}
                onValueChange={handleShelfChange}
              >
                <SelectTrigger id="shelf-select">
                  <SelectValue placeholder={t('stream:myShelvesStream.filters.selectShelf')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('stream:myShelvesStream.filters.allShelves')}
                  </SelectItem>
                  {filtersData?.shelves.map((shelf) => (
                    <SelectItem key={shelf.id} value={shelf.id}>
                      {shelf.name} ({shelf.bookCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Book selection */}
            {availableBooks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">
                  {t('stream:myShelvesStream.filters.specificBooks')}
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                  {availableBooks.map((book) => (
                    <div key={book.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`book-${book.id}`}
                        checked={localFilters.selectedBooks.includes(book.id)}
                        onCheckedChange={() => handleBookToggle(book.id)}
                      />
                      <Label
                        htmlFor={`book-${book.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {book.title}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info text */}
            {!hasActiveFilters && (
              <p className="text-xs text-muted-foreground">
                {t('stream:myShelvesStream.filters.infoText')}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
