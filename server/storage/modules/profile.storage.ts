import { db } from '../db';
import { profileRatings, profileComments, users } from '@shared/schema';
import { eq, and, desc, asc, count, sql, isNull, inArray } from 'drizzle-orm';
import { optionalAuthenticateToken } from '../../middleware/auth';

export interface ProfileServiceInterface {
  // Profile Ratings
  createProfileRating(data: { profileId: string; userId: string; rating: number; comment?: string }): Promise<any>;
  getProfileRatings(profileId: string, limit?: number, offset?: number): Promise<any[]>;
  deleteProfileRating(ratingId: string, userId?: string): Promise<boolean>;
  getProfileRatingStats(profileId: string): Promise<{ average: number; count: number; userRating?: number }>;

  // Profile Comments
  createProfileComment(data: { profileId: string; userId: string; content: string; parentCommentId?: string }): Promise<any>;
  getProfileComments(profileId: string, currentUserId?: string, limit?: number, offset?: number): Promise<any[]>;
  updateProfileComment(commentId: string, content: string, userId: string): Promise<any>;
  deleteProfileComment(commentId: string, userId?: string): Promise<boolean>;
  getProfileCommentReactions(commentId: string, currentUserId?: string): Promise<any[]>;
  addProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<void>;
  removeProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<void>;
}

export function createProfileService() {
  return {
    // Profile Ratings
    async createProfileRating(data: { profileId: string; userId: string; rating: number; comment?: string }) {
      try {
        const [rating] = await db.insert(profileRatings)
          .values({
            profileId: data.profileId,
            userId: data.userId,
            rating: data.rating,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        // Update user's rating stats
        await updateProfileRatingStats(data.profileId);

        return rating;
      } catch (error) {
        console.error('Error creating profile rating:', error);
        throw error;
      }
    },

    async getProfileRatings(profileId: string, limit: number = 20, offset: number = 0) {
      try {
        const ratings = await db
          .select({
            id: profileRatings.id,
            profileId: profileRatings.profileId,
            userId: profileRatings.userId,
            rating: profileRatings.rating,
            createdAt: profileRatings.createdAt,
            updatedAt: profileRatings.updatedAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(profileRatings)
          .leftJoin(users, eq(users.id, profileRatings.userId))
          .where(eq(profileRatings.profileId, profileId))
          .orderBy(desc(profileRatings.createdAt))
          .limit(limit)
          .offset(offset);

        return ratings;
      } catch (error) {
        console.error('Error getting profile ratings:', error);
        throw error;
      }
    },

    async deleteProfileRating(ratingId: string, userId?: string) {
      try {
        // Check if rating exists and belongs to user (if userId provided)
        const [existingRating] = await db
          .select()
          .from(profileRatings)
          .where(eq(profileRatings.id, ratingId));

        if (!existingRating) {
          return false;
        }

        // If userId provided, check ownership
        if (userId && existingRating.userId !== userId) {
          // Check if user is admin/moderator
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

          if (!user || (user.accessLevel !== 'admin' && user.accessLevel !== 'moder')) {
            throw new Error('Unauthorized');
          }
        }

        await db
          .delete(profileRatings)
          .where(eq(profileRatings.id, ratingId));

        // Update user's rating stats
        await updateProfileRatingStats(existingRating.profileId);

        return true;
      } catch (error) {
        console.error('Error deleting profile rating:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
          throw error;
        }
        return false;
      }
    },

    async getProfileRatingStats(profileId: string) {
      try {
        const [stats] = await db
          .select({
            average: sql<number>`AVG(${profileRatings.rating})`.mapWith(Number),
            count: count(profileRatings.id).mapWith(Number)
          })
          .from(profileRatings)
          .where(eq(profileRatings.profileId, profileId));

        const result = {
          average: stats.average ? parseFloat(stats.average.toFixed(2)) : 0,
          count: stats.count || 0,
          userRating: undefined as number | undefined
        };

        return result;
      } catch (error) {
        console.error('Error getting profile rating stats:', error);
        throw error;
      }
    },

    // Profile Comments
    async createProfileComment(data: { profileId: string; userId: string; content: string; parentCommentId?: string }) {
      try {
        const [comment] = await db.insert(profileComments)
          .values({
            profileId: data.profileId,
            userId: data.userId,
            content: data.content,
            parentCommentId: data.parentCommentId,
            attachmentUrls: [],
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return comment;
      } catch (error) {
        console.error('Error creating profile comment:', error);
        throw error;
      }
    },

    async getProfileComments(profileId: string, currentUserId?: string, limit: number = 20, offset: number = 0) {
      try {
        // First get top-level comments
        const comments = await db
          .select({
            id: profileComments.id,
            profileId: profileComments.profileId,
            userId: profileComments.userId,
            content: profileComments.content,
            attachmentUrls: profileComments.attachmentUrls,
            attachmentMetadata: profileComments.attachmentMetadata,
            parentCommentId: profileComments.parentCommentId,
            quotedText: profileComments.quotedText,
            createdAt: profileComments.createdAt,
            updatedAt: profileComments.updatedAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(profileComments)
          .leftJoin(users, eq(users.id, profileComments.userId))
          .where(and(
            eq(profileComments.profileId, profileId),
            isNull(profileComments.parentCommentId) // Only top-level comments
          ))
          .orderBy(desc(profileComments.createdAt))
          .limit(limit)
          .offset(offset);

        // Get replies for each comment
        for (const comment of comments) {
          const replies = await db
            .select({
              id: profileComments.id,
              profileId: profileComments.profileId,
              userId: profileComments.userId,
              content: profileComments.content,
              parentCommentId: profileComments.parentCommentId,
              createdAt: profileComments.createdAt,
              updatedAt: profileComments.updatedAt,
              user: {
                id: users.id,
                username: users.username,
                fullName: users.fullName,
                avatarUrl: users.avatarUrl
              }
            })
            .from(profileComments)
            .leftJoin(users, eq(users.id, profileComments.userId))
            .where(eq(profileComments.parentCommentId, comment.id))
            .orderBy(asc(profileComments.createdAt));

          (comment as any).replies = replies;
        }

        return comments;
      } catch (error) {
        console.error('Error getting profile comments:', error);
        throw error;
      }
    },

    async updateProfileComment(commentId: string, content: string, userId: string) {
      try {
        const [existingComment] = await db
          .select()
          .from(profileComments)
          .where(eq(profileComments.id, commentId));

        if (!existingComment || existingComment.userId !== userId) {
          throw new Error('Unauthorized');
        }

        const [updatedComment] = await db
          .update(profileComments)
          .set({
            content,
            updatedAt: new Date()
          })
          .where(eq(profileComments.id, commentId))
          .returning();

        return updatedComment;
      } catch (error) {
        console.error('Error updating profile comment:', error);
        throw error;
      }
    },

    async deleteProfileComment(commentId: string, userId?: string) {
      try {
        const [existingComment] = await db
          .select()
          .from(profileComments)
          .where(eq(profileComments.id, commentId));

        if (!existingComment) {
          return false;
        }

        // Check ownership or admin access
        if (userId && existingComment.userId !== userId) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

          if (!user || (user.accessLevel !== 'admin' && user.accessLevel !== 'moder')) {
            throw new Error('Unauthorized');
          }
        }

        // Delete replies first
        await db
          .delete(profileComments)
          .where(eq(profileComments.parentCommentId, commentId));

        // Delete the comment
        await db
          .delete(profileComments)
          .where(eq(profileComments.id, commentId));

        return true;
      } catch (error) {
        console.error('Error deleting profile comment:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
          throw error;
        }
        return false;
      }
    },

    async getProfileCommentReactions(commentId: string, currentUserId?: string) {
      // This would implement reactions for profile comments
      // For now, returning empty array - would need reactions table specific to profile comments
      return [];
    },

    async addProfileCommentReaction(userId: string, commentId: string, emoji: string) {
      // This would implement adding reactions to profile comments
    },

    async removeProfileCommentReaction(userId: string, commentId: string, emoji: string) {
      // This would implement removing reactions from profile comments
    }
  } as ProfileServiceInterface;
}

// Helper function to update profile rating stats
async function updateProfileRatingStats(profileId: string) {
  // This would update cached stats for the profile
  // Implementation would depend on specific requirements
}