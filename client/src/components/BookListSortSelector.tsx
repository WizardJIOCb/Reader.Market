import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export type SortOption = 'views' | 'readerOpens' | 'rating' | 'comments' | 'reviews' | 'shelfCount' | 'uploadedAt' | 'publishedAt';

export type SortDirection = 'asc' | 'desc';

interface BookListSortSelectorProps {
  value: SortOption;
  direction?: SortDirection;
  onDirectionChange?: (direction: SortDirection) => void;
  onChange: (value: SortOption) => void;
  className?: string;
}

export function BookListSortSelector({ value, direction = 'desc', onDirectionChange, onChange, className }: BookListSortSelectorProps) {
  const { t } = useTranslation(['common']);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'rating', label: t('common:sort.byRating') },
    { value: 'views', label: t('common:sort.byViews') },
    { value: 'readerOpens', label: t('common:sort.byReaderOpens') },
    { value: 'comments', label: t('common:sort.byComments') },
    { value: 'reviews', label: t('common:sort.byReviews') },
    { value: 'shelfCount', label: t('common:sort.byShelfCount') },
    { value: 'uploadedAt', label: t('common:sort.byUploadDate') },
    { value: 'publishedAt', label: t('common:sort.byPublicationDate') },
  ];

  const toggleDirection = () => {
    const newDirection = direction === 'asc' ? 'desc' : 'asc';
    if (onDirectionChange) {
      onDirectionChange(newDirection);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleDirection}
        className="p-2 h-8 w-8 flex items-center justify-center"
      >
        {direction === 'desc' ? (
          <ArrowDownWideNarrow className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ArrowUpNarrowWide className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>
      <Select value={value} onValueChange={(val) => onChange(val as SortOption)}>
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue placeholder={t('common:sort.label')} />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Helper function to sort books client-side
export function sortBooks<T extends Record<string, any>>(books: T[], sortBy: SortOption, direction: SortDirection = 'desc'): T[] {
  const sortedBooks = [...books].sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case 'views':
        result = (b.cardViewCount || 0) - (a.cardViewCount || 0);
        break;
      case 'readerOpens':
        result = (b.readerOpenCount || 0) - (a.readerOpenCount || 0);
        break;
      case 'rating':
        const ratingA = a.rating != null ? Number(a.rating) : 0;
        const ratingB = b.rating != null ? Number(b.rating) : 0;
        result = ratingB - ratingA;
        break;
      case 'comments':
        result = (b.commentCount || 0) - (a.commentCount || 0);
        break;
      case 'reviews':
        result = (b.reviewCount || 0) - (a.reviewCount || 0);
        break;
      case 'shelfCount':
        result = (b.shelfCount || 0) - (a.shelfCount || 0);
        break;
      case 'uploadedAt':
        // Sort by upload date
        const uploadedAtA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const uploadedAtB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        result = uploadedAtB - uploadedAtA;
        break;
      case 'publishedAt':
        // Sort by publication date, nulls last
        const publishedAtA = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
        const publishedAtB = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
        result = publishedAtB - publishedAtA;
        break;
      default:
        result = 0;
    }
    
    // Reverse the result if direction is ascending
    return direction === 'asc' ? -result : result;
  });
  
  return sortedBooks;
}
