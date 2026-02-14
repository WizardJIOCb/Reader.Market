import { db } from '../db';
import { shelves, shelfBooks, books, users } from '@shared/schema';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';

export interface ShelvesServiceInterface {
  // Shelves
  getUserShelves(userId: string): Promise<any[]>;
  getShelfById(shelfId: string, userId: string): Promise<any | null>;
  createShelf(data: { userId: string; name: string; description?: string; isPrivate?: boolean }): Promise<any>;
  updateShelf(shelfId: string, userId: string, data: { name?: string; description?: string; isPrivate?: boolean }): Promise<any>;
  deleteShelf(shelfId: string, userId: string): Promise<boolean>;
  getPublicShelves(limit?: number, offset?: number): Promise<any[]>;

  // Shelf Books
  addBookToShelf(shelfId: string, bookId: string, userId: string): Promise<any>;
  removeBookFromShelf(shelfId: string, bookId: string, userId: string): Promise<boolean>;
  getUserShelfBooks(userId: string, shelfId?: string): Promise<any[]>;
  getShelfBooks(shelfId: string): Promise<any[]>;
  getBookShelves(bookId: string, userId: string): Promise<any[]>;
}

export function createShelvesService() {
  return {
    // Shelves
    async getUserShelves(userId: string) {
      try {
        const userShelves = await db
          .select({
            id: shelves.id,
            name: shelves.name,
            description: shelves.description,
            color: shelves.color,
            userId: shelves.userId,
            createdAt: shelves.createdAt,
            updatedAt: shelves.updatedAt,
            bookCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${shelfBooks} WHERE ${shelfBooks.shelfId} = ${shelves.id}), 0)`.mapWith(Number)
          })
          .from(shelves)
          .where(eq(shelves.userId, userId))
          .orderBy(desc(shelves.updatedAt));

        return userShelves;
      } catch (error) {
        console.error('Error getting user shelves:', error);
        throw error;
      }
    },

    async getShelfById(shelfId: string, userId: string) {
      try {
        const [shelf] = await db
          .select({
            id: shelves.id,
            name: shelves.name,
            description: shelves.description,
            color: shelves.color,
            userId: shelves.userId,
            createdAt: shelves.createdAt,
            updatedAt: shelves.updatedAt
          })
          .from(shelves)
          .where(and(
            eq(shelves.id, shelfId),
            eq(shelves.userId, userId)
          ));

        return shelf || null;
      } catch (error) {
        console.error('Error getting shelf by ID:', error);
        throw error;
      }
    },

    async createShelf(data: { userId: string; name: string; description?: string; isPrivate?: boolean }) {
      try {
        const [shelf] = await db.insert(shelves)
          .values({
            userId: data.userId,
            name: data.name,
            description: data.description,
            color: data.isPrivate ? '#private_color' : undefined, // Using color field as alternative
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return shelf;
      } catch (error) {
        console.error('Error creating shelf:', error);
        throw error;
      }
    },

    async updateShelf(shelfId: string, userId: string, data: { name?: string; description?: string; isPrivate?: boolean }) {
      try {
        const [existingShelf] = await db
          .select()
          .from(shelves)
          .where(and(
            eq(shelves.id, shelfId),
            eq(shelves.userId, userId)
          ));

        if (!existingShelf) {
          throw new Error('Shelf not found or access denied');
        }

        const [updatedShelf] = await db
          .update(shelves)
          .set({
            ...data,
            updatedAt: new Date()
          })
          .where(eq(shelves.id, shelfId))
          .returning();

        return updatedShelf;
      } catch (error) {
        console.error('Error updating shelf:', error);
        throw error;
      }
    },

    async deleteShelf(shelfId: string, userId: string) {
      try {
        const [existingShelf] = await db
          .select()
          .from(shelves)
          .where(and(
            eq(shelves.id, shelfId),
            eq(shelves.userId, userId)
          ));

        if (!existingShelf) {
          return false;
        }

        // Delete all shelf-books associations first
        await db
          .delete(shelfBooks)
          .where(eq(shelfBooks.shelfId, shelfId));

        // Then delete the shelf
        await db
          .delete(shelves)
          .where(eq(shelves.id, shelfId));

        return true;
      } catch (error) {
        console.error('Error deleting shelf:', error);
        return false;
      }
    },

    async getPublicShelves(limit: number = 20, offset: number = 0) {
      try {
        const publicShelves = await db
          .select({
            id: shelves.id,
            name: shelves.name,
            description: shelves.description,
            color: shelves.color,
            userId: shelves.userId,
            createdAt: shelves.createdAt,
            updatedAt: shelves.updatedAt,
            bookCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${shelfBooks} WHERE ${shelfBooks.shelfId} = ${shelves.id}), 0)`.mapWith(Number),
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(shelves)
          .leftJoin(users, eq(users.id, shelves.userId))
          .where(sql`${shelves.color} IS NULL OR ${shelves.color} != '#private_color'`) // Consider shelves without private color as public
          .orderBy(desc(shelves.updatedAt))
          .limit(limit)
          .offset(offset);

        return publicShelves;
      } catch (error) {
        console.error('Error getting public shelves:', error);
        throw error;
      }
    },

    // Shelf Books
    async addBookToShelf(shelfId: string, bookId: string, userId: string) {
      try {
        // Verify shelf belongs to user
        const [shelf] = await db
          .select()
          .from(shelves)
          .where(and(
            eq(shelves.id, shelfId),
            eq(shelves.userId, userId)
          ));

        if (!shelf) {
          throw new Error('Shelf not found or access denied');
        }

        // Check if book already exists on this shelf
        const [existingShelfBook] = await db
          .select()
          .from(shelfBooks)
          .where(and(
            eq(shelfBooks.shelfId, shelfId),
            eq(shelfBooks.bookId, bookId)
          ));

        if (existingShelfBook) {
          // Book already exists on this shelf, return existing
          return existingShelfBook;
        }

        const [shelfBook] = await db.insert(shelfBooks)
          .values({
            shelfId,
            bookId,
            addedAt: new Date()
          })
          .returning();

        return shelfBook;
      } catch (error) {
        console.error('Error adding book to shelf:', error);
        throw error;
      }
    },

    async removeBookFromShelf(shelfId: string, bookId: string, userId: string) {
      try {
        // Verify shelf belongs to user
        const [shelf] = await db
          .select()
          .from(shelves)
          .where(and(
            eq(shelves.id, shelfId),
            eq(shelves.userId, userId)
          ));

        if (!shelf) {
          return false;
        }

        const result = await db
          .delete(shelfBooks)
          .where(and(
            eq(shelfBooks.shelfId, shelfId),
            eq(shelfBooks.bookId, bookId)
          ));

        return true; // Assuming successful deletion
      } catch (error) {
        console.error('Error removing book from shelf:', error);
        return false;
      }
    },

    async getUserShelfBooks(userId: string, shelfId?: string) {
      try {
        let whereCondition;
        if (shelfId) {
          // Verify shelf belongs to user
          const [shelf] = await db
            .select()
            .from(shelves)
            .where(and(
              eq(shelves.id, shelfId),
              eq(shelves.userId, userId)
            ));

          if (!shelf) {
            throw new Error('Shelf not found or access denied');
          }
          
          whereCondition = eq(shelfBooks.shelfId, shelfId);
        } else {
          whereCondition = inArray(
            shelfBooks.shelfId,
            db
              .select({ id: shelves.id })
              .from(shelves)
              .where(eq(shelves.userId, userId))
          );
        }

        const shelfBooksResult = await db
          .select({
            id: shelfBooks.id,
            shelfId: shelfBooks.shelfId,
            bookId: shelfBooks.bookId,
            addedAt: shelfBooks.addedAt,
            book: {
              id: books.id,
              title: books.title,
              author: books.author,
              description: books.description,
              coverImageUrl: books.coverImageUrl,
              videoCoverUrl: books.videoCoverUrl,
              filePath: books.filePath,
              fileSize: books.fileSize,
              fileType: books.fileType,
              language: books.language,
              genre: books.genre,
              publishedYear: books.publishedYear,
              rating: books.rating,
              userId: books.userId,
              uploadedAt: books.uploadedAt,
              publishedAt: books.publishedAt,
              isActive: books.isActive,
              createdAt: books.createdAt,
              updatedAt: books.updatedAt
            },
            shelf: {
              id: shelves.id,
              name: shelves.name
            }
          })
          .from(shelfBooks)
          .leftJoin(books, eq(books.id, shelfBooks.bookId))
          .leftJoin(shelves, eq(shelves.id, shelfBooks.shelfId))
          .where(whereCondition)
          .orderBy(desc(shelfBooks.addedAt));

        return shelfBooksResult;
      } catch (error) {
        console.error('Error getting user shelf books:', error);
        throw error;
      }
    },

    async getShelfBooks(shelfId: string) {
      try {
        const shelfBooksResult = await db
          .select({
            id: shelfBooks.id,
            shelfId: shelfBooks.shelfId,
            bookId: shelfBooks.bookId,
            addedAt: shelfBooks.addedAt,
            book: {
              id: books.id,
              title: books.title,
              author: books.author,
              description: books.description,
              coverImageUrl: books.coverImageUrl,
              videoCoverUrl: books.videoCoverUrl,
              filePath: books.filePath,
              fileSize: books.fileSize,
              fileType: books.fileType,
              language: books.language,
              genre: books.genre,
              publishedYear: books.publishedYear,
              rating: books.rating,
              userId: books.userId,
              uploadedAt: books.uploadedAt,
              publishedAt: books.publishedAt,
              isActive: books.isActive,
              createdAt: books.createdAt,
              updatedAt: books.updatedAt
            }
          })
          .from(shelfBooks)
          .leftJoin(books, eq(books.id, shelfBooks.bookId))
          .where(eq(shelfBooks.shelfId, shelfId))
          .orderBy(desc(shelfBooks.addedAt));

        return shelfBooksResult;
      } catch (error) {
        console.error('Error getting shelf books:', error);
        throw error;
      }
    },

    async getBookShelves(bookId: string, userId: string) {
      try {
        const bookShelves = await db
          .select({
            id: shelfBooks.id,
            shelfId: shelfBooks.shelfId,
            bookId: shelfBooks.bookId,
            addedAt: shelfBooks.addedAt,
            shelf: {
              id: shelves.id,
              name: shelves.name,
              description: shelves.description,
              color: shelves.color,
              userId: shelves.userId,
              createdAt: shelves.createdAt,
              updatedAt: shelves.updatedAt
            }
          })
          .from(shelfBooks)
          .leftJoin(shelves, eq(shelves.id, shelfBooks.shelfId))
          .where(and(
            eq(shelfBooks.bookId, bookId),
            eq(shelves.userId, userId)
          ));

        return bookShelves;
      } catch (error) {
        console.error('Error getting book shelves:', error);
        throw error;
      }
    }
  } as ShelvesServiceInterface;
}