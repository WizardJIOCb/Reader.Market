import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Search, 
  Filter, 
  Book as BookIcon, 
  X,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/BookCard';
import { PageHeader } from '@/components/PageHeader';


import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

// Define the Book interface to match our database schema
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  genre?: string;
  publishedYear?: number;
  rating?: number;
  // Date fields for book display
  uploadedAt?: string; // ISO date string
  publishedAt?: string; // ISO date string
  lastActivityDate?: string; // ISO date string
  createdAt: string;
  updatedAt: string;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation(['search', 'notifications']);
  
  // State for books and loading
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters State
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1800, new Date().getFullYear()]);

  // Check for query parameter in URL when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
      const decodedQuery = decodeURIComponent(queryParam);
      setSearchQuery(decodedQuery);
      performSearch(decodedQuery);
    }
  }, []);

  // Fetch all books for filters when component mounts
  useEffect(() => {
    const fetchAllBooks = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch('/api/books/search', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setBooks(data);
        } else {
          throw new Error('Failed to fetch books');
        }
      } catch (err) {
        console.error('Error fetching books:', err);
        setError(err instanceof Error ? err.message : 'Failed to load books');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllBooks();
  }, []);

  // Derived Data for Filters
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    books.forEach(book => {
      if (book.genre) {
        book.genre.split(',').forEach(g => genres.add(g.trim()));
      }
    });
    return Array.from(genres);
  }, [books]);

  const allStyles = useMemo(() => {
    // For now, we don't have styles in our database schema
    return [];
  }, []);

  const performSearch = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Make a server-side search request to the backend service
      const response = await fetch(`/api/books/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      } else {
        throw new Error('Failed to search books');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      toast({
        title: t('notifications:error.title'),
        description: t('notifications:error.loadFailed'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      // Genre Filter
      if (selectedGenres.length > 0) {
        if (!book.genre) return false;
        const bookGenres = book.genre.split(',').map(g => g.trim());
        const hasGenre = selectedGenres.some(g => bookGenres.includes(g));
        if (!hasGenre) return false;
      }

      // Style Filter (not implemented in our schema)
      if (selectedStyles.length > 0) {
        return false; // No style field in our database
      }

      // Year Filter
      if (book.publishedYear && (book.publishedYear < yearRange[0] || book.publishedYear > yearRange[1])) {
        return false;
      }

      return true;
    });
  }, [books, selectedGenres, selectedStyles, yearRange]);


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
    setYearRange([1800, new Date().getFullYear()]);
    setSearchQuery('');
    
    // Reset URL
    setLocation('/search', { replace: true });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Update URL with query parameter
    if (query) {
      setLocation(`/search?q=${encodeURIComponent(query)}`, { replace: true });
    } else {
      setLocation('/search', { replace: true });
    }
    
    performSearch(query);
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title={t('search:title')} />
        
        <div className="mb-8">
          <div className="flex flex-col gap-4">
            <SearchBar 
              initialQuery={searchQuery}
              onSearch={handleSearch}
              showFilters={false}
              allGenres={allGenres}
              allStyles={allStyles}
              selectedGenres={selectedGenres}
              selectedStyles={selectedStyles}
              yearRange={yearRange}
              onGenreChange={setSelectedGenres}
              onStyleChange={setSelectedStyles}
              onYearRangeChange={setYearRange}
              onFiltersClear={clearFilters}
            />

          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {!searchQuery 
                ? t('search:allBooks')
                : `${t('search:booksFound')}: ${filteredBooks.length}`}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive">{error}</p>
              <Button onClick={() => performSearch(searchQuery)} className="mt-4">
                {t('search:retry')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.length > 0 ? (
                filteredBooks.map(book => {
                  // Convert book data to match BookCard expectations
                  const bookData = {
                    ...book,
                    coverColor: '', // Not used since we have coverImage
                    coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl.replace(/^\//, '')}` : book.coverImageUrl,
                    genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                  };
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={bookData} 
                      variant="detailed"
                    />
                  );
                })
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">{t('search:noResults')}</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {t('search:noResultsDescription')}
                  </p>
                  <Button variant="outline" className="mt-6" onClick={clearFilters}>
                    {t('search:resetFilters')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}