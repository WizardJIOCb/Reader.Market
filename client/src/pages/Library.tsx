import React, { useState } from 'react';
import { Link } from 'wouter';
import { mockBooks, mockShelves, Shelf, ReadingProgress, mockUser } from '@/lib/mockData';
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

// Mock data for popular books, trending books, and recently reviewed books
const popularBooks = mockBooks.slice(0, 4);
const trendingBooks = mockBooks.slice(2, 6);
const recentlyReviewedBooks = mockBooks.slice(1, 5);

// Mock data for user's currently reading books with progress
const userCurrentlyReading = [
  {
    book: mockBooks[0],
    progress: 65,
    lastRead: '2 дня назад'
  },
  {
    book: mockBooks[1],
    progress: 30,
    lastRead: '5 дней назад'
  }
];

// Group books by genre
const booksByGenre = [
  {
    genre: 'Научная Фантастика',
    books: mockBooks.filter(book => book.genre.includes('Научная Фантастика')).slice(0, 3)
  },
  {
    genre: 'Детектив',
    books: mockBooks.filter(book => book.genre.includes('Детектив')).slice(0, 3)
  },
  {
    genre: 'Киберпанк',
    books: mockBooks.filter(book => book.genre.includes('Киберпанк')).slice(0, 3)
  }
];

export default function Library() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    // In a real app, this would navigate to search results
    console.log('Searching for:', query);
    setSearchQuery(query);
  };

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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularBooks.map((book) => {
              // Find reading progress for this book
              const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === book.id) || undefined;
              
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
        </section>

        {/* Books by Genre */}
        <section className="mb-12">
          <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Книги по жанрам
          </h2>
          
          <div className="space-y-10">
            {booksByGenre.map((genreGroup, index) => (
              <div key={index}>
                <h3 className="text-xl font-serif font-bold mb-4">{genreGroup.genre}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {genreGroup.books.map((book) => {
                    // Find reading progress for this book
                    const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === book.id) || undefined;
                    
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentlyReviewedBooks.map((book) => {
              // Find reading progress for this book
              const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === book.id) || undefined;
              
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
        </section>

        {/* User's Currently Reading */}
        {user && (
          <section className="mb-12">
            <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Мои книги
            </h2>
            
            {mockUser.readingProgress && mockUser.readingProgress.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mockUser.readingProgress.map((progress) => {
                  const book = mockBooks.find(b => b.id === progress.bookId);
                  if (!book) return null;
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      variant="detailed"
                      readingProgress={progress}
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