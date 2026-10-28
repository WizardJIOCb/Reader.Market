import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export interface Book {
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
  commentCount?: number;
  reviewCount?: number;
  lastActivityDate?: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string;
  publishedAt?: string;
}

export interface UseBookReturn {
  book: Book | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch books by IDs
  const fetchBooksByIds = async (bookIds: string[]) => {
    if (!user || bookIds.length === 0) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('http://localhost:5001/api/books/by-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookIds }),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch books: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      throw err;
    }
  };

  // Fetch popular books
  const fetchPopularBooks = async () => {
    if (!user) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('http://localhost:5001/api/books/popular', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch popular books: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching popular books:', err);
      throw err;
    }
  };

  // Fetch books by genre
  const fetchBooksByGenre = async (genre: string) => {
    if (!user || !genre) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`http://localhost:5001/api/books/genre/${encodeURIComponent(genre)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch books by genre: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching books by genre:', err);
      throw err;
    }
  };

  // Fetch recently reviewed books
  const fetchRecentlyReviewedBooks = async () => {
    if (!user) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('http://localhost:5001/api/books/recently-reviewed', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch recently reviewed books: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching recently reviewed books:', err);
      throw err;
    }
  };

  // Fetch user's currently reading books
  const fetchCurrentUserBooks = async () => {
    if (!user) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('http://localhost:5001/api/books/currently-reading', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user's currently reading books: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching user\'s currently reading books:', err);
      throw err;
    }
  };

  // Fetch new releases
  const fetchNewReleases = async () => {
    if (!user) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('http://localhost:5001/api/books/new-releases', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch new releases: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching new releases:', err);
      throw err;
    }
  };

  return {
    books,
    loading,
    error,
    fetchBooksByIds,
    fetchPopularBooks,
    fetchBooksByGenre,
    fetchRecentlyReviewedBooks,
    fetchCurrentUserBooks,
    fetchNewReleases,
  };
}

// Hook for fetching a single book
export function useBook(bookId: string | undefined): UseBookReturn {
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBook = async () => {
    console.log('Fetching book data for book ID:', bookId);
    if (!bookId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`http://localhost:5001/api/books/${bookId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Received book data:', data);
        setBook(data);
      } else if (response.status === 404) {
        setError('Book not found');
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch book: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching book:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('useBook useEffect triggered with bookId:', bookId, 'user:', user);
    fetchBook();
  }, [bookId, user]);

  return {
    book,
    loading,
    error,
    refresh: fetchBook,
  };
}