import { db } from '../db';
import { bookmarkCollections, collectionBooks, books, users } from '@shared/schema';
import { eq, and, or, desc, asc, sql, count, inArray } from 'drizzle-orm';

export interface CollectionsServiceInterface {
  // Collection operations
  getUserCollections(userId: string, limit: number, offset: number): Promise<any[]>;
  getUserCollectionsCount(userId: string): Promise<number>;
  getCollectionById(id: string, currentUserId?: string): Promise<any | null>;
  createCollection(collectionData: any): Promise<any>;
  updateCollection(id: string, collectionData: any): Promise<any>;
  deleteCollection(id: string): Promise<void>;
  addBookToCollection(collectionId: string, bookId: string): Promise<void>;
  removeBookFromCollection(collectionId: string, bookId: string): Promise<void>;
  getBooksInCollection(collectionId: string, currentUserId: string | undefined, limit: number, offset: number): Promise<any[]>;
  getBooksInCollectionCount(collectionId: string): Promise<number>;
}

export function createCollectionsService() {
  return {
    // Collection operations
    async getUserCollections(userId: string, limit: number, offset: number) {
      try {
        const userCollections = await db
          .select({
            id: bookmarkCollections.id,
            userId: bookmarkCollections.userId,
            name: bookmarkCollections.name,
            description: bookmarkCollections.description,
            color: bookmarkCollections.color,
            isPublic: bookmarkCollections.isPublic,
            coverImageUrl: bookmarkCollections.coverImageUrl,
            bookId: bookmarkCollections.bookId,
            viewCount: bookmarkCollections.viewCount,
            createdAt: bookmarkCollections.createdAt,
            updatedAt: bookmarkCollections.updatedAt,
            bookCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${collectionBooks} WHERE ${collectionBooks.collectionId} = ${bookmarkCollections.id}), 0)`.mapWith(Number)
          })
          .from(bookmarkCollections)
          .where(eq(bookmarkCollections.userId, userId))
          .orderBy(desc(bookmarkCollections.updatedAt))
          .limit(limit)
          .offset(offset);

        return userCollections;
      } catch (error) {
        console.error('Error getting user collections:', error);
        throw error;
      }
    },

    async getUserCollectionsCount(userId: string) {
      try {
        const [result] = await db
          .select({ count: count(bookmarkCollections.id) })
          .from(bookmarkCollections)
          .where(eq(bookmarkCollections.userId, userId));

        return Number(result.count);
      } catch (error) {
        console.error('Error getting user collections count:', error);
        throw error;
      }
    },

    async getCollectionById(id: string, currentUserId?: string) {
      try {
        const [collection] = await db
          .select({
            id: bookmarkCollections.id,
            userId: bookmarkCollections.userId,
            name: bookmarkCollections.name,
            description: bookmarkCollections.description,
            color: bookmarkCollections.color,
            isPublic: bookmarkCollections.isPublic,
            coverImageUrl: bookmarkCollections.coverImageUrl,
            bookId: bookmarkCollections.bookId,
            viewCount: bookmarkCollections.viewCount,
            createdAt: bookmarkCollections.createdAt,
            updatedAt: bookmarkCollections.updatedAt
          })
          .from(bookmarkCollections)
          .where(eq(bookmarkCollections.id, id));

        // Check if user has access to the collection
        if (collection) {
          if (collection.userId !== currentUserId && !collection.isPublic) {
            return null; // User doesn't have access to private collection
          }
        }

        return collection || null;
      } catch (error) {
        console.error('Error getting collection by ID:', error);
        throw error;
      }
    },

    async createCollection(collectionData: any) {
      try {
        const [collection] = await db.insert(bookmarkCollections)
          .values({
            userId: collectionData.userId,
            name: collectionData.name,
            description: collectionData.description,
            color: collectionData.color,
            isPublic: collectionData.isPublic ?? false,
            coverImageUrl: collectionData.coverImageUrl,
            bookId: collectionData.bookId,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return collection;
      } catch (error) {
        console.error('Error creating collection:', error);
        throw error;
      }
    },

    async updateCollection(id: string, collectionData: any) {
      try {
        const [updatedCollection] = await db
          .update(bookmarkCollections)
          .set({
            ...collectionData,
            updatedAt: new Date()
          })
          .where(eq(bookmarkCollections.id, id))
          .returning();

        return updatedCollection;
      } catch (error) {
        console.error('Error updating collection:', error);
        throw error;
      }
    },

    async deleteCollection(id: string) {
      try {
        // First delete all book associations in this collection
        await db
          .delete(collectionBooks)
          .where(eq(collectionBooks.collectionId, id));

        // Then delete the collection itself
        await db
          .delete(bookmarkCollections)
          .where(eq(bookmarkCollections.id, id));
      } catch (error) {
        console.error('Error deleting collection:', error);
        throw error;
      }
    },

    async addBookToCollection(collectionId: string, bookId: string) {
      try {
        // Check if the association already exists
        const [existingAssociation] = await db
          .select()
          .from(collectionBooks)
          .where(and(
            eq(collectionBooks.collectionId, collectionId),
            eq(collectionBooks.bookId, bookId)
          ));

        if (existingAssociation) {
          // Association already exists, no need to add again
          return;
        }

        await db.insert(collectionBooks)
          .values({
            collectionId,
            bookId,
            addedAt: new Date()
          });
      } catch (error) {
        console.error('Error adding book to collection:', error);
        throw error;
      }
    },

    async removeBookFromCollection(collectionId: string, bookId: string) {
      try {
        await db
          .delete(collectionBooks)
          .where(and(
            eq(collectionBooks.collectionId, collectionId),
            eq(collectionBooks.bookId, bookId)
          ));
      } catch (error) {
        console.error('Error removing book from collection:', error);
        throw error;
      }
    },

    async getBooksInCollection(collectionId: string, currentUserId: string | undefined, limit: number, offset: number) {
      try {
        // First, verify that the user has access to this collection
        const [collection] = await db
          .select({
            userId: bookmarkCollections.userId,
            isPublic: bookmarkCollections.isPublic
          })
          .from(bookmarkCollections)
          .where(eq(bookmarkCollections.id, collectionId));

        if (!collection) {
          return []; // Collection doesn't exist
        }

        // Check if user has access to the collection
        if (collection.userId !== currentUserId && !collection.isPublic) {
          return []; // User doesn't have access to private collection
        }

        const booksInCollection = await db
          .select({
            id: books.id,
            title: books.title,
            author: books.author,
            description: books.description,
            coverImageUrl: books.coverImageUrl,
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
            updatedAt: books.updatedAt,
            collectionBookAddedAt: collectionBooks.addedAt
          })
          .from(collectionBooks)
          .leftJoin(books, eq(books.id, collectionBooks.bookId))
          .where(eq(collectionBooks.collectionId, collectionId))
          .orderBy(desc(collectionBooks.addedAt))
          .limit(limit)
          .offset(offset);

        return booksInCollection;
      } catch (error) {
        console.error('Error getting books in collection:', error);
        throw error;
      }
    },

    async getBooksInCollectionCount(collectionId: string) {
      try {
        const [result] = await db
          .select({ count: count(collectionBooks.id) })
          .from(collectionBooks)
          .where(eq(collectionBooks.collectionId, collectionId));

        return Number(result.count);
      } catch (error) {
        console.error('Error getting books in collection count:', error);
        throw error;
      }
    }
  } as CollectionsServiceInterface;
}