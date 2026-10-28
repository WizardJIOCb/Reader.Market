import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useBooks } from '@/hooks/useBooks';
import { Book } from '@/hooks/useBooks';

export function useShelfBooks(bookIds: string[]) {
  const { user } = useAuth();
  const { fetchBooksByIds } = useBooks();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShelfBooks = async () => {
      if (!user || bookIds.length === 0) {
        setBooks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch books by IDs
        const booksData = await fetchBooksByIds(bookIds);
        setBooks(booksData);
      } catch (err) {
        console.error('Error fetching shelf books:', err);
        setError(err instanceof Error ? err.message : 'Failed to load shelf books');
      } finally {
        setLoading(false);
      }
    };

    fetchShelfBooks();
  }, [user, bookIds]);

  return {
    books,
    loading,
    error
  };
}