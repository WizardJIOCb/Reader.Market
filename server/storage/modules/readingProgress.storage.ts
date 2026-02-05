import { eq } from "drizzle-orm";
import { readingProgress } from "@shared/schema";
import type { DB } from "../db";

export function createReadingProgressStorage(db: DB) {
  return {
    async updateReadingProgress(userId: string, bookId: string, progress: any): Promise<any> {
      try {
        // First, try to update existing record
        const updateResult = await db.update(readingProgress)
          .set({
            currentPage: progress.currentPage,
            totalPages: progress.totalPages,
            percentage: progress.percentage,
            chapterIndex: progress.chapterIndex,
            settings: progress.settings,
            lastReadAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            eq(readingProgress.id, `${userId}-${bookId}`) // Assuming composite ID or finding by userId+bookId
          )
          .returning();

        // If no rows were updated, insert a new record
        if (updateResult.length === 0) {
          const insertResult = await db.insert(readingProgress).values({
            userId,
            bookId,
            currentPage: progress.currentPage,
            totalPages: progress.totalPages,
            percentage: progress.percentage,
            chapterIndex: progress.chapterIndex,
            settings: progress.settings,
          }).returning();
          return insertResult[0];
        }

        return updateResult[0];
      } catch (error) {
        console.error("Error updating reading progress:", error);
        throw error;
      }
    },

    async getReadingProgress(userId: string, bookId: string): Promise<any | undefined> {
      try {
        const result = await db.select().from(readingProgress)
          .where(
            eq(readingProgress.id, `${userId}-${bookId}`) // Adjust as needed for actual schema
          );
        return result[0] || null;
      } catch (error) {
        console.error("Error getting reading progress:", error);
        return undefined;
      }
    },
  };
}

export type ReadingProgressStorage = ReturnType<typeof createReadingProgressStorage>;