import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type User, type InsertUser, users, books, shelves, shelfBooks, readingProgress, bookmarks, readingStatistics, userStatistics, comments, reviews, reactions, messages, conversations, bookViewStatistics } from "@shared/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm/sql";

// Database connection
console.log("Connecting to database with URL:", process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Disable SSL for local development
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool);

// Helper function to check if a book has a valid rating
const hasValidRating = (book: any): boolean => {
  return book.rating !== null && 
         book.rating !== undefined && 
         book.rating !== '' && 
         !isNaN(Number(book.rating)) &&
         Number(book.rating) !== 0; // Treat 0 as no rating
};
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User>;
  
  // Book operations
  createBook(bookData: any): Promise<any>;
  getBook(id: string): Promise<any | undefined>;
  searchBooks(query: string): Promise<any[]>;
  deleteBook(id: string, userId: string): Promise<boolean>;
  getPopularBooks(): Promise<any[]>;
  getBooksByGenre(genre: string): Promise<any[]>;
  getRecentlyReviewedBooks(): Promise<any[]>;
  getCurrentUserBooks(userId: string): Promise<any[]>;
  getNewReleases(): Promise<any[]>;
  
  // Shelf operations
  createShelf(userId: string, shelfData: any): Promise<any>;
  getShelves(userId: string): Promise<any[]>;
  getShelf(id: string): Promise<any | undefined>;
  updateShelf(id: string, shelfData: any): Promise<any>;
  deleteShelf(id: string): Promise<void>;
  addBookToShelf(shelfId: string, bookId: string): Promise<void>;
  removeBookFromShelf(shelfId: string, bookId: string): Promise<void>;
  
  // Reading progress operations
  updateReadingProgress(userId: string, bookId: string, progress: any): Promise<any>;
  getReadingProgress(userId: string, bookId: string): Promise<any | undefined>;
  
  // Reading statistics operations
  updateReadingStatistics(userId: string, bookId: string, stats: any): Promise<any>;
  getReadingStatistics(userId: string, bookId: string): Promise<any | undefined>;
  getUserStatistics(userId: string): Promise<any | undefined>;
  updateUserStatistics(userId: string, stats: any): Promise<any>;
  
  // Bookmark operations
  createBookmark(bookmarkData: any): Promise<any>;
  getBookmarks(userId: string, bookId: string): Promise<any[]>;
  deleteBookmark(id: string): Promise<void>;
  
  // Comment operations
  createComment(commentData: any): Promise<any>;
  getComments(bookId: string): Promise<any[]>;
  deleteComment(id: string, userId: string): Promise<boolean>;
  
  // Review operations
  createReview(reviewData: any): Promise<any>;
  getReviews(bookId: string): Promise<any[]>;
  getUserReview(userId: string, bookId: string): Promise<any | undefined>;
  deleteReview(id: string, userId: string): Promise<boolean>;
  
  // Reaction operations
  createReaction(reactionData: any): Promise<any>;
  getReactions(commentOrReviewId: string, isComment: boolean): Promise<any[]>;
  getReactionsForItems(itemIds: string[], isComment: boolean): Promise<any[]>;
  deleteReaction(id: string, userId: string): Promise<boolean>;
  
  // Book view statistics operations
  incrementBookViewCount(bookId: string, viewType: string): Promise<any>;
  getBookViewStats(bookId: string): Promise<any>;
  
  // Messaging operations
  createMessage(messageData: any): Promise<any>;
  getMessagesBetweenUsers(senderId: string, recipientId: string): Promise<any[]>;
  getConversationsForUser(userId: string): Promise<any[]>;
  markMessageAsRead(messageId: string): Promise<void>;
  getUnreadMessagesCount(userId: string): Promise<number>;
}

export class DBStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log("getUserByUsername called with username:", username);
      const result = await db.select().from(users).where(eq(users.username, username));
      console.log("Database query completed, result length:", result.length);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      console.log("Creating user with data:", userData);
      const result = await db.insert(users).values(userData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    try {
      const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  async createBook(bookData: any): Promise<any> {
    try {
      const result = await db.insert(books).values(bookData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating book:", error);
      throw error;
    }
  }

  async getBook(id: string): Promise<any | undefined> {
    try {
      console.log(`Getting book with ID: ${id}`);
      const result = await db.select().from(books).where(eq(books.id, id));
      console.log(`Database result for book ${id}:`, result[0]);
      if (result[0]) {
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${result[0].id}`);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${result[0].id}`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${result[0].id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${result[0].id}
        ) AS activity`);
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(id);
        
        // Format dates for the frontend
        const formattedBook = {
          ...result[0],
          rating: result[0].rating !== null && result[0].rating !== undefined ? 
            (typeof result[0].rating === 'number' ? result[0].rating : parseFloat(result[0].rating.toString())) : 
            null,
          uploadedAt: result[0].uploadedAt ? result[0].uploadedAt.toISOString() : null,
          publishedAt: result[0].publishedAt ? result[0].publishedAt.toISOString() : null,
          createdAt: result[0].createdAt.toISOString(),
          updatedAt: result[0].updatedAt.toISOString(),
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
        console.log(`Formatted book ${id}:`, formattedBook);
        return formattedBook;
      }
      return result[0];
    } catch (error) {
      console.error("Error getting book:", error);
      return undefined;
    }
  }

  async searchBooks(query: string): Promise<any[]> {
    try {
      let result;
      if (query) {
        // First, perform a search based on the query across multiple fields, sorted by rating (descending, nulls last)
        // Use explicit collation to ensure Cyrillic characters are handled properly
        // Properly escape special characters for Cyrillic text
        const escapedQuery = query.replace(/[%_]/g, '\$&');
        const searchPattern = '%' + escapedQuery + '%';
        result = await db.select().from(books).where(
          sql`(LOWER(title) ILIKE LOWER(${searchPattern}) OR LOWER(author) ILIKE LOWER(${searchPattern}) OR LOWER(description) ILIKE LOWER(${searchPattern}) OR LOWER(genre) ILIKE LOWER(${searchPattern}))`
        ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
        
        // Additionally, for books with TXT files, search within the content
        // Get all books to check their file types
        const contentMatches: any[] = [];
        
        try {
          const allBooks = await db.select().from(books);
          
          // For TXT files, we'll search the content
          const fs = await import('fs');
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          
          // Get __dirname equivalent for ES modules
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          
          for (const book of allBooks) {
            // Check if this book has a TXT file
            if (book.filePath && book.filePath.endsWith('.txt')) {
              try {
                // Construct the full file path - handle both relative and absolute paths
                let fullPath;
                if (path.isAbsolute(book.filePath)) {
                  fullPath = book.filePath;
                } else {
                  // For relative paths, construct from the project root
                  fullPath = path.join(__dirname, '../../..', book.filePath);
                }
                
                // Check if file exists
                if (fs.existsSync(fullPath)) {
                  // Read file content
                  const content = fs.readFileSync(fullPath, 'utf8');
                  
                  // Check if query is in content
                  if (content.toLowerCase().includes(query.toLowerCase())) {
                    // Check if this book is not already in the results
                    const alreadyIncluded = result.some((r: any) => r.id === book.id);
                    if (!alreadyIncluded) {
                      contentMatches.push(book);
                    }
                  }
                }
              } catch (fileError) {
                console.warn(`Could not read file for book ${book.id}:`, fileError);
              }
            }
          }
          
          // Combine field matches with content matches
          result = [...result, ...contentMatches];
        } catch (contentSearchError) {
          console.warn('Content search failed, proceeding with metadata search only:', contentSearchError);
          // If content search fails (e.g., due to path resolution issues), continue with just metadata search
        }
      } else {
        // Return all books if no query, sorted by rating (descending, nulls last)
        result = await db.select().from(books).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      }
      
      // For books without ratings, calculate them
      for (const book of result) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      if (query) {
        // Use explicit collation to ensure Cyrillic characters are handled properly
        // Properly escape special characters for Cyrillic text
        const escapedQuery = query.replace(/[%_]/g, '\$&');
        const searchPattern = '%' + escapedQuery + '%';
        result = await db.select().from(books).where(
          sql`(LOWER(title) ILIKE LOWER(${searchPattern}) OR LOWER(author) ILIKE LOWER(${searchPattern}) OR LOWER(description) ILIKE LOWER(${searchPattern}) OR LOWER(genre) ILIKE LOWER(${searchPattern}))`
        ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      } else {
        // Return all books if no query, sorted by rating (descending, nulls last)
        result = await db.select().from(books).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      }
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(result.map(async (book) => {
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Format dates for the frontend
        return {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString(),
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...resultWithCounts].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return sortedBooks;
    } catch (error) {
      console.error("Error searching books:", error);
      return [];
    }
  }
  
  /**
   * Delete a book by ID if the user is the owner
   * @param id Book ID
   * @param userId User ID
   * @returns boolean indicating success
   */
  async deleteBook(id: string, userId: string): Promise<boolean> {
    try {
      // First, get the book to check ownership and get file paths
      // We need to get the raw book data to access the filePath
      const bookResult = await db.select().from(books).where(eq(books.id, id));
      const book = bookResult[0];
      
      if (!book) {
        return false; // Book not found
      }
      
      // Check if the user owns this book
      if (book.userId !== userId) {
        throw new Error("Unauthorized: You can only delete books you uploaded");
      }
      
      // Delete associated records first (in reverse order of dependencies)
      // Delete bookmarks
      await db.delete(bookmarks).where(eq(bookmarks.bookId, id));
      
      // Delete reading statistics
      await db.delete(readingStatistics).where(eq(readingStatistics.bookId, id));
      
      // Delete reading progress
      await db.delete(readingProgress).where(eq(readingProgress.bookId, id));
      
      // Remove book from all shelves
      await db.delete(shelfBooks).where(eq(shelfBooks.bookId, id));
      
      // Delete comments
      await db.delete(comments).where(eq(comments.bookId, id));
      
      // Delete reviews
      await db.delete(reviews).where(eq(reviews.bookId, id));
      
      // Delete the physical file if it exists
      if (book.filePath) {
        try {
          const path = await import('path');
          const fs = await import('fs');
          const { fileURLToPath } = await import('url');
          
          // Get __dirname equivalent for ES modules
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          
          // Construct the full file path - handle both relative and absolute paths
          let fullPath;
          if (path.isAbsolute(book.filePath)) {
            fullPath = book.filePath;
          } else {
            // For relative paths, construct from the project root
            fullPath = path.join(__dirname, '../..', book.filePath);
          }
          
          // Check if file exists and delete it
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted file: ${fullPath}`);
          }
        } catch (fileError) {
          console.warn(`Could not delete file for book ${id}:`, fileError);
          // Don't throw error here as we still want to delete the database record
        }
      }
      
      // Finally, delete the book itself
      const result = await db.delete(books).where(eq(books.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting book:", error);
      throw error;
    }
  }
  
  async getBooksByIds(bookIds: string[]): Promise<any[]> {
    try {
      if (bookIds.length === 0) return [];
      
      console.log('Fetching books with IDs:', bookIds);
      
      // First get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...resultWithCounts].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('Books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting books by IDs:", error);
      return [];
    }
  }
  
  async getPopularBooks(): Promise<any[]> {
    try {
      console.log('Fetching popular books');
      
      // Get books sorted by rating (descending, nulls last), limit to 20
      // Use SQL to ensure null ratings appear last
      const booksResult = await db.select().from(books).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...resultWithCounts].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('Popular books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting popular books:", error);
      return [];
    }
  }
  
  async getBooksByGenre(genre: string): Promise<any[]> {
    try {
      console.log('Fetching books by genre:', genre);
      
      // Get books filtered by genre and sorted by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(sql`LOWER(genre) LIKE LOWER('%' || ${genre} || '%')`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(sql`LOWER(genre) LIKE LOWER('%' || ${genre} || '%')`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...resultWithCounts].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('Books by genre fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting books by genre:", error);
      return [];
    }
  }
  
  async getRecentlyReviewedBooks(): Promise<any[]> {
    try {
      console.log('Fetching recently reviewed books');
      
      // Get books that have recent reviews (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // First get recent reviews
      const recentReviews = await db.select({
        bookId: reviews.bookId,
        createdAt: reviews.createdAt
      })
      .from(reviews)
      .where(sql`created_at > ${thirtyDaysAgo.toISOString()}`)
      .orderBy(desc(reviews.createdAt))
      .limit(20);
      
      // Get unique book IDs
      const bookIdsSet = new Set(recentReviews.map(review => review.bookId));
      const bookIds = Array.from(bookIdsSet);
      
      if (bookIds.length === 0) {
        return [];
      }
      
      // Get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...result].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('Recently reviewed books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting recently reviewed books:", error);
      return [];
    }
  }
  
  async getCurrentUserBooks(userId: string): Promise<any[]> {
    try {
      console.log('Fetching current user books for user ID:', userId);
      
      // Get books that the user is currently reading (have reading progress)
      const readingProgressRecords = await db.select({
        bookId: readingProgress.bookId,
        percentage: readingProgress.percentage
      })
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(20);
      
      const bookIds = readingProgressRecords.map(record => record.bookId);
      
      if (bookIds.length === 0) {
        return [];
      }
      
      // Get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...result].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('Current user books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting current user books:", error);
      return [];
    }
  }
  
  async getNewReleases(): Promise<any[]> {
    try {
      console.log('Fetching new releases');
      
      // Get books sorted by published date (descending, nulls last) and then by rating (descending, nulls last), limit to 20
      const booksResult = await db.select().from(books).orderBy(desc(sql`${books.publishedAt} NULLS LAST`), sql`rating DESC NULLS LAST`).limit(20);
      console.log('Books result from database:', booksResult.length);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).orderBy(desc(sql`${books.publishedAt} NULLS LAST`), sql`rating DESC NULLS LAST`).limit(20);
      console.log('Updated books result from database:', updatedBooksResult.length);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult.rows[0].latest_date ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString() : null
        };
      }));
      
      // Sort the books in JavaScript to ensure proper ordering
      // New sorting logic: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
      const sortedBooks = [...result].sort((a, b) => {
        // Convert ratings to numbers for comparison
        const ratingANum = a.rating ? Number(a.rating) : 0;
        const ratingBNum = b.rating ? Number(b.rating) : 0;
        
        // First sort by rating (descending)
        if (ratingBNum !== ratingANum) {
          return ratingBNum - ratingANum;
        }
        
        // If ratings are equal, sort by total engagement (reviews + comments) (descending)
        // Handle cases where counts might be undefined
        const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
        const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
        const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
        const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
        
        const totalEngagementA = reviewCountA + commentCountA;
        const totalEngagementB = reviewCountB + commentCountB;
        
        if (totalEngagementB !== totalEngagementA) {
          return totalEngagementB - totalEngagementA;
        }
        
        // If ratings and total engagement are equal, sort by creation date (descending - newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log('New releases fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting new releases:", error);
      return [];
    }
  }

  async createShelf(userId: string, shelfData: any): Promise<any> {
    try {
      const result = await db.insert(shelves).values({ ...shelfData, userId }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating shelf:", error);
      throw error;
    }
  }

  async getShelves(userId: string): Promise<any[]> {
    try {
      console.log('Fetching shelves for user ID:', userId);
      
      // First get all shelves for the user
      console.log('Executing database query for shelves');
      const userShelves = await db.select().from(shelves).where(eq(shelves.userId, userId));
      console.log('Database query for shelves completed');
      
      console.log('User shelves found:', userShelves);
      
      // Handle case where user has no shelves
      if (userShelves.length === 0) {
        console.log('No shelves found for user');
        return [];
      }
      
      // For each shelf, get the associated book IDs
      console.log('Processing shelves with books');
      const shelvesWithBooks = await Promise.all(userShelves.map(async (shelf) => {
        console.log('Fetching books for shelf ID:', shelf.id);
        
        // Get all book IDs for this shelf
        console.log('Executing database query for shelf books');
        const shelfBookRecords = await db.select().from(shelfBooks).where(eq(shelfBooks.shelfId, shelf.id));
        console.log('Database query for shelf books completed');
        const bookIds = shelfBookRecords.map(record => record.bookId);
        
        console.log('Book IDs for shelf', shelf.id, ':', bookIds);
        
        return {
          ...shelf,
          bookIds
        };
      }));
      console.log('Finished processing shelves with books');
      
      console.log('Shelves with books:', shelvesWithBooks);
      
      return shelvesWithBooks;
    } catch (error) {
      console.error("Error getting shelves:", error);
      return [];
    }
  }

  async getShelf(id: string): Promise<any | undefined> {
    try {
      console.log(`Getting shelf with ID: ${id}`);
      const result = await db.select().from(shelves).where(eq(shelves.id, id));
      console.log(`Database result for shelf ${id}:`, result[0]);
      return result[0];
    } catch (error) {
      console.error("Error getting shelf:", error);
      return undefined;
    }
  }

  async updateShelf(id: string, shelfData: any): Promise<any> {
    try {
      const result = await db.update(shelves).set(shelfData).where(eq(shelves.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating shelf:", error);
      throw error;
    }
  }

  async deleteShelf(id: string): Promise<void> {
    try {
      // First remove all book associations
      await db.delete(shelfBooks).where(eq(shelfBooks.shelfId, id));
      // Then delete the shelf itself
      await db.delete(shelves).where(eq(shelves.id, id));
    } catch (error) {
      console.error("Error deleting shelf:", error);
      throw error;
    }
  }

  async addBookToShelf(shelfId: string, bookId: string): Promise<void> {
    try {
      await db.insert(shelfBooks).values({ shelfId, bookId }).onConflictDoNothing();
    } catch (error) {
      console.error("Error adding book to shelf:", error);
      throw error;
    }
  }

  async removeBookFromShelf(shelfId: string, bookId: string): Promise<void> {
    try {
      await db.delete(shelfBooks).where(
        and(
          eq(shelfBooks.shelfId, shelfId),
          eq(shelfBooks.bookId, bookId)
        )
      );
    } catch (error) {
      console.error("Error removing book from shelf:", error);
      throw error;
    }
  }

  async updateReadingProgress(userId: string, bookId: string, progress: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(readingProgress)
        .set({ ...progress, updatedAt: new Date() })
        .where(and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        ))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(readingProgress)
          .values({ ...progress, userId, bookId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating reading progress:", error);
      throw error;
    }
  }

  async getReadingProgress(userId: string, bookId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(readingProgress).where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error getting reading progress:", error);
      return undefined;
    }
  }

  async updateReadingStatistics(userId: string, bookId: string, stats: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(readingStatistics)
        .set({ ...stats, updatedAt: new Date() })
        .where(and(
          eq(readingStatistics.userId, userId),
          eq(readingStatistics.bookId, bookId)
        ))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(readingStatistics)
          .values({ ...stats, userId, bookId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating reading statistics:", error);
      throw error;
    }
  }

  async getReadingStatistics(userId: string, bookId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(readingStatistics).where(
        and(
          eq(readingStatistics.userId, userId),
          eq(readingStatistics.bookId, bookId)
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error getting reading statistics:", error);
      return undefined;
    }
  }

  async getUserStatistics(userId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(userStatistics).where(eq(userStatistics.userId, userId));
      return result[0];
    } catch (error) {
      console.error("Error getting user statistics:", error);
      return undefined;
    }
  }

  async updateUserStatistics(userId: string, stats: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(userStatistics)
        .set({ ...stats, updatedAt: new Date() })
        .where(eq(userStatistics.userId, userId))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(userStatistics)
          .values({ ...stats, userId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating user statistics:", error);
      throw error;
    }
  }

  async createBookmark(bookmarkData: any): Promise<any> {
    try {
      const result = await db.insert(bookmarks).values(bookmarkData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bookmark:", error);
      throw error;
    }
  }

  async getBookmarks(userId: string, bookId: string): Promise<any[]> {
    try {
      const result = await db.select().from(bookmarks).where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.bookId, bookId)
        )
      );
      return result;
    } catch (error) {
      console.error("Error getting bookmarks:", error);
      return [];
    }
  }

  async deleteBookmark(id: string): Promise<void> {
    try {
      await db.delete(bookmarks).where(eq(bookmarks.id, id));
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      throw error;
    }
  }

  async createComment(commentData: any): Promise<any> {
    try {
      // Insert the comment
      const insertResult = await db.insert(comments).values(commentData).returning();
      
      // Get the comment with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, insertResult[0].id));
      
      // Format the response to match what the frontend expects
      const comment = result[0];
      return {
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  }

  async getComments(bookId: string): Promise<any[]> {
    try {
      // Get comments with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.bookId, bookId))
      .orderBy(desc(comments.createdAt));
      
      // Format the response to match what the frontend expects
      return result.map(comment => ({
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous',
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting comments:", error);
      return [];
    }
  }

  async deleteComment(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the comment belongs to the user
      const comment = await db.select().from(comments).where(eq(comments.id, id));
      if (!comment.length || comment[0].userId !== userId) {
        return false; // Comment not found or doesn't belong to user
      }
      
      // Delete associated reactions first
      await db.delete(reactions).where(eq(reactions.commentId, id));
      
      // Delete the comment
      await db.delete(comments).where(eq(comments.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  }

  async createReview(reviewData: any): Promise<any> {
    try {
      console.log('Creating review with data:', reviewData);
      // Insert the review
      const insertResult = await db.insert(reviews).values(reviewData).returning();
        
      console.log('Inserted review result:', insertResult[0]);
      // Get the review with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.id, insertResult[0].id));
        
      console.log('Selected review result:', result[0]);
      // Calculate and update the book's average rating
      console.log('Calling updateBookAverageRating for book:', reviewData.bookId);
      await this.updateBookAverageRating(reviewData.bookId);
        
      // Format the response to match what the frontend expects
      const review = result[0];
      return {
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error creating review:", error);
      throw error;
    }
  }
    
  async updateBookAverageRating(bookId: string): Promise<void> {
    try {
      console.log(`Updating average rating for book ${bookId}`);
      // Get all reviews for this book
      const bookReviews = await db.select().from(reviews).where(eq(reviews.bookId, bookId));
        
      console.log(`Found ${bookReviews.length} reviews for book ${bookId}`);
      if (bookReviews.length > 0) {
        // Calculate average rating
        const totalRating = bookReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / bookReviews.length;
        
        console.log(`Calculated average rating: ${averageRating} for book ${bookId}`);
          
        // Update the book's rating field
        // Ensure the rating is properly formatted for the database
        const formattedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place
        await db.update(books)
          .set({ rating: sql`${formattedRating}` })
          .where(eq(books.id, bookId));
          
        console.log(`Updated book ${bookId} rating to ${formattedRating}`);
      } else {
        // If no reviews, set rating to null
        await db.update(books)
          .set({ rating: null })
          .where(eq(books.id, bookId));
          
        console.log(`Set book ${bookId} rating to null (no reviews)`);
      }
    } catch (error) {
      console.error("Error updating book average rating:", error);
      // Don't throw error as this is a secondary operation
    }
  };

  async getReviews(bookId: string): Promise<any[]> {
    try {
      // Get reviews with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.bookId, bookId))
      .orderBy(desc(reviews.createdAt));
      
      // Format the response to match what the frontend expects
      return result.map(review => ({
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous',
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting reviews:", error);
      return [];
    }
  }

  async getUserReview(userId: string, bookId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(reviews).where(
        and(
          eq(reviews.userId, userId),
          eq(reviews.bookId, bookId)
        )
      );
      
      if (result.length === 0) {
        return undefined;
      }
      
      return result[0];
    } catch (error) {
      console.error("Error getting user review:", error);
      return undefined;
    }
  }

  async deleteReview(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the review belongs to the user
      const review = await db.select().from(reviews).where(eq(reviews.id, id));
      if (!review.length || review[0].userId !== userId) {
        return false; // Review not found or doesn't belong to user
      }
      
      const bookId = review[0].bookId;
      
      // Delete associated reactions first
      await db.delete(reactions).where(eq(reactions.reviewId, id));
      
      // Delete the review
      await db.delete(reviews).where(eq(reviews.id, id));
      
      // Recalculate and update the book's average rating
      await this.updateBookAverageRating(bookId);
      
      return true;
    } catch (error) {
      console.error("Error deleting review:", error);
      throw error;
    }
  }

  async createReaction(reactionData: any): Promise<any> {
    try {
      console.log('Creating reaction with data:', reactionData);
      
      // Validate that commentId or reviewId is provided and not empty
      if (!reactionData.commentId && !reactionData.reviewId) {
        throw new Error('Either commentId or reviewId is required');
      }
      
      if (reactionData.commentId && reactionData.reviewId) {
        throw new Error('Only one of commentId or reviewId should be provided');
      }
      
      if (reactionData.commentId === '' || reactionData.reviewId === '') {
        throw new Error('commentId or reviewId cannot be empty');
      }
      
      // Check if the user already reacted with the same emoji to the same item
      const condition = and(
        eq(reactions.userId, reactionData.userId),
        eq(reactions.emoji, reactionData.emoji),
        reactionData.commentId ? eq(reactions.commentId, reactionData.commentId) : eq(reactions.reviewId, reactionData.reviewId)
      );
      
      console.log('Query condition:', condition);
      
      const existingReactions = await db.select().from(reactions).where(condition);
      
      console.log('Existing reactions found:', existingReactions.length);
      if (existingReactions.length > 0) {
        console.log('Existing reaction details:', existingReactions[0]);
      }
      
      if (existingReactions.length > 0) {
        // If reaction exists, remove it (toggle off)
        console.log('Removing existing reaction with ID:', existingReactions[0].id);
        await db.delete(reactions).where(eq(reactions.id, existingReactions[0].id));
        return { removed: true, id: existingReactions[0].id };
      } else {
        // If reaction doesn't exist, create it
        console.log('Inserting new reaction');
        const result = await db.insert(reactions).values(reactionData).returning();
        console.log('Created reaction:', result[0]);
        return { created: true, reaction: result[0] };
      }
    } catch (error) {
      console.error("Error creating reaction:", error);
      throw error;
    }
  }

  async getReactions(commentOrReviewId: string, isComment: boolean): Promise<any[]> {
    try {
      const result = await db.select({
        id: reactions.id,
        userId: reactions.userId,
        commentId: reactions.commentId,
        reviewId: reactions.reviewId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(reactions)
      .leftJoin(users, eq(reactions.userId, users.id))
      .where(isComment 
        ? eq(reactions.commentId, commentOrReviewId)
        : eq(reactions.reviewId, commentOrReviewId));
      
      return result;
    } catch (error) {
      console.error("Error getting reactions:", error);
      return [];
    }
  }

  async getReactionsForItems(itemIds: string[], isComment: boolean): Promise<any[]> {
    try {
      if (itemIds.length === 0) return [];
      
      const result = await db.select({
        id: reactions.id,
        userId: reactions.userId,
        commentId: reactions.commentId,
        reviewId: reactions.reviewId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt
      })
      .from(reactions)
      .where(isComment 
        ? inArray(reactions.commentId, itemIds)
        : inArray(reactions.reviewId, itemIds));
      
      return result;
    } catch (error) {
      console.error("Error getting reactions for items:", error);
      return [];
    }
  }
  
  async deleteReaction(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the reaction belongs to the user
      const reaction = await db.select().from(reactions).where(eq(reactions.id, id));
      if (!reaction.length || reaction[0].userId !== userId) {
        return false; // Reaction not found or doesn't belong to user
      }
      
      // Delete the reaction
      await db.delete(reactions).where(eq(reactions.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting reaction:", error);
      throw error;
    }
  }
  
  async createMessage(messageData: any): Promise<any> {
    try {
      // Insert the message
      const result = await db.insert(messages).values(messageData).returning();
      
      // Get the inserted message with sender and recipient information
      const fullMessage = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.id, result[0].id));
      
      return fullMessage[0];
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }
  
  async getMessagesBetweenUsers(senderId: string, recipientId: string): Promise<any[]> {
    try {
      // Get messages between these two users (both directions)
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        sql`${messages.senderId} IN (${senderId}, ${recipientId}) AND ${messages.recipientId} IN (${senderId}, ${recipientId})`
      )
      .orderBy(messages.createdAt);
      
      // Format the messages
      return result.map(message => ({
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        readStatus: message.readStatus,
        sender: message.senderFullName || message.senderUsername || 'Anonymous'
      }));
    } catch (error) {
      console.error("Error getting messages between users:", error);
      return [];
    }
  }
  
  async getConversationsForUser(userId: string): Promise<any[]> {
    try {
      // Get all conversations where the user is either user1 or user2
      const result = await db.select({
        id: conversations.id,
        user1Id: conversations.user1Id,
        user2Id: conversations.user2Id,
        lastMessageId: conversations.lastMessageId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        // Get information about the other user in the conversation
        otherUserId: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN ${conversations.user2Id} ELSE ${conversations.user1Id} END`,
        otherUsername: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN user2.username ELSE user1.username END`,
        otherFullName: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN user2.full_name ELSE user1.full_name END`,
        // Get the last message content and time
        lastMessageContent: messages.content,
        lastMessageCreatedAt: messages.createdAt,
        lastMessageSenderId: messages.senderId,
      })
      .from(conversations)
      .leftJoin(users, sql`${users.id} IN (${conversations.user1Id}, ${conversations.user2Id})`)
      .leftJoin(users as any, eq((users as any).id, conversations.user1Id), 'user1')
      .leftJoin(users as any, eq((users as any).id, conversations.user2Id), 'user2')
      .leftJoin(messages, eq(messages.id, conversations.lastMessageId))
      .where(
        sql`${conversations.user1Id} = ${userId} OR ${conversations.user2Id} = ${userId}`
      )
      .orderBy(sql`${conversations.updatedAt} DESC`);
      
      // Simplified approach to get conversations
      // First get all messages where user is sender or recipient
      const allMessages = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
      })
      .from(messages)
      .where(
        sql`${messages.senderId} = ${userId} OR ${messages.recipientId} = ${userId}`
      )
      .orderBy(messages.createdAt.desc());
      
      // Group messages by the other participant
      const conversationsMap: { [key: string]: any } = {};
      
      for (const msg of allMessages) {
        const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
        
        if (!conversationsMap[otherUserId]) {
          // Get the other user's information
          const otherUser = await db.select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          }).from(users).where(eq(users.id, otherUserId));
          
          conversationsMap[otherUserId] = {
            userId: otherUser[0].id,
            username: otherUser[0].username,
            fullName: otherUser[0].fullName,
            avatarUrl: otherUser[0].avatarUrl,
            lastMessage: {
              id: msg.id,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
              isOwnMessage: msg.senderId === userId,
            },
            unreadCount: 0, // We'll calculate this separately
          };
        }
      }
      
      // Calculate unread counts for each conversation
      for (const otherUserId in conversationsMap) {
        const unreadCount = await db.execute(sql`SELECT COUNT(*) as count FROM messages WHERE sender_id != ${userId} AND recipient_id = ${userId} AND read_status = false`);
        conversationsMap[otherUserId].unreadCount = parseInt(unreadCount.rows[0].count);
      }
      
      return Object.values(conversationsMap);
    } catch (error) {
      console.error("Error getting conversations for user:", error);
      return [];
    }
  }
  
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await db.update(messages)
        .set({ readStatus: true, updatedAt: new Date() })
        .where(eq(messages.id, messageId));
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }
  
  async getUnreadMessagesCount(userId: string): Promise<number> {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM messages WHERE recipient_id = ${userId} AND read_status = false`);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error("Error getting unread messages count:", error);
      return 0;
    }
  }
  
  async incrementBookViewCount(bookId: string, viewType: string): Promise<any> {
    try {
      // Use upsert to atomically increment the view count
      const result = await db.insert(bookViewStatistics)
        .values({ 
          bookId, 
          viewType, 
          viewCount: 1,
          lastViewedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [bookViewStatistics.bookId, bookViewStatistics.viewType],
          set: {
            viewCount: sql`${bookViewStatistics.viewCount} + 1`,
            lastViewedAt: new Date(),
            updatedAt: new Date()
          }
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error incrementing book view count:", error);
      throw error;
    }
  }
  
  async getBookViewStats(bookId: string): Promise<any> {
    try {
      const results = await db.select().from(bookViewStatistics).where(eq(bookViewStatistics.bookId, bookId));
      
      // Organize the stats by view type
      const stats: any = {};
      results.forEach(row => {
        stats[row.viewType] = row.viewCount;
      });
      
      return stats;
    } catch (error) {
      console.error("Error getting book view stats:", error);
      return {};
    }
  }
}
export const storage = new DBStorage();