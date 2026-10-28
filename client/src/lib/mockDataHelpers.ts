import { mockBooks, mockComments, mockReviews, mockUser } from './mockData';

// Helper functions to get data by ID
export const getBookById = (id: string) => {
  // Try to parse as number first
  const numericId = parseInt(id);
  if (!isNaN(numericId)) {
    // Look for exact match
    const book = mockBooks.find(book => book.id === numericId);
    if (book) return book;
  }
  
  // For UUIDs or invalid numeric IDs, we'll map to our first mock book
  // In a real app, this would be a proper lookup
  // Always return the first mock book for any non-numeric ID (including UUIDs)
  if (mockBooks.length > 0) {
    return mockBooks[0]; // Return the first book for UUIDs or any other ID
  }
  return undefined;
};

export const getCommentsByBookId = (bookId: string) => {
  // Try to parse as number first
  const numericId = parseInt(bookId);
  if (!isNaN(numericId)) {
    // Filter comments for this specific book ID
    return mockComments.filter(comment => comment.bookId === numericId);
  }
  
  // For UUIDs, we'll return comments for the first book
  if (bookId && mockComments.length > 0) {
    const firstBookId = mockBooks[0]?.id || 1;
    return mockComments.filter(comment => comment.bookId === firstBookId);
  }
  return [];
};

export const getReviewsByBookId = (bookId: string) => {
  // Try to parse as number first
  const numericId = parseInt(bookId);
  if (!isNaN(numericId)) {
    // Filter reviews for this specific book ID
    return mockReviews.filter(review => review.bookId === numericId);
  }
  
  // For UUIDs, we'll return reviews for the first book
  if (bookId && mockReviews.length > 0) {
    const firstBookId = mockBooks[0]?.id || 1;
    return mockReviews.filter(review => review.bookId === firstBookId);
  }
  return [];
};

export const getUserReadingStatsForBook = (userId: string, bookId: string) => {
  // Try to parse as number first
  const numericId = parseInt(bookId);
  
  // For UUIDs or invalid numeric IDs, we'll return stats for the first book
  if (userId === mockUser.id && mockUser.readingProgress && mockUser.readingProgress.length > 0) {
    // Try to find stats for the specific book if it's a valid numeric ID
    if (!isNaN(numericId)) {
      const stats = mockUser.readingProgress.find(progress => progress.bookId === numericId);
      if (stats) return stats;
    }
    
    // Fallback to first progress item
    return mockUser.readingProgress[0];
  }
  return null;
};