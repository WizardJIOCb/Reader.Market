import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type User, type InsertUser, users, books, shelves, shelfBooks, readingProgress, bookmarks, readingStatistics, userStatistics, comments, reviews, reactions, messages, conversations, bookViewStatistics, news, groups, groupMembers, groupBooks, channels, messageReactions, notifications } from "@shared/schema";
import { eq, and, inArray, desc, asc, sql, or, ilike, isNull } from "drizzle-orm";

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
  getAllComments(): Promise<any[]>;
  updateComment(id: string, commentData: any): Promise<any>;
  deleteComment(id: string, userId: string | null): Promise<boolean>;
  
  // Review operations
  createReview(reviewData: any): Promise<any>;
  getReviews(bookId: string): Promise<any[]>;
  getAllReviews(): Promise<any[]>;
  getUserReview(userId: string, bookId: string): Promise<any | undefined>;
  updateReview(id: string, reviewData: any): Promise<any>;
  deleteReview(id: string, userId: string | null): Promise<boolean>;
  
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
  deleteMessage(id: string, userId: string | null): Promise<boolean>;
  
  // News operations
  createNews(newsData: any): Promise<any>;
  getNews(id: string): Promise<any | undefined>;
  getPublishedNews(): Promise<any[]>;
  getAllNews(): Promise<any[]>;
  updateNews(id: string, newsData: any): Promise<any>;
  deleteNews(id: string): Promise<void>;
  updateAccessLevel(userId: string, accessLevel: string): Promise<User>;
  getUsersWithStats(limit: number, offset: number): Promise<any[]>;
  getRecentActivity(limit: number): Promise<any[]>;
  getNewsCountSince(date: Date): Promise<number>;
  getCommentsCountSince(date: Date): Promise<number>;
  getReviewsCountSince(date: Date): Promise<number>;
  
  // Admin book operations
  getAllBooksWithUploader(limit: number, offset: number, search?: string, sortBy?: string, sortOrder?: string): Promise<{books: any[], total: number}>;
  updateBookAdmin(id: string, bookData: any): Promise<any>;
  deleteBookAdmin(id: string): Promise<boolean>;
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${result[0].id}`);
        
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
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
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
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
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
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: parseInt(commentCountResult.rows[0].count as string),
          reviewCount: parseInt(reviewCountResult.rows[0].count as string),
          shelfCount: shelfCountResult.rows[0] && shelfCountResult.rows[0].count !== undefined ? parseInt(shelfCountResult.rows[0].count as string) : 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
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
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
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
        avatarUrl: comment.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting comments:", error);
      return [];
    }
  }

  async getAllComments(): Promise<any[]> {
    try {
      // Get all comments with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
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
        avatarUrl: comment.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting all comments:", error);
      return [];
    }
  }

  async deleteComment(id: string, userId: string | null): Promise<boolean> {
    try {
      const comment = await db.select().from(comments).where(eq(comments.id, id));
      if (!comment.length) {
        return false; // Comment not found
      }
      
      // If userId is provided, verify it belongs to the user (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && comment[0].userId !== userId) {
        return false; // Not the owner and not an admin action
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

  async updateComment(id: string, commentData: any): Promise<any> {
    try {
      // Update the comment
      const updateResult = await db.update(comments)
        .set({ ...commentData, updatedAt: new Date() })
        .where(eq(comments.id, id))
        .returning();
      
      if (updateResult.length === 0) {
        return null; // Comment not found
      }
      
      // Get the updated comment with user information
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
      .where(eq(comments.id, updateResult[0].id));
      
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
      console.error("Error updating comment:", error);
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
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
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
        avatarUrl: review.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting reviews:", error);
      return [];
    }
  }

  async getAllReviews(): Promise<any[]> {
    try {
      // Get all reviews with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
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
        avatarUrl: review.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting all reviews:", error);
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

  async deleteReview(id: string, userId: string | null): Promise<boolean> {
    try {
      const review = await db.select().from(reviews).where(eq(reviews.id, id));
      if (!review.length) {
        return false; // Review not found
      }
      
      // If userId is provided, verify it belongs to the user (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && review[0].userId !== userId) {
        return false; // Not the owner and not an admin action
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

  async updateReview(id: string, reviewData: any): Promise<any> {
    try {
      // Get the current review to access the bookId before update
      const currentReview = await db.select().from(reviews).where(eq(reviews.id, id));
      if (currentReview.length === 0) {
        return null; // Review not found
      }
      
      const bookId = currentReview[0].bookId;
      
      // Update the review
      const updateResult = await db.update(reviews)
        .set({ ...reviewData, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      
      if (updateResult.length === 0) {
        return null; // Review not found
      }
      
      // Get the updated review with user information
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
      .where(eq(reviews.id, updateResult[0].id));
      
      // Recalculate and update the book's average rating
      await this.updateBookAverageRating(bookId);
      
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
      console.error("Error updating review:", error);
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
      .leftJoin(users as any, sql`${(users as any).id} IN (${conversations.user1Id}, ${conversations.user2Id})`)
      .leftJoin(users as any, eq((users as any).id, conversations.user1Id))
      .leftJoin(users as any, eq((users as any).id, conversations.user2Id))
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
      .orderBy(desc(messages.createdAt));
      
      // Group messages by the other participant
      const conversationsMap: { [key: string]: any } = {};
      
      for (const msg of allMessages) {
        const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
        
        // Skip if otherUserId is null
        if (!otherUserId) continue;
        
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
        conversationsMap[otherUserId].unreadCount = parseInt(unreadCount.rows[0].count as string);
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
      return parseInt(result.rows[0].count as string);
    } catch (error) {
      console.error("Error getting unread messages count:", error);
      return 0;
    }
  }
  
  async deleteMessage(id: string, userId: string | null): Promise<boolean> {
    try {
      // Get the message to check if it exists
      const message = await db.select().from(messages).where(eq(messages.id, id));
      if (!message.length) {
        return false; // Message not found
      }
      
      // If userId is provided, verify it's the sender (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && message[0].senderId !== userId) {
        return false; // Not the sender and not an admin action
      }
      
      // Delete the message
      await db.delete(messages).where(eq(messages.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
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
  
  async getNewsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM news WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting news count since date:", error);
      return 0;
    }
  }
  
  async getCommentsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting comments count since date:", error);
      return 0;
    }
  }
  
  async getReviewsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting reviews count since date:", error);
      return 0;
    }
  }
  
  async createNews(newsData: any): Promise<any> {
    try {
      // Insert the news item
      const result = await db.insert(news).values(newsData).returning();
      
      // Get the news with author information
      const newsWithAuthor = await db.select({
        id: news.id,
        title: news.title,
        content: news.content,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(eq(news.id, result[0].id));
      
      const newsItem = newsWithAuthor[0];
      return {
        id: newsItem.id,
        title: newsItem.title,
        content: newsItem.content,
        authorId: newsItem.authorId,
        published: newsItem.published,
        publishedAt: newsItem.publishedAt?.toISOString() || null,
        createdAt: newsItem.createdAt.toISOString(),
        updatedAt: newsItem.updatedAt.toISOString(),
        author: newsItem.fullName || newsItem.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error creating news:", error);
      throw error;
    }
  }
  
  async getNews(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(news).where(eq(news.id, id));
      
      if (result.length === 0) {
        return undefined;
      }
      
      return result[0];
    } catch (error) {
      console.error("Error getting news:", error);
      return undefined;
    }
  }
  
  async getPublishedNews(): Promise<any[]> {
    try {
      // Get published news ordered by creation date (newest first)
      const result = await db.select({
        id: news.id,
        title: news.title,
        content: news.content,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(eq(news.published, true))
      .orderBy(desc(news.createdAt));
      
      // Format the response
      return result.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        authorId: item.authorId,
        published: item.published,
        publishedAt: item.publishedAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: item.fullName || item.username || 'Anonymous',
        avatarUrl: item.avatarUrl || null
      }));
    } catch (error) {
      console.error("Error getting published news:", error);
      return [];
    }
  }
  
  async getAllNews(): Promise<any[]> {
    try {
      // Get all news ordered by creation date (newest first)
      const result = await db.select({
        id: news.id,
        title: news.title,
        content: news.content,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .orderBy(desc(news.createdAt));
        
      // Format the response
      return result.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        authorId: item.authorId,
        published: item.published,
        publishedAt: item.publishedAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: item.fullName || item.username || 'Anonymous',
        avatarUrl: item.avatarUrl || null
      }));
    } catch (error) {
      console.error("Error getting all news:", error);
      return [];
    }
  }
  
  async updateNews(id: string, newsData: any): Promise<any> {
    try {
      const result = await db.update(news)
        .set({ ...newsData, updatedAt: new Date() })
        .where(eq(news.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating news:", error);
      throw error;
    }
  }
  
  async deleteNews(id: string): Promise<void> {
    try {
      await db.delete(news).where(eq(news.id, id));
    } catch (error) {
      console.error("Error deleting news:", error);
      throw error;
    }
  }
  
  async updateAccessLevel(userId: string, accessLevel: string): Promise<User> {
    try {
      const result = await db.update(users)
        .set({ accessLevel, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      if (result.length === 0) {
        throw new Error('User not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating access level:", error);
      throw error;
    }
  }
  
  async getUsersWithStats(limit: number, offset: number): Promise<any[]> {
    try {
      // Get users with basic information
      const usersResult = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        accessLevel: users.accessLevel,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
      
      // For each user, get their statistics
      const usersWithStats = await Promise.all(usersResult.map(async (user) => {
        // Get last login date from the most recent activity
        const lastLoginResult = await db.execute(sql`
          SELECT MAX(created_at) as last_login 
          FROM (
            SELECT created_at FROM comments WHERE user_id = ${user.id}
            UNION ALL
            SELECT created_at FROM reviews WHERE user_id = ${user.id}
            UNION ALL
            SELECT created_at FROM messages WHERE sender_id = ${user.id}
            UNION ALL
            SELECT created_at FROM news WHERE author_id = ${user.id}
          ) AS activity
        `);
        
        const lastLogin = lastLoginResult.rows[0].last_login ? new Date(lastLoginResult.rows[0].last_login as string) : null;
        
        // Count shelves for the user
        const shelvesResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelves WHERE user_id = ${user.id}`);
        const shelvesCount = parseInt(shelvesResult.rows[0].count as string);
        
        // Count books on shelves for the user
        const booksOnShelvesResult = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM shelf_books 
          WHERE shelf_id IN (
            SELECT id FROM shelves WHERE user_id = ${user.id}
          )
        `);
        const booksOnShelvesCount = parseInt(booksOnShelvesResult.rows[0].count as string);
        
        // Count comments for the user
        const commentsResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE user_id = ${user.id}`);
        const commentsCount = parseInt(commentsResult.rows[0].count as string);
        
        // Count reviews for the user
        const reviewsResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE user_id = ${user.id}`);
        const reviewsCount = parseInt(reviewsResult.rows[0].count as string);
        
        return {
          ...user,
          lastLogin: lastLogin ? lastLogin.toISOString() : null,
          shelvesCount,
          booksOnShelvesCount,
          commentsCount,
          reviewsCount,
        };
      }));
      
      return usersWithStats;
    } catch (error) {
      console.error("Error getting users with stats:", error);
      throw error;
    }
  }
  
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    try {
      // Get recent comments and reviews together, ordered by creation date
      const recentComments = await db.select({
        id: comments.id,
        type: sql`'comment'`.as('type'),
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userId: comments.userId,
        bookId: comments.bookId,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .orderBy(desc(comments.createdAt))
      .limit(limit);
      
      const recentReviews = await db.select({
        id: reviews.id,
        type: sql`'review'`.as('type'),
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
      
      // Combine and sort both arrays by creation date
      const allActivity = [
        ...recentComments.map(comment => ({
          id: comment.id,
          type: comment.type,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          userId: comment.userId,
          bookId: comment.bookId,
          author: comment.fullName || comment.username || 'Anonymous',
          avatarUrl: comment.avatarUrl || null,
          rating: null // Comments don't have ratings
        })),
        ...recentReviews.map(review => ({
          id: review.id,
          type: review.type,
          content: review.content,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
          userId: review.userId,
          bookId: review.bookId,
          author: review.fullName || review.username || 'Anonymous',
          avatarUrl: review.avatarUrl || null,
          rating: review.rating
        }))
      ];
      
      // Sort by creation date (newest first)
      allActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Return only the requested limit
      return allActivity.slice(0, limit);
    } catch (error) {
      console.error("Error getting recent activity:", error);
      return [];
    }
  }

  // Admin book operations
  async getAllBooksWithUploader(limit: number, offset: number, search?: string, sortBy?: string, sortOrder?: string): Promise<{books: any[], total: number}> {
    try {
      let query = db
        .select({
          id: books.id,
          title: books.title,
          author: books.author,
          description: books.description,
          coverImageUrl: books.coverImageUrl,
          filePath: books.filePath,
          fileSize: books.fileSize,
          fileType: books.fileType,
          genre: books.genre,
          publishedYear: books.publishedYear,
          rating: books.rating,
          userId: books.userId,
          uploaderUsername: users.username,
          uploaderFullName: users.fullName,
          uploadedAt: books.uploadedAt,
          publishedAt: books.publishedAt,
          createdAt: books.createdAt,
          updatedAt: books.updatedAt
        })
        .from(books)
        .leftJoin(users, eq(books.userId, users.id));

      // Apply search filter if provided
      if (search && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        query = query.where(
          sql`LOWER(${books.title}) LIKE LOWER(${searchPattern}) 
           OR LOWER(${books.author}) LIKE LOWER(${searchPattern}) 
           OR LOWER(${books.genre}) LIKE LOWER(${searchPattern})`
        ) as any;
      }

      // Get total count
      const countQuery = search && search.trim() 
        ? db.select({ count: sql<number>`count(*)` })
            .from(books)
            .where(
              sql`LOWER(${books.title}) LIKE LOWER(${'%' + search.trim() + '%'}) 
               OR LOWER(${books.author}) LIKE LOWER(${'%' + search.trim() + '%'}) 
               OR LOWER(${books.genre}) LIKE LOWER(${'%' + search.trim() + '%'})`
            )
        : db.select({ count: sql<number>`count(*)` }).from(books);
      
      const totalResult = await countQuery;
      const total = Number(totalResult[0]?.count || 0);

      // Apply sorting
      const sortColumn = sortBy === 'title' ? books.title 
                       : sortBy === 'rating' ? books.rating 
                       : books.uploadedAt;
      const sortDirection = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
      
      query = query.orderBy(sortDirection) as any;

      // Apply pagination
      const result = await query.limit(limit).offset(offset);

      // Format the results
      const formattedBooks = result.map(book => ({
        ...book,
        rating: book.rating !== null && book.rating !== undefined ? 
          (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
          null,
        uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
        publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString()
      }));

      return {
        books: formattedBooks,
        total
      };
    } catch (error) {
      console.error("Error getting all books with uploader:", error);
      throw error;
    }
  }

  async updateBookAdmin(id: string, bookData: any): Promise<any> {
    try {
      const updateData: any = {
        ...bookData,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const result = await db.update(books)
        .set(updateData)
        .where(eq(books.id, id))
        .returning();

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      console.error("Error updating book (admin):", error);
      throw error;
    }
  }

  async deleteBookAdmin(id: string): Promise<boolean> {
    try {
      // Delete in the correct order to respect foreign key constraints
      
      // 1. Delete reactions on comments and reviews for this book
      const bookComments = await db.select({ id: comments.id }).from(comments).where(eq(comments.bookId, id));
      const bookReviews = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookId, id));
      
      const commentIds = bookComments.map(c => c.id);
      const reviewIds = bookReviews.map(r => r.id);
      
      if (commentIds.length > 0) {
        await db.delete(reactions).where(sql`${reactions.commentId} IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      if (reviewIds.length > 0) {
        await db.delete(reactions).where(sql`${reactions.reviewId} IN (${sql.join(reviewIds.map(id => sql`${id}`), sql`, `)})`);
      }

      // 2. Delete comments
      await db.delete(comments).where(eq(comments.bookId, id));

      // 3. Delete reviews
      await db.delete(reviews).where(eq(reviews.bookId, id));

      // 4. Delete bookmarks
      await db.delete(bookmarks).where(eq(bookmarks.bookId, id));

      // 5. Delete reading statistics
      await db.delete(readingStatistics).where(eq(readingStatistics.bookId, id));

      // 6. Delete reading progress
      await db.delete(readingProgress).where(eq(readingProgress.bookId, id));

      // 7. Delete book view statistics
      await db.delete(bookViewStatistics).where(eq(bookViewStatistics.bookId, id));

      // 8. Delete shelf associations
      await db.delete(shelfBooks).where(eq(shelfBooks.bookId, id));

      // 9. Finally delete the book itself
      const result = await db.delete(books).where(eq(books.id, id)).returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting book (admin):", error);
      throw error;
    }
  }

  // New messaging system methods
  async getConversation(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(conversations).where(eq(conversations.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting conversation:", error);
      return undefined;
    }
  }

  async findConversationBetweenUsers(userId1: string, userId2: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(conversations).where(
        or(
          and(eq(conversations.user1Id, userId1), eq(conversations.user2Id, userId2)),
          and(eq(conversations.user1Id, userId2), eq(conversations.user2Id, userId1))
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error finding conversation between users:", error);
      return undefined;
    }
  }

  async createConversation(userId1: string, userId2: string): Promise<any> {
    try {
      const result = await db.insert(conversations).values({
        user1Id: userId1,
        user2Id: userId2,
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  async updateConversationLastMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      await db.update(conversations)
        .set({ lastMessageId: messageId, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } catch (error) {
      console.error("Error updating conversation last message:", error);
      throw error;
    }
  }

  async getConversationMessages(conversationId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
        senderAvatarUrl: users.avatarUrl,
      })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
      return result;
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      return [];
    }
  }

  async markConversationMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await db.update(messages)
        .set({ readStatus: true })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.recipientId, userId),
            eq(messages.readStatus, false)
          )
        );
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.recipientId, userId),
            eq(messages.readStatus, false)
          )
        );
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting unread message count:", error);
      return 0;
    }
  }

  async getMessage(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(messages).where(eq(messages.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting message:", error);
      return undefined;
    }
  }

  async getUserConversations(userId: string): Promise<any[]> {
    console.log('[getUserConversations] Called with userId:', userId);
    try {
      // Use sql.raw for the query with manual parameter binding
      const queryResult: any = await pool.query(
        `SELECT id, user1_id as "user1Id", user2_id as "user2Id", 
               last_message_id as "lastMessageId", created_at as "createdAt", 
               updated_at as "updatedAt"
        FROM conversations
        WHERE user1_id = $1 OR user2_id = $1
        ORDER BY updated_at DESC`,
        [userId]
      );
      
      const result = queryResult.rows as any[];

      console.log('[getUserConversations] Raw query result:', result.length, 'conversations');
      console.log('[getUserConversations] First conversation:', result[0]);

      // Fetch other user info, last message, and unread count for each conversation
      const conversationsWithDetails = await Promise.all(
        result.map(async (conv) => {
          const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
          console.log('[getUserConversations] Fetching other user:', otherUserId);
          const otherUser = await this.getUser(otherUserId);
          console.log('[getUserConversations] Other user found:', otherUser?.username);
          
          let lastMessage = null;
          if (conv.lastMessageId) {
            lastMessage = await this.getMessage(conv.lastMessageId);
          }

          // Count unread messages where current user is recipient
          const unreadResult: any = await pool.query(
            `SELECT COUNT(*) as count 
             FROM messages 
             WHERE conversation_id = $1 
               AND recipient_id = $2 
               AND read_status = false 
               AND deleted_at IS NULL`,
            [conv.id, userId]
          );
          const unreadCount = parseInt(unreadResult.rows[0]?.count || '0');

          return {
            ...conv,
            otherUser: otherUser ? {
              id: otherUser.id,
              username: otherUser.username,
              fullName: otherUser.fullName,
              avatarUrl: otherUser.avatarUrl,
            } : null,
            lastMessage,
            unreadCount,
          };
        })
      );

      console.log('[getUserConversations] Returning', conversationsWithDetails.length, 'conversations with details');
      return conversationsWithDetails;
    } catch (error) {
      console.error("Error getting user conversations:", error);
      return [];
    }
  }

  async searchUsers(query: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(users)
        .where(
          or(
            ilike(users.username, `%${query}%`),
            ilike(users.fullName, `%${query}%`)
          )
        )
        .limit(20);
      return result;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }

  // Group operations
  async createGroup(groupData: any): Promise<any> {
    try {
      const result = await db.insert(groups).values(groupData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }

  async getGroup(id: string): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(groups)
        .where(
          and(
            eq(groups.id, id),
            isNull(groups.deletedAt)
          )
        );
      return result[0];
    } catch (error) {
      console.error("Error getting group:", error);
      return undefined;
    }
  }

  async getUserGroups(userId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        privacy: groups.privacy,
        creatorId: groups.creatorId,
        createdAt: groups.createdAt,
        role: groupMembers.role,
      })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            eq(groupMembers.userId, userId),
            isNull(groups.deletedAt)
          )
        );
      
      // Add member count and unread count for each group
      const groupsWithCount = await Promise.all(
        result.map(async (group) => {
          const memberCountResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM group_members WHERE group_id = ${group.id}`
          );
          const memberCount = parseInt((memberCountResult.rows[0] as any).count) || 0;
          
          // Count unread messages in all channels of this group
          // For simplicity, we'll count all messages in group channels that the user hasn't seen
          // A more sophisticated approach would track per-user last read message per channel
          const unreadCountResult = await db.execute(
            sql`SELECT COUNT(DISTINCT m.id) as count
                FROM messages m
                INNER JOIN channels c ON m.channel_id = c.id
                WHERE c.group_id = ${group.id}
                  AND m.sender_id != ${userId}
                  AND m.deleted_at IS NULL
                  AND m.created_at > COALESCE(
                    (SELECT MAX(m2.created_at) 
                     FROM messages m2 
                     INNER JOIN channels c2 ON m2.channel_id = c2.id
                     WHERE c2.group_id = ${group.id} 
                       AND m2.sender_id = ${userId}
                       AND m2.deleted_at IS NULL),
                    ${group.createdAt}
                  )`
          );
          const unreadCount = parseInt((unreadCountResult.rows[0] as any).count) || 0;
          
          return { ...group, memberCount, unreadCount };
        })
      );
      
      return groupsWithCount;
    } catch (error) {
      console.error("Error getting user groups:", error);
      return [];
    }
  }

  async searchGroups(query: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(groups)
        .where(
          and(
            eq(groups.privacy, 'public'),
            isNull(groups.deletedAt),
            or(
              ilike(groups.name, `%${query}%`),
              ilike(groups.description, `%${query}%`)
            )
          )
        )
        .limit(20);
      return result;
    } catch (error) {
      console.error("Error searching groups:", error);
      return [];
    }
  }

  async updateGroup(id: string, groupData: any): Promise<any> {
    try {
      const result = await db.update(groups)
        .set({ ...groupData, updatedAt: new Date() })
        .where(eq(groups.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating group:", error);
      throw error;
    }
  }

  async deleteGroup(id: string): Promise<void> {
    try {
      await db.update(groups)
        .set({ deletedAt: new Date() })
        .where(eq(groups.id, id));
    } catch (error) {
      console.error("Error deleting group:", error);
      throw error;
    }
  }

  // Group membership operations
  async addGroupMember(groupId: string, userId: string, role: string, invitedBy: string | null): Promise<void> {
    try {
      await db.insert(groupMembers).values({
        groupId,
        userId,
        role,
        invitedBy
      });
    } catch (error) {
      console.error("Error adding group member:", error);
      throw error;
    }
  }

  async removeGroupMember(groupId: string, membershipId: string): Promise<void> {
    try {
      await db.delete(groupMembers)
        .where(eq(groupMembers.id, membershipId));
    } catch (error) {
      console.error("Error removing group member:", error);
      throw error;
    }
  }

  async updateGroupMemberRole(groupId: string, userId: string, role: string): Promise<any | null> {
    try {
      // Update the role
      await db.update(groupMembers)
        .set({ role })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      // Fetch and return the updated member with user info
      const result = await db.select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(groupMembers)
        .leftJoin(users, eq(groupMembers.userId, users.id))
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      return result[0] || null;
    } catch (error) {
      console.error("Error updating group member role:", error);
      throw error;
    }
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(groupMembers)
        .leftJoin(users, eq(groupMembers.userId, users.id))
        .where(eq(groupMembers.groupId, groupId));
      return result;
    } catch (error) {
      console.error("Error getting group members:", error);
      return [];
    }
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
      const result = await db.select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      return result.length > 0;
    } catch (error) {
      console.error("Error checking group membership:", error);
      return false;
    }
  }

  async getGroupMemberRole(groupId: string, userId: string): Promise<string | null> {
    try {
      const result = await db.select({ role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      return result[0]?.role || null;
    } catch (error) {
      console.error("Error getting group member role:", error);
      return null;
    }
  }

  // Channel operations
  async createChannel(channelData: any): Promise<any> {
    try {
      const result = await db.insert(channels).values(channelData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  }

  async getChannel(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(channels).where(eq(channels.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting channel:", error);
      return undefined;
    }
  }

  async getGroupChannels(groupId: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(channels)
        .where(
          and(
            eq(channels.groupId, groupId),
            isNull(channels.archivedAt)
          )
        )
        .orderBy(asc(channels.displayOrder));
      return result;
    } catch (error) {
      console.error("Error getting group channels:", error);
      return [];
    }
  }

  async updateChannel(id: string, channelData: any): Promise<any> {
    try {
      const result = await db.update(channels)
        .set(channelData)
        .where(eq(channels.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  }

  async deleteChannel(id: string): Promise<void> {
    try {
      await db.update(channels)
        .set({ archivedAt: new Date() })
        .where(eq(channels.id, id));
    } catch (error) {
      console.error("Error deleting channel:", error);
      throw error;
    }
  }

  async getChannelMessages(channelId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        content: messages.content,
        createdAt: messages.createdAt,
        parentMessageId: messages.parentMessageId,
        senderUsername: users.username,
        senderFullName: users.fullName,
        senderAvatarUrl: users.avatarUrl,
      })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.channelId, channelId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
      return result;
    } catch (error) {
      console.error("Error getting channel messages:", error);
      return [];
    }
  }

  // Group-book associations
  async addBookToGroup(groupId: string, bookId: string): Promise<void> {
    try {
      await db.insert(groupBooks).values({ groupId, bookId });
    } catch (error) {
      console.error("Error adding book to group:", error);
      throw error;
    }
  }

  async removeBookFromGroup(groupId: string, bookId: string): Promise<void> {
    try {
      await db.delete(groupBooks)
        .where(
          and(
            eq(groupBooks.groupId, groupId),
            eq(groupBooks.bookId, bookId)
          )
        );
    } catch (error) {
      console.error("Error removing book from group:", error);
      throw error;
    }
  }

  async getGroupBooks(groupId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: books.id,
        title: books.title,
        author: books.author,
        coverImageUrl: books.coverImageUrl,
      })
        .from(groupBooks)
        .innerJoin(books, eq(groupBooks.bookId, books.id))
        .where(eq(groupBooks.groupId, groupId));
      return result;
    } catch (error) {
      console.error("Error getting group books:", error);
      return [];
    }
  }

  // Alias methods for consistency
  async addGroupBook(groupId: string, bookId: string): Promise<void> {
    return this.addBookToGroup(groupId, bookId);
  }

  async removeAllGroupBooks(groupId: string): Promise<void> {
    try {
      await db.delete(groupBooks)
        .where(eq(groupBooks.groupId, groupId));
    } catch (error) {
      console.error("Error removing all group books:", error);
      throw error;
    }
  }

  // Message reaction operations
  async addMessageReaction(messageId: string, userId: string, emoji: string): Promise<any> {
    try {
      const result = await db.insert(messageReactions).values({
        messageId,
        userId,
        emoji
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding message reaction:", error);
      throw error;
    }
  }

  async removeMessageReaction(reactionId: string, userId: string): Promise<void> {
    try {
      await db.delete(messageReactions)
        .where(
          and(
            eq(messageReactions.id, reactionId),
            eq(messageReactions.userId, userId)
          )
        );
    } catch (error) {
      console.error("Error removing message reaction:", error);
      throw error;
    }
  }

  async getMessageReactions(messageId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: messageReactions.id,
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        createdAt: messageReactions.createdAt,
        username: users.username,
        fullName: users.fullName,
      })
        .from(messageReactions)
        .leftJoin(users, eq(messageReactions.userId, users.id))
        .where(eq(messageReactions.messageId, messageId));
      return result;
    } catch (error) {
      console.error("Error getting message reactions:", error);
      return [];
    }
  }

  // Notification operations
  async createNotification(notificationData: any): Promise<any> {
    try {
      const result = await db.insert(notifications).values(notificationData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number): Promise<any[]> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting user notifications:", error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await db.update(notifications)
        .set({ readStatus: true })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await db.update(notifications)
        .set({ readStatus: true })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.readStatus, false)
          )
        );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }
}
export const storage = new DBStorage();
