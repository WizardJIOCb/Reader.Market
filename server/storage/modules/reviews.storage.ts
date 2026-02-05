import { eq, and } from "drizzle-orm";
import { reviews } from "@shared/schema";
import type { DB } from "../db";

export function createReviewsStorage(db: DB) {
  return {
    async createReview(reviewData: any): Promise<any> {
      try {
        const result = await db.insert(reviews).values(reviewData).returning();
        return result[0];
      } catch (error) {
        console.error("Error creating review:", error);
        throw error;
      }
    },

    async getReviews(bookId: string, currentUserId?: string): Promise<any[]> {
      try {
        const result = await db.select().from(reviews).where(eq(reviews.bookId, bookId));
        return result;
      } catch (error) {
        console.error("Error getting reviews:", error);
        return [];
      }
    },

    async getReviewReplies(reviewId: string, currentUserId?: string): Promise<any[]> {
      try {
        const result = await db.select().from(reviews)
          .where(eq(reviews.parentReviewId, reviewId));
        return result;
      } catch (error) {
        console.error("Error getting review replies:", error);
        return [];
      }
    },

    async countReviewReplies(reviewId: string): Promise<number> {
      try {
        // This would require a count query which isn't implemented here
        return 0;
      } catch (error) {
        console.error("Error counting review replies:", error);
        return 0;
      }
    },

    async getAllReviews(): Promise<any[]> {
      try {
        const result = await db.select().from(reviews);
        return result;
      } catch (error) {
        console.error("Error getting all reviews:", error);
        return [];
      }
    },

    async getUserReview(userId: string, bookId: string): Promise<any | undefined> {
      try {
        const result = await db.select().from(reviews)
          .where(
            and(
              eq(reviews.userId, userId),
              eq(reviews.bookId, bookId)
            )
          );
        return result[0] || null;
      } catch (error) {
        console.error("Error getting user review:", error);
        return undefined;
      }
    },

    async getReviewById(reviewId: string): Promise<any | undefined> {
      try {
        const result = await db.select().from(reviews).where(eq(reviews.id, reviewId));
        return result[0] || null;
      } catch (error) {
        console.error("Error getting review by ID:", error);
        return undefined;
      }
    },

    async updateReview(id: string, reviewData: any): Promise<any> {
      try {
        const result = await db.update(reviews)
          .set(reviewData)
          .where(eq(reviews.id, id))
          .returning();
        return result[0];
      } catch (error) {
        console.error("Error updating review:", error);
        throw error;
      }
    },

    async deleteReview(id: string, userId: string | null): Promise<boolean> {
      try {
        const result = await db.delete(reviews).where(eq(reviews.id, id));
        return (result.rowCount || 0) > 0;
      } catch (error) {
        console.error("Error deleting review:", error);
        return false;
      }
    },
  };
}

export type ReviewsStorage = ReturnType<typeof createReviewsStorage>;