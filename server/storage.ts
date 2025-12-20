import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type User, type InsertUser, users, books, shelves, shelfBooks, readingProgress, bookmarks, readingStatistics, userStatistics } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm/sql";

// Database connection
console.log("Connecting to database with URL:", process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local development
});

export const db = drizzle(pool);

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
  
  // Shelf operations
  createShelf(userId: string, shelfData: any): Promise<any>;
  getShelves(userId: string): Promise<any[]>;
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
      const result = await db.select().from(users).where(eq(users.username, username));
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
      const result = await db.select().from(books).where(eq(books.id, id));
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
        // Perform a search based on the query
        result = await db.select().from(books).where(
          sql`title ILIKE ${'%' + query + '%'} OR author ILIKE ${'%' + query + '%'} OR description ILIKE ${'%' + query + '%'} OR genre ILIKE ${'%' + query + '%'}`
        );
      } else {
        // Return all books if no query
        result = await db.select().from(books);
      }
      return result;
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
      const book = await this.getBook(id);
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
      const result = await db.select().from(books).where(inArray(books.id, bookIds));
      return result;
    } catch (error) {
      console.error("Error getting books by IDs:", error);
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
      // First get all shelves for the user
      const userShelves = await db.select().from(shelves).where(eq(shelves.userId, userId));
      
      // For each shelf, get the associated book IDs
      const shelvesWithBooks = await Promise.all(userShelves.map(async (shelf) => {
        // Get all book IDs for this shelf
        const shelfBookRecords = await db.select().from(shelfBooks).where(eq(shelfBooks.shelfId, shelf.id));
        const bookIds = shelfBookRecords.map(record => record.bookId);
        
        return {
          ...shelf,
          bookIds
        };
      }));
      
      return shelvesWithBooks;
    } catch (error) {
      console.error("Error getting shelves:", error);
      return [];
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
}
export const storage = new DBStorage();