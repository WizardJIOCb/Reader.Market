import { useState, useEffect } from 'react';
import { mockShelves } from '@/lib/mockData';
import { Shelf } from '@/lib/mockData';

export function useMockShelves() {
  const [shelves, setShelves] = useState<Shelf[]>(mockShelves);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In a real app, this would fetch from API
  const fetchShelves = async () => {
    try {
      setLoading(true);
      setError(null);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      setShelves(mockShelves);
    } catch (err) {
      setError(`Failed to fetch shelves: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error fetching shelves:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new shelf
  const createShelf = async (shelfData: { name: string; description?: string; color?: string }) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newShelf = {
        id: `shelf-${Date.now()}`,
        name: shelfData.name,
        description: shelfData.description,
        color: shelfData.color,
        bookIds: []
      };
      
      setShelves(prev => [...prev, newShelf]);
      return newShelf;
    } catch (err) {
      console.error('Error creating shelf:', err);
      throw err;
    }
  };

  // Update a shelf
  const updateShelf = async (id: string, shelfData: { name?: string; description?: string; color?: string }) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const updatedShelf = {
        id,
        name: shelfData.name || '',
        description: shelfData.description,
        color: shelfData.color,
        bookIds: shelves.find(s => s.id === id)?.bookIds || []
      };
      
      setShelves(prev => 
        prev.map(shelf => 
          shelf.id === id ? updatedShelf : shelf
        )
      );
      
      return updatedShelf;
    } catch (err) {
      console.error('Error updating shelf:', err);
      throw err;
    }
  };

  // Delete a shelf
  const deleteShelf = async (id: string) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove from local state
      setShelves(prev => prev.filter(shelf => shelf.id !== id));
    } catch (err) {
      console.error('Error deleting shelf:', err);
      throw err;
    }
  };

  // Add a book to a shelf
  const addBookToShelf = async (shelfId: string, bookId: string) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update local state
      setShelves(prev => 
        prev.map(shelf => 
          shelf.id === shelfId 
            ? { ...shelf, bookIds: [...shelf.bookIds, bookId.toString()] } 
            : shelf
        )
      );
    } catch (err) {
      console.error('Error adding book to shelf:', err);
      throw err;
    }
  };

  // Remove a book from a shelf
  const removeBookFromShelf = async (shelfId: string, bookId: string) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update local state
      setShelves(prev => 
        prev.map(shelf => 
          shelf.id === shelfId 
            ? { ...shelf, bookIds: shelf.bookIds.filter(id => id !== bookId.toString()) } 
            : shelf
        )
      );
    } catch (err) {
      console.error('Error removing book from shelf:', err);
      throw err;
    }
  };

  // Load shelves on mount
  useEffect(() => {
    fetchShelves();
  }, []);

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