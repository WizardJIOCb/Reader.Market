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
  createdAt: string;
  updatedAt: string;
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
      
      const response = await fetch('/api/books/by-ids', {
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

  return {
    books,
    loading,
    error,
    fetchBooksByIds,
  };
}