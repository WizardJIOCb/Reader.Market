import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SortOption = 'views' | 'readerOpens' | 'rating' | 'comments' | 'reviews' | 'shelfCount';

interface BookListSortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

export function BookListSortSelector({ value, onChange, className }: BookListSortSelectorProps) {
  const { t } = useTranslation(['common']);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'rating', label: t('common:sort.byRating') },
    { value: 'views', label: t('common:sort.byViews') },
    { value: 'readerOpens', label: t('common:sort.byReaderOpens') },
    { value: 'comments', label: t('common:sort.byComments') },
    { value: 'reviews', label: t('common:sort.byReviews') },
    { value: 'shelfCount', label: t('common:sort.byShelfCount') },
  ];

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <ArrowDownWideNarrow className="w-4 h-4 text-muted-foreground" />
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
export function sortBooks<T extends Record<string, any>>(books: T[], sortBy: SortOption): T[] {
  return [...books].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return (b.cardViewCount || 0) - (a.cardViewCount || 0);
      case 'readerOpens':
        return (b.readerOpenCount || 0) - (a.readerOpenCount || 0);
      case 'rating':
        const ratingA = a.rating != null ? Number(a.rating) : 0;
        const ratingB = b.rating != null ? Number(b.rating) : 0;
        return ratingB - ratingA;
      case 'comments':
        return (b.commentCount || 0) - (a.commentCount || 0);
      case 'reviews':
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      case 'shelfCount':
        return (b.shelfCount || 0) - (a.shelfCount || 0);
      default:
        return 0;
    }
  });
}
