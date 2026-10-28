import React, { useState } from 'react';
import { Link } from 'wouter';
import { mockUser } from '@/lib/mockData';
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
  const { data, loading, error, refresh } = useMainPageData();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    // In a real app, this would navigate to search results
    console.log('Searching for:', query);
    setSearchQuery(query);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title="Библиотека" />
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
          <PageHeader title="Библиотека" />
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">Ошибка загрузки данных: {error}</div>
            <Button onClick={refresh}>Повторить попытку</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title="Библиотека" />
        
        {/* Search Bar */}
        <div className="mb-12">
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Popular Books Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Популярные книги
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              Все популярные
            </Link>
          </div>
          
          {data.popularBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {data.popularBooks.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Пока нет популярных книг</p>
            </div>
          )}
        </section>
        
        {/* Books by Genre */}
        <section className="mb-12">
          <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Книги по жанрам
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
                      
                      return (
                        <BookCard 
                          key={book.id} 
                          book={book} 
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
              <p>Пока нет книг по жанрам</p>
            </div>
          )}
        </section>

        {/* Recently Reviewed Books */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <Award className="w-6 h-6 text-primary" />
              Новые обзоры
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              Все обзоры
            </Link>
          </div>
          
          {data.recentlyReviewedBooks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {data.recentlyReviewedBooks.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Пока нет новых обзоров</p>
            </div>
          )}
        </section>

        {/* New Releases */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
              <LibraryIcon className="w-6 h-6 text-primary" />
              Новинки
            </h2>
            <Link href="/search" className="text-sm text-primary hover:underline">
              Все новинки
            </Link>
          </div>
          
          {data.newReleases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
              {data.newReleases.map((book) => {
                // Find reading progress for this book
                const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                
                return (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    variant="detailed"
                    readingProgress={readingProgress}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LibraryIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Пока нет новинок</p>
            </div>
          )}
        </section>

        {/* User's Currently Reading */}
        {user && (
          <section className="mb-12">
            <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Мои книги
            </h2>
            
            {data.currentUserBooks && data.currentUserBooks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ direction: 'ltr' }}>
                {data.currentUserBooks.map((book) => {
                  // Find reading progress for this book
                  const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === parseInt(book.id)) || undefined;
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      variant="detailed"
                      readingProgress={readingProgress}
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">У вас нет активных книг</h3>
                <p className="text-muted-foreground mb-4">
                  Начните читать книгу, и она появится здесь с прогрессом чтения.
                </p>
                <Link href="/search">
                  <Button>Найти книгу</Button>
                </Link>
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  );
}