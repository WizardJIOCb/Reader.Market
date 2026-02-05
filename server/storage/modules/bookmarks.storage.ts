import { eq } from "drizzle-orm";
import { bookmarks } from "@shared/schema";
import type { DB } from "../db";

export function createBookmarksStorage(db: DB) {
  return {
    async createBookmark(bookmarkData: any): Promise<any> {
      try {
        const result = await db.insert(bookmarks).values(bookmarkData).returning();
        return result[0];
      } catch (error) {
        console.error("Error creating bookmark:", error);
        throw error;
      }
    },

    async getBookmarks(userId: string, bookId: string): Promise<any[]> {
      try {
        const result = await db.select().from(bookmarks)
          .where(
            eq(bookmarks.userId, userId)
          );
        return result;
      } catch (error) {
        console.error("Error getting bookmarks:", error);
        return [];
      }
    },

    async updateBookmark(id: string, title: string): Promise<any> {
      try {
        const result = await db.update(bookmarks)
          .set({ 
            title
          })
          .where(eq(bookmarks.id, id))
          .returning();
        return result[0];
      } catch (error) {
        console.error("Error updating bookmark:", error);
        throw error;
      }
    },

    async deleteBookmark(id: string): Promise<void> {
      try {
        await db.delete(bookmarks).where(eq(bookmarks.id, id));
      } catch (error) {
        console.error("Error deleting bookmark:", error);
        throw error;
      }
    },
  };
}

export type BookmarksStorage = ReturnType<typeof createBookmarksStorage>;