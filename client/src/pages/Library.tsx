import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { mockUser } from '@/lib/mockData';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  BookOpen, 
  MessageSquare, 
  Award, 
  Clock, 
  Users, 
  TrendingUp, 
  Star,
  Library as LibraryIcon,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/BookCard';
import { PageHeader } from '@/components/PageHeader';
import { useMainPageData } from '@/hooks/useMainPageData';



export default function Library() {
  const { user } = useAuth();
  const { t } = useTranslation(['home', 'common']);
  const { data, loading, error, refresh } = useMainPageData();
  const [searchQuery, setSearchQuery] = useState('');
  // Filters State
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1800, new Date().getFullYear()]);

  const handleSearch = (query: string) => {
    // In a real app, this would navigate to search results
    console.log('Searching for:', query);
    setSearchQuery(query);
  };

  // Toggle genre selection
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  // Toggle style selection
  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedStyles([]);
    setYearRange([1800, new Date().getFullYear()]);
  };

  // Filter books based on selected filters
  const filterBooks = (books: any[]) => {
    return books.filter(book => {
      // Genre Filter
      if (selectedGenres.length > 0) {
        if (!book.genre) return false;
        const bookGenres = book.genre.split(',').map((g: string) => g.trim());
        const hasGenre = selectedGenres.some((g: string) => bookGenres.includes(g));
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
  };

  // Filter all book collections
  const filteredPopularBooks = useMemo(() => filterBooks(data.popularBooks), [data.popularBooks, selectedGenres, selectedStyles, yearRange]);
  const filteredRecentlyReviewedBooks = useMemo(() => filterBooks(data.recentlyReviewedBooks), [data.recentlyReviewedBooks, selectedGenres, selectedStyles, yearRange]);
  const filteredNewReleases = useMemo(() => filterBooks(data.newReleases), [data.newReleases, selectedGenres, selectedStyles, yearRange]);
  const filteredCurrentUserBooks = useMemo(() => filterBooks(data.currentUserBooks), [data.currentUserBooks, selectedGenres, selectedStyles, yearRange]);
  
  // Get all unique genres from all book collections for the filter options
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    [...data.popularBooks, ...data.recentlyReviewedBooks, ...data.newReleases, ...data.currentUserBooks].forEach(book => {
      if (book.genre) {
        book.genre.split(',').forEach((g: string) => genres.add(g.trim()));
      }
    });
    return Array.from(genres);
  }, [data.popularBooks, data.recentlyReviewedBooks, data.newReleases, data.currentUserBooks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title={t('home:title')} />
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title={t('home:title')} />
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">{t('home:error')}: {error}</div>
            <Button onClick={refresh}>{t('home:retry')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title={t('home:title')} />
        
        {/* Search Bar with Filters */}
        <div className="mb-8">
          <div className="flex flex-col gap-4">
            <SearchBar 
              onSearch={handleSearch}
              showFilters={false}
              allGenres={allGenres}
              allStyles={[]}
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

        {/* Popular Books Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              {t('home:popularBooks')}
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              {t('home:allPopular')}
            </Link>
          </div>
          
          {filteredPopularBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {filteredPopularBooks.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                // Convert book data to match BookCard expectations
                const bookData = {
                  ...book,
                  coverColor: '', // Not used since we have coverImage
                  coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl,
                  genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                };
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={bookData} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {data.popularBooks.length > 0 ? (
                <p>{t('home:noPopularBooksFiltered')}</p>
              ) : (
                <p>{t('home:noPopularBooks')}</p>
              )}
            </div>
          )}
        </section>
        
        {/* Books by Genre */}
        <section className="mb-12">
          <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {t('home:booksByGenre')}
          </h2>
                  
          {data.booksByGenre.length > 0 ? (
            <div className="space-y-10">
              {data.booksByGenre.map((genreGroup, index) => (
                <div key={index}>
                  <h3 className="text-xl font-serif font-bold mb-4">{genreGroup.genre}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
                    {genreGroup.books.map((book) => {
                      // Find reading progress for this book
                      const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                      
                      // Convert book data to match BookCard expectations
                      const bookData = {
                        ...book,
                        coverColor: '', // Not used since we have coverImage
                        coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl,
                        genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                      };
                      
                      return (
                        <BookCard 
                          key={book.id} 
                          book={bookData} 
                          variant="standard"
                          readingProgress={readingProgress}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('home:noBooksByGenre')}</p>
            </div>
          )}
        </section>

        {/* Recently Reviewed Books */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <Award className="w-6 h-6 text-primary" />
              {t('home:recentlyReviewed')}
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              {t('home:allReviewed')}
            </Link>
          </div>
          
          {filteredRecentlyReviewedBooks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {filteredRecentlyReviewedBooks.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                // Convert book data to match BookCard expectations
                const bookData = {
                  ...book,
                  coverColor: '', // Not used since we have coverImage
                  coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl,
                  genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                };
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={bookData} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {data.recentlyReviewedBooks.length > 0 ? (
                <p>{t('home:noReviewedBooksFiltered')}</p>
              ) : (
                <p>{t('home:noReviewedBooks')}</p>
              )}
            </div>
          )}
        </section>

        {/* New Releases */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <LibraryIcon className="w-6 h-6 text-primary" />
              {t('home:newReleases')}
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              {t('home:allNew')}
            </Link>
          </div>
          
          {filteredNewReleases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {filteredNewReleases.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                // Convert book data to match BookCard expectations
                const bookData = {
                  ...book,
                  coverColor: '', // Not used since we have coverImage
                  coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl,
                  genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                };
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={bookData} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LibraryIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {data.newReleases.length > 0 ? (
                <p>{t('home:noNewReleasesFiltered')}</p>
              ) : (
                <p>{t('home:noNewReleases')}</p>
              )}
            </div>
          )}
        </section>

        {/* User's Currently Reading */}
        {user && (
          <section className="mb-12">
            <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              {t('home:myBooks')}
            </h2>
            
            {filteredCurrentUserBooks && filteredCurrentUserBooks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
                {filteredCurrentUserBooks.map((book) => {
                  // Find reading progress for this book
                  const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                  
                  // Convert book data to match BookCard expectations
                  const bookData = {
                    ...book,
                    coverColor: '', // Not used since we have coverImage
                    coverImage: book.coverImageUrl?.startsWith('uploads/') ? `/${book.coverImageUrl}` : book.coverImageUrl,
                    genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                  };
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={bookData} 
                      variant="detailed"
                      readingProgress={readingProgress}
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {data.currentUserBooks && data.currentUserBooks.length > 0 ? 
                    t('home:noBooksFiltered') : 
                    t('home:noActiveBooks')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {data.currentUserBooks && data.currentUserBooks.length > 0 ? 
                    t('home:tryDifferentFilters') : 
                    t('home:noBooksMessage')}
                </p>
                <Link href="/search">
                  <Button>{t('home:findBook')}</Button>
                </Link>
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  );
}