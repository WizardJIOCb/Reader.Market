import { eq, and, desc, isNull, sql, count } from 'drizzle-orm';
import { comments, users, reactions } from '@shared/schema';
import type { DB } from '../db';

export function createCommentsStorage(db: DB) {
  return {
    async createComment(commentData: any): Promise<any> {
      try {
        const result = await db.insert(comments).values(commentData).returning();
        const createdComment = result[0];
        
        // Now fetch the complete comment with user information
        const commentWithUser = await db
          .select({
            id: comments.id,
            userId: comments.userId,
            bookId: comments.bookId,
            newsId: comments.newsId,
            articleId: comments.articleId,
            content: comments.content,
            attachmentUrls: comments.attachmentUrls,
            attachmentMetadata: comments.attachmentMetadata,
            parentCommentId: comments.parentCommentId,
            quotedText: comments.quotedText,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            // User information - using names that match frontend expectations
            username: users.username,
            fullName: users.fullName,
            userAvatar: users.avatarUrl  // Frontend expects userAvatar, not avatarUrl
          })
          .from(comments)
          .leftJoin(users, eq(users.id, comments.userId))
          .where(eq(comments.id, createdComment.id))
          .limit(1);
          
        if (commentWithUser[0]) {
          return {
            ...commentWithUser[0],
            author: commentWithUser[0].fullName || commentWithUser[0].username || 'Anonymous'
          };
        }
        
        return createdComment;
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

    async getArticleComments(articleId: string, currentUserId?: string): Promise<any[]> {
      try {
        // Get only root comments (no parent) with user information - similar to book comments
        const result = await db
        .select({
          id: comments.id,
          userId: comments.userId,
          bookId: comments.bookId,
          newsId: comments.newsId,
          articleId: comments.articleId,
          content: comments.content,
          attachmentUrls: comments.attachmentUrls,
          attachmentMetadata: comments.attachmentMetadata,
          parentCommentId: comments.parentCommentId,
          quotedText: comments.quotedText,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          // User information - using names that match frontend expectations
          username: users.username,
          fullName: users.fullName,
          userAvatar: users.avatarUrl  // Frontend expects userAvatar, not avatarUrl
        })
        .from(comments)
        .leftJoin(users, eq(users.id, comments.userId))
        .where(and(
          eq(comments.articleId, articleId),
          isNull(comments.parentCommentId)  // Only get root comments (no parent)
        ))
        .orderBy(desc(comments.createdAt));  // Get root comments sorted by newest first
        
        // Get reply counts for each root comment
        const commentsWithData = await Promise.all(result.map(async (comment) => {
          // Count replies for this comment recursively (including nested replies)
          const replyCount = await this.countArticleCommentReplies(comment.id);

          const reactions = await this.getCommentReactions(comment.id, currentUserId);
          
          return {
            ...comment,
            author: comment.fullName || comment.username || 'Anonymous',
            isOwnComment: currentUserId ? comment.userId === currentUserId : false,
            replyCount: replyCount,
            reactions,
            attachments: [] // Will be populated by frontend if needed
          };
        }));
        
        return commentsWithData;
      } catch (error) {
        console.error("Error getting article comments:", error);
        return [];
      }
    },

    async countArticleCommentReplies(commentId: string): Promise<number> {
      try {
        // Get direct replies to this comment
        const directReplies = await db.select({
          id: comments.id
        })
        .from(comments)
        .where(eq(comments.parentCommentId, commentId));

        let total = directReplies.length;

        // Recursively count replies to each reply
        for (const reply of directReplies) {
          total += await this.countArticleCommentReplies(reply.id);
        }

        return total;
      } catch (error) {
        console.error("Error counting article comment replies:", error);
        return 0;
      }
    },

    async getArticleCommentReplies(commentId: string, currentUserId?: string): Promise<any[]> {
      try {
        // Get direct replies to this comment
        const replies = await db.select({
          id: comments.id,
          userId: comments.userId,
          bookId: comments.bookId,
          newsId: comments.newsId,
          articleId: comments.articleId,
          content: comments.content,
          attachmentUrls: comments.attachmentUrls,
          attachmentMetadata: comments.attachmentMetadata,
          parentCommentId: comments.parentCommentId,
          quotedText: comments.quotedText,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          // User information - using names that match frontend expectations
          username: users.username,
          fullName: users.fullName,
          userAvatar: users.avatarUrl  // Frontend expects userAvatar, not avatarUrl
        })
        .from(comments)
        .leftJoin(users, eq(users.id, comments.userId))
        .where(eq(comments.parentCommentId, commentId))
        .orderBy(comments.createdAt); // Oldest first for replies
        
        // Process each reply to add additional data and recursively get nested replies
        const repliesWithData = await Promise.all(replies.map(async (reply) => {
          // Get nested replies recursively
          const nestedReplies = await this.getArticleCommentReplies(reply.id, currentUserId);
          
          // Count replies to this reply (for nested structure) - using recursive count
          const replyCount = await this.countArticleCommentReplies(reply.id);

          // Get parent comment author name
          let parentCommentAuthor = null;
          if (reply.parentCommentId) {
            const parentComment = await db.select({
              username: users.username,
              fullName: users.fullName,
            })
            .from(comments)
            .leftJoin(users, eq(users.id, comments.userId))
            .where(eq(comments.id, reply.parentCommentId))
            .limit(1);
            
            if (parentComment[0]) {
              parentCommentAuthor = parentComment[0].fullName || parentComment[0].username;
            }
          }
          
          const reactions = await this.getCommentReactions(reply.id, currentUserId);

          return {
            ...reply,
            author: reply.fullName || reply.username || 'Anonymous',
            isOwnComment: currentUserId ? reply.userId === currentUserId : false,
            parentCommentAuthor: parentCommentAuthor,
            replyCount: replyCount,
            reactions,
            attachments: [], // Will be populated if needed
            replies: nestedReplies // Include nested replies recursively
          };
        }));
        
        return repliesWithData;
      } catch (error) {
        console.error("Error getting article comment replies:", error);
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

    async addCommentReaction(userId: string, commentId: string, emoji: string): Promise<void> {
      try {
        await db.insert(reactions).values({
          userId,
          commentId,
          emoji
        });
      } catch (error) {
        console.error("Error adding comment reaction:", error);
        throw error;
      }
    },

    async removeCommentReaction(userId: string, commentId: string, emoji: string): Promise<void> {
      try {
        await db.delete(reactions)
          .where(and(
            eq(reactions.userId, userId),
            eq(reactions.commentId, commentId),
            eq(reactions.emoji, emoji)
          ));
      } catch (error) {
        console.error("Error removing comment reaction:", error);
        throw error;
      }
    },

    async getCommentReactions(commentId: string, currentUserId?: string): Promise<any[]> {
      try {
        // Get all reactions for this comment grouped by emoji
        const allReactions = await db.select({
          emoji: reactions.emoji,
          userId: reactions.userId,
        })
        .from(reactions)
        .where(eq(reactions.commentId, commentId));
        
        // Group by emoji and count
        const emojiCounts: Record<string, {count: number, userReacted: boolean}> = {};
        
        for (const reaction of allReactions) {
          if (!emojiCounts[reaction.emoji]) {
            emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
          }
          emojiCounts[reaction.emoji].count++;
          if (currentUserId && reaction.userId === currentUserId) {
            emojiCounts[reaction.emoji].userReacted = true;
          }
        }
        
        // Convert to array
        return Object.entries(emojiCounts).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          userReacted: data.userReacted,
        }));
      } catch (error) {
        console.error("Error getting comment reactions:", error);
        return [];
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