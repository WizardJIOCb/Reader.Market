import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getCachedShelves, setCachedShelves, dataCache, isCachedDataStale } from '@/lib/dataCache';

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
    // Check if we have cached data
    const cachedShelves = getCachedShelves();
    if (cachedShelves && !isCachedDataStale(dataCache.shelves.timestamp)) {
      setShelves(cachedShelves);
      setLoading(false);
      return;
    }

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
      
      const response = await fetch('http://localhost:5001/api/shelves', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setShelves(data);
        // Cache the data
        setCachedShelves(data);
      } else {
        const errorText = await response.text();
        const errorMessage = `Failed to fetch shelves: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        setError(errorMessage);
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
      
      const response = await fetch('http://localhost:5001/api/shelves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        const newShelf = await response.json();
        // Ensure bookIds is initialized as an empty array for new shelves
        const shelfWithBookIds = { ...newShelf, bookIds: [] };
        setShelves(prev => [...prev, shelfWithBookIds]);
        return shelfWithBookIds;
      } else {
        const errorText = await response.text();
        const errorMessage = `Failed to create shelf: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
      
      const response = await fetch(`http://localhost:5001/api/shelves/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        const updatedShelf = await response.json();
        // Update local state, preserving bookIds property
        setShelves(prev => 
          prev.map(shelf => 
            shelf.id === id ? { ...updatedShelf, bookIds: shelf.bookIds || [] } : shelf
          )
        );
        return updatedShelf;
      } else {
        const errorText = await response.text();
        const errorMessage = `Failed to update shelf: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
      
      const response = await fetch(`http://localhost:5001/api/shelves/${id}`, {
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
        const errorMessage = `Failed to delete shelf: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
      
      console.log(`Adding book ${bookId} to shelf ${shelfId}`);
      console.log(`Using auth token: ${token.substring(0, 10)}...`);
      
      const response = await fetch(`http://localhost:5001/api/shelves/${shelfId}/books/${bookId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(`Server response status: ${response.status}`);
      
      if (response.ok) {
        console.log(`Successfully added book ${bookId} to shelf ${shelfId}`);
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
        console.log(`Server error response: ${errorText}`);
        const errorMessage = `Failed to add book to shelf: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
      
      console.log(`Removing book ${bookId} from shelf ${shelfId}`);
      console.log(`Using auth token: ${token.substring(0, 10)}...`);
      
      const response = await fetch(`http://localhost:5001/api/shelves/${shelfId}/books/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(`Server response status: ${response.status}`);
      
      if (response.ok) {
        console.log(`Successfully removed book ${bookId} from shelf ${shelfId}`);
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
        console.log(`Server error response: ${errorText}`);
        const errorMessage = `Failed to remove book from shelf: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
