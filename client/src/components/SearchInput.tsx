import React, { memo } from 'react';
import { Input } from './ui/input';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = memo(({ value, onChange, placeholder }) => {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        placeholder={placeholder || "Search..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the value actually changed
  return prevProps.value === nextProps.value && prevProps.placeholder === nextProps.placeholder;
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
