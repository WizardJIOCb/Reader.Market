import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export interface Shelf {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  bookIds: string[];
  createdAt: string;
  updatedAt: string;
}

export function useShelves() {
  const { user } = useAuth();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shelves from API
  const fetchShelves = async () => {
    if (!user) {
      setShelves([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/shelves', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setShelves(data);
      } else {
        const errorText = await response.text();
        setError(`Failed to fetch shelves: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      setError(`Failed to fetch shelves: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error fetching shelves:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new shelf
  const createShelf = async (shelfData: { name: string; description?: string; color?: string }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('/api/shelves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        const newShelf = await response.json();
        setShelves(prev => [...prev, newShelf]);
        return newShelf;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create shelf: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error creating shelf:', err);
      throw err;
    }
  };

  // Update a shelf
  const updateShelf = async (id: string, shelfData: { name?: string; description?: string; color?: string }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/shelves/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        const updatedShelf = await response.json();
        // Update local state
        setShelves(prev => 
          prev.map(shelf => 
            shelf.id === id ? updatedShelf : shelf
          )
        );
        return updatedShelf;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to update shelf: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error updating shelf:', err);
      throw err;
    }
  };

  // Delete a shelf
  const deleteShelf = async (id: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/shelves/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Remove from local state
        setShelves(prev => prev.filter(shelf => shelf.id !== id));
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to delete shelf: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error deleting shelf:', err);
      throw err;
    }
  };

  // Add a book to a shelf
  const addBookToShelf = async (shelfId: string, bookId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/shelves/${shelfId}/books/${bookId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update local state
        setShelves(prev => 
          prev.map(shelf => 
            shelf.id === shelfId 
              ? { ...shelf, bookIds: [...shelf.bookIds, bookId] } 
              : shelf
          )
        );
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to add book to shelf: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error adding book to shelf:', err);
      throw err;
    }
  };

  // Remove a book from a shelf
  const removeBookFromShelf = async (shelfId: string, bookId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/shelves/${shelfId}/books/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update local state
        setShelves(prev => 
          prev.map(shelf => 
            shelf.id === shelfId 
              ? { ...shelf, bookIds: shelf.bookIds.filter(id => id !== bookId) } 
              : shelf
          )
        );
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to remove book from shelf: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error removing book from shelf:', err);
      throw err;
    }
  };

  // Load shelves when user changes
  useEffect(() => {
    fetchShelves();
  }, [user]);

  return {
    shelves,
    loading,
    error,
    fetchShelves,
    createShelf,
    updateShelf,
    deleteShelf,
    addBookToShelf,
    removeBookFromShelf,
  };
}
