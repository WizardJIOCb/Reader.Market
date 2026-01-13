import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useBooks } from '@/hooks/useBooks';
import { useShelves } from '@/hooks/useShelves';
import { Book } from '@/hooks/useBooks';

export interface MainPageData {
  popularBooks: Book[];
  booksByGenre: { genre: string; books: Book[] }[];
  recentlyReviewedBooks: Book[];
  currentUserBooks: Book[];
  newReleases: Book[];
  shelfBooks: Book[];
}

export function useMainPageData() {
  const { user } = useAuth();
  const { fetchPopularBooks, fetchBooksByGenre, fetchRecentlyReviewedBooks, fetchCurrentUserBooks, fetchNewReleases, fetchBooksByIds } = useBooks();
  const { shelves, loading: shelvesLoading, error: shelvesError, fetchShelves } = useShelves();
  const [data, setData] = useState<MainPageData>({
    popularBooks: [],
    booksByGenre: [],
    recentlyReviewedBooks: [],
    currentUserBooks: [],
    newReleases: [],
    shelfBooks: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all main page data
  const fetchMainPageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch public data even without user
      const [popularBooks, recentlyReviewedBooks, newReleases] = await Promise.all([
        fetchPopularBooks(),
        fetchRecentlyReviewedBooks(),
        fetchNewReleases()
      ]);

      // Define genres we want to show
      const genres = ['Научная Фантастика', 'Детектив', 'Киберпанк'];
      
      // Fetch books for each genre
      const booksByGenrePromises = genres.map(async (genre) => {
        const books = await fetchBooksByGenre(genre);
        return { genre, books: books.slice(0, 3) }; // Limit to 3 books per genre
      });

      const booksByGenre = await Promise.all(booksByGenrePromises);

      // User-specific data only if logged in
      let currentUserBooks: Book[] = [];
      let shelfBooks: Book[] = [];
      
      if (user) {
        // Fetch shelves first
        await fetchShelves();
        
        // Fetch current user books
        currentUserBooks = await fetchCurrentUserBooks();
        
        // Get books from shelves
        const shelfBookIds = shelves.flatMap(shelf => shelf.bookIds || []);
        const uniqueShelfBookIds: string[] = [];
        const seenIds = new Set<string>();
        for (const id of shelfBookIds) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueShelfBookIds.push(id);
          }
        }
        
        // Fetch shelf books
        if (uniqueShelfBookIds.length > 0) {
          shelfBooks = await fetchBooksByIds(uniqueShelfBookIds);
        }

        // Combine current user books with shelf books
        const allUserBooks = [...currentUserBooks, ...shelfBooks];
        // Remove duplicates
        currentUserBooks = allUserBooks.filter((book, index, self) => 
          index === self.findIndex(b => b.id === book.id)
        );
      }

      setData({
        popularBooks: popularBooks.slice(0, 4), // Limit to 4 popular books
        booksByGenre,
        recentlyReviewedBooks: recentlyReviewedBooks.slice(0, 4), // Limit to 4 recently reviewed books
        currentUserBooks: currentUserBooks.slice(0, 4), // Limit to 4 current books (combined with shelf books)
        newReleases: newReleases.slice(0, 4), // Limit to 4 new releases
        shelfBooks: shelfBooks.slice(0, 4) // Shelf books for reference
      });
    } catch (err) {
      console.error('Error fetching main page data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load main page data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when user changes
  useEffect(() => {
    fetchMainPageData();
  }, [user, shelves]);

  return {
    data,
    loading,
    error,
    refresh: fetchMainPageData
  };
}