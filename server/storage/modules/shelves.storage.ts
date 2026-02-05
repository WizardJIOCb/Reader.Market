import { eq, and } from "drizzle-orm";
import { shelves, shelfBooks } from "@shared/schema";
import type { DB } from "../db";

export function createShelvesStorage(db: DB) {
  return {
    async createShelf(userId: string, shelfData: any): Promise<any> {
      try {
        const shelf = {
          userId,
          name: shelfData.name,
          description: shelfData.description,
          color: shelfData.color,
        };
        
        const result = await db.insert(shelves).values(shelf).returning();
        return result[0];
      } catch (error) {
        console.error("Error creating shelf:", error);
        throw error;
      }
    },

    async getShelves(userId: string): Promise<any[]> {
      try {
        const result = await db.select().from(shelves).where(eq(shelves.userId, userId));
        return result;
      } catch (error) {
        console.error("Error getting shelves:", error);
        return [];
      }
    },

    async getShelf(id: string): Promise<any | undefined> {
      try {
        const result = await db.select().from(shelves).where(eq(shelves.id, id));
        return result[0] || null;
      } catch (error) {
        console.error("Error getting shelf:", error);
        return undefined;
      }
    },

    async updateShelf(id: string, shelfData: any): Promise<any> {
      try {
        const result = await db.update(shelves)
          .set({
            name: shelfData.name,
            description: shelfData.description,
            color: shelfData.color,
            updatedAt: new Date(),
          })
          .where(eq(shelves.id, id))
          .returning();
        return result[0];
      } catch (error) {
        console.error("Error updating shelf:", error);
        throw error;
      }
    },

    async deleteShelf(id: string): Promise<void> {
      try {
        await db.delete(shelves).where(eq(shelves.id, id));
      } catch (error) {
        console.error("Error deleting shelf:", error);
        throw error;
      }
    },

    async addBookToShelf(shelfId: string, bookId: string): Promise<void> {
      try {
        // Check if the book is already in the shelf
        const existing = await db.select().from(shelfBooks)
          .where(and(
            eq(shelfBooks.shelfId, shelfId),
            eq(shelfBooks.bookId, bookId)
          ));

        if (existing.length === 0) {
          await db.insert(shelfBooks).values({
            shelfId,
            bookId,
          });
        }
      } catch (error) {
        console.error("Error adding book to shelf:", error);
        throw error;
      }
    },

    async removeBookFromShelf(shelfId: string, bookId: string): Promise<void> {
      try {
        await db.delete(shelfBooks)
          .where(and(
            eq(shelfBooks.shelfId, shelfId),
            eq(shelfBooks.bookId, bookId)
          ));
      } catch (error) {
        console.error("Error removing book from shelf:", error);
        throw error;
      }
    },
  };
}

export type ShelvesStorage = ReturnType<typeof createShelvesStorage>;