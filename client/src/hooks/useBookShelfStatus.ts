import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

interface BookShelfStatus {
  [bookId: string]: boolean;
}

// Simple in-memory cache with TTL
const shelfStatusCache = new Map<string, { status: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting: track last request time per book
const requestTimestamps = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 seconds between requests per book

export function useBookShelfStatus(bookIds: string[]) {
  const { user } = useAuth();
  const [shelfStatus, setShelfStatus] = useState<BookShelfStatus>({});
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const pendingRequests = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Function to check if a book is on shelf with caching and rate limiting
  const checkBookOnShelf = useCallback(async (bookId: string): Promise<boolean> => {
    if (!user || !bookId) return false;

    const cacheKey = `${user.id}-${bookId}`;
    const now = Date.now();

    // Check cache first
    const cached = shelfStatusCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.status;
    }

    // Check rate limit
    const lastRequest = requestTimestamps.get(bookId) || 0;
    if (now - lastRequest < RATE_LIMIT_MS) {
      // Return cached value if rate limited, or false if no cache
      return cached?.status ?? false;
    }

    // Check if already have a pending request for this book
    if (pendingRequests.current.has(bookId)) {
      // Wait for existing request to complete
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (!pendingRequests.current.has(bookId)) {
            clearInterval(interval);
            // Check cache again after request completes
            const newCached = shelfStatusCache.get(cacheKey);
            resolve(newCached?.status ?? false);
          }
        }, 100);
      });
    }

    // Mark as pending
    pendingRequests.current.add(bookId);
    requestTimestamps.set(bookId, now);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return false;
      }

      const response = await fetch(`/api/shelves/book/${bookId}/on-shelf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const isOnShelf = data.isOnShelf || false;
        
        // Update cache
        shelfStatusCache.set(cacheKey, { status: isOnShelf, timestamp: Date.now() });
        
        if (mountedRef.current) {
          setShelfStatus(prev => ({
            ...prev,
            [bookId]: isOnShelf
          }));
        }
        
        return isOnShelf;
      } else {
        // On error, return false but don't cache the error
        return false;
      }
    } catch (error) {
      console.warn(`Error checking shelf status for book ${bookId}:`, error);
      return false;
    } finally {
      // Remove from pending after completion
      pendingRequests.current.delete(bookId);
    }
  }, [user]);

  // Function to update status for all bookIds
  const updateShelfStatus = useCallback(async () => {
    if (!user || !bookIds || bookIds.length === 0) {
      setShelfStatus({});
      return;
    }

    setLoading(true);
    
    const newStatus: BookShelfStatus = {};
    for (const bookId of bookIds) {
      newStatus[bookId] = await checkBookOnShelf(bookId);
    }
    
    if (mountedRef.current) {
      setShelfStatus(newStatus);
      setLoading(false);
    }
  }, [user, bookIds, checkBookOnShelf]);

  // Update status when user or bookIds change
  useEffect(() => {
    updateShelfStatus();
  }, [updateShelfStatus]);

  const isBookOnShelf = useCallback((bookId: string) => {
    // Check cache first, then state
    const cacheKey = `${user?.id}-${bookId}`;
    const cached = shelfStatusCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.status;
    }
    return shelfStatus[bookId] || false;
  }, [shelfStatus, user]);

  // Function to manually refresh a specific book's status
  const refreshBookStatus = useCallback(async (bookId: string) => {
    // Clear cache for this book
    const cacheKey = `${user?.id}-${bookId}`;
    if (cacheKey) {
      shelfStatusCache.delete(cacheKey);
    }
    
    const status = await checkBookOnShelf(bookId);
    return status;
  }, [checkBookOnShelf, user]);

  return {
    isBookOnShelf,
    loading,
    shelfStatus,
    refreshBookStatus
  };
}