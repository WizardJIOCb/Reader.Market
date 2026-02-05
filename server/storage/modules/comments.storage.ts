import { eq, and } from "drizzle-orm";
import { comments } from "@shared/schema";
import type { DB } from "../db";

export function createCommentsStorage(db: DB) {
  return {
    async createComment(commentData: any): Promise<any> {
      try {
        const result = await db.insert(comments).values(commentData).returning();
        return result[0];
      } catch (error) {
        console.error("Error creating comment:", error);
        throw error;
      }
    },

    async getCommentById(id: string): Promise<any | undefined> {
      try {
        const result = await db.select().from(comments).where(eq(comments.id, id));
        return result[0] || null;
      } catch (error) {
        console.error("Error getting comment by ID:", error);
        return undefined;
      }
    },

    async getComments(bookId: string, currentUserId?: string): Promise<any[]> {
      try {
        const result = await db.select().from(comments).where(eq(comments.bookId, bookId));
        return result;
      } catch (error) {
        console.error("Error getting comments:", error);
        return [];
      }
    },

    async getBookCommentReplies(commentId: string, currentUserId?: string): Promise<any[]> {
      try {
        const result = await db.select().from(comments)
          .where(eq(comments.parentCommentId, commentId));
        return result;
      } catch (error) {
        console.error("Error getting comment replies:", error);
        return [];
      }
    },

    async countBookCommentReplies(commentId: string): Promise<number> {
      try {
        // This would require a count query which isn't implemented here
        return 0;
      } catch (error) {
        console.error("Error counting comment replies:", error);
        return 0;
      }
    },

    async getAllComments(): Promise<any[]> {
      try {
        const result = await db.select().from(comments);
        return result;
      } catch (error) {
        console.error("Error getting all comments:", error);
        return [];
      }
    },

    async updateComment(id: string, commentData: any): Promise<any> {
      try {
        const result = await db.update(comments)
          .set(commentData)
          .where(eq(comments.id, id))
          .returning();
        return result[0];
      } catch (error) {
        console.error("Error updating comment:", error);
        throw error;
      }
    },

    async deleteComment(id: string, userId: string | null): Promise<boolean> {
      try {
        const result = await db.delete(comments).where(eq(comments.id, id));
        return (result.rowCount || 0) > 0;
      } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
      }
    },
  };
}

export type CommentsStorage = ReturnType<typeof createCommentsStorage>;