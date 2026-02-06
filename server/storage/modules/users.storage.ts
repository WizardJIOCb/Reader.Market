import { db } from '../db';
import { users, userActions, books, shelves, shelfBooks, readingProgress, bookmarks, comments, reviews, profileRatings, profileComments } from '@shared/schema';
import { eq, and, or, desc, asc, sql, count, ilike, like, inArray } from 'drizzle-orm';

export interface UsersServiceInterface {
  // User operations
  getUser(userId: string): Promise<any | null>;
  getUserByUsername(username: string): Promise<any | null>;
  updateUser(userId: string, userData: any): Promise<any>;
  searchUsers(query: string, limit?: number, offset?: number): Promise<any[]>;
  getUsersCount(): Promise<number>;
  getAllUsers(limit?: number, offset?: number): Promise<any[]>;
  
  // Public users with search, sort, and pagination
  getPublicUsers(page: number, limit: number, search?: string, sortBy?: 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' | 'registered', sortOrder?: 'asc' | 'desc'): Promise<{ users: any[]; total: number }>;
  
  // User relationships
  followUser(followerId: string, followingId: string): Promise<void>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getFollowers(userId: string): Promise<any[]>;
  getFollowing(userId: string): Promise<any[]>;
  
  // User activity
  getUserActivity(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getUserShelves(userId: string): Promise<any[]>;
  getUserReadingProgress(userId: string): Promise<any[]>;
  getUserBookmarks(userId: string): Promise<any[]>;
  getUserComments(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getUserReviews(userId: string, limit?: number, offset?: number): Promise<any[]>;
  
  // Profile
  getUserProfile(userId: string): Promise<any | null>;
  getUserRating(userId: string): Promise<number>;
  getUserRatingStats(userId: string): Promise<any>;
  getUserCommentsCount(userId: string): Promise<number>;
  getUserReviewsCount(userId: string): Promise<number>;
}

export function createUsersStorage() {
  return {
    // User operations
    async getUser(userId: string) {
      try {
        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            password: users.password,
            email: users.email,
            fullName: users.fullName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            accessLevel: users.accessLevel,
            isBlocked: users.isBlocked,
            blockReason: users.blockReason,
            profileRating: users.profileRating,
            profileViewCount: users.profileViewCount,
            language: users.language,
            lastLoginAt: users.lastLoginAt,
            lastActivityAt: users.lastActivityAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
          })
          .from(users)
          .where(eq(users.id, userId));

        return user || null;
      } catch (error) {
        console.error('Error getting user:', error);
        throw error;
      }
    },

    async getUserByUsername(username: string) {
      try {
        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            password: users.password,
            email: users.email,
            fullName: users.fullName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            accessLevel: users.accessLevel,
            isBlocked: users.isBlocked,
            blockReason: users.blockReason,
            profileRating: users.profileRating,
            profileViewCount: users.profileViewCount,
            language: users.language,
            lastLoginAt: users.lastLoginAt,
            lastActivityAt: users.lastActivityAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
          })
          .from(users)
          .where(ilike(users.username, username));

        return user || null;
      } catch (error) {
        console.error('Error getting user by username:', error);
        throw error;
      }
    },

    async updateUser(userId: string, userData: any) {
      try {
        const [updatedUser] = await db
          .update(users)
          .set({
            ...userData,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId))
          .returning();

        return updatedUser;
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },

    async searchUsers(query: string, limit: number = 20, offset: number = 0) {
      try {
        const searchPattern = `%${query}%`;
        
        const usersResult = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            profileRating: users.profileRating,
            profileViewCount: users.profileViewCount,
            lastActivityAt: users.lastActivityAt,
            createdAt: users.createdAt
          })
          .from(users)
          .where(and(
            eq(users.isBlocked, false),
            or(
              ilike(users.username, searchPattern),
              ilike(users.fullName, searchPattern),
              ilike(users.bio, searchPattern)
            )
          ))
          .orderBy(desc(users.profileRating))
          .limit(limit)
          .offset(offset);

        return usersResult;
      } catch (error) {
        console.error('Error searching users:', error);
        throw error;
      }
    },

    async getUsersCount() {
      try {
        const [result] = await db
          .select({ count: count(users.id) })
          .from(users)
          .where(eq(users.isBlocked, false));

        return Number(result.count);
      } catch (error) {
        console.error('Error getting users count:', error);
        throw error;
      }
    },

    async getAllUsers(limit: number = 20, offset: number = 0) {
      try {
        const usersResult = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            accessLevel: users.accessLevel,
            profileRating: users.profileRating,
            profileViewCount: users.profileViewCount,
            lastLoginAt: users.lastLoginAt,
            lastActivityAt: users.lastActivityAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
          })
          .from(users)
          .where(eq(users.isBlocked, false))
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);

        return usersResult;
      } catch (error) {
        console.error('Error getting all users:', error);
        throw error;
      }
    },

    async getPublicUsers(
      page: number = 1,
      limit: number = 15,
      search?: string,
      sortBy: 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' | 'registered' = 'rating',
      sortOrder: 'asc' | 'desc' = 'desc'
    ) {
      try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause for search
        const baseCondition = eq(users.isBlocked, false);
        const whereClause = search 
          ? and(
              baseCondition,
              or(
                ilike(users.username, `%${search}%`),
                ilike(users.fullName, `%${search}%`)
              )
            )
          : baseCondition;
        
        // For registered sorting, we need to use raw SQL to ensure correct ordering
        if (sortBy === 'registered') {
          const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
          const searchCondition = search 
            ? `WHERE (LOWER(u.username) LIKE LOWER('%${search}%') OR LOWER(u.full_name) LIKE LOWER('%${search}%')) AND u.is_blocked = false`
            : 'WHERE u.is_blocked = false';
          
          const rawQuery = `
            SELECT 
              u.id,
              u.username,
              u.full_name as "fullName",
              u.avatar_url as avatar,
              u.profile_rating as "profileRating",
              u.created_at as "registeredAt",
              u.last_activity_at as "lastActivityAt",
              u.bio,
              u.is_blocked as "isBlocked",
              COALESCE(COUNT(DISTINCT s.id), 0)::int as "shelvesCount",
              COALESCE(COUNT(DISTINCT sb.id), 0)::int as "booksCount",
              COALESCE(COUNT(DISTINCT c.id), 0)::int as "commentsCount",
              COALESCE(COUNT(DISTINCT r.id), 0)::int as "reviewsCount"
            FROM users u
            LEFT JOIN shelves s ON s.user_id = u.id
            LEFT JOIN shelf_books sb ON sb.shelf_id = s.id
            LEFT JOIN comments c ON c.user_id = u.id
            LEFT JOIN reviews r ON r.user_id = u.id
            ${searchCondition}
            GROUP BY u.id, u.username, u.full_name, u.avatar_url, u.profile_rating, u.created_at, u.last_activity_at, u.bio, u.is_blocked
            ORDER BY u.created_at ${orderDirection}
            LIMIT ${limit} OFFSET ${offset}
          `;
          
          const finalResult = await db.execute(sql.raw(rawQuery));
          
          // Get total count
          const countQuery = search
            ? `SELECT COUNT(DISTINCT u.id)::int as count FROM users u WHERE (LOWER(u.username) LIKE LOWER('%${search}%') OR LOWER(u.full_name) LIKE LOWER('%${search}%')) AND u.is_blocked = false`
            : `SELECT COUNT(DISTINCT u.id)::int as count FROM users u WHERE u.is_blocked = false`;
          
          const countResult = await db.execute(sql.raw(countQuery));
          const total = Number(countResult.rows[0]?.count || 0);
          
          const formattedUsers = finalResult.rows.map((user: any) => ({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatar: user.avatar,
            profileRating: user.profileRating,
            registeredAt: user.registeredAt,
            lastActivityAt: user.lastActivityAt,
            bio: user.bio,
            isBlocked: user.isBlocked,
            commentsCount: user.commentsCount,
            reviewsCount: user.reviewsCount,
            shelvesCount: user.shelvesCount,
            booksCount: user.booksCount,
          }));
          
          return { users: formattedUsers, total };
        }
        
        // For other sorting options, use the ORM
        let orderByClause;
        
        if (sortBy === 'shelves') {
          orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${shelves.id}) ASC` : sql`COUNT(DISTINCT ${shelves.id}) DESC`;
        } else if (sortBy === 'books') {
          orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${shelfBooks.id}) ASC` : sql`COUNT(DISTINCT ${shelfBooks.id}) DESC`;
        } else if (sortBy === 'comments') {
          orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${comments.id}) ASC` : sql`COUNT(DISTINCT ${comments.id}) DESC`;
        } else if (sortBy === 'reviews') {
          orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${reviews.id}) ASC` : sql`COUNT(DISTINCT ${reviews.id}) DESC`;
        } else if (sortBy === 'lastActivity') {
          orderByClause = sortOrder === 'asc' ? sql`${users.lastActivityAt} ASC NULLS LAST` : sql`${users.lastActivityAt} DESC NULLS LAST`;
        } else {
          // rating
          orderByClause = sortOrder === 'asc' ? sql`${users.profileRating} ASC NULLS LAST` : sql`${users.profileRating} DESC NULLS LAST`;
        }
        
        // Get users with aggregated statistics in a single query
        const finalResult = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatar: users.avatarUrl,
            profileRating: users.profileRating,
            registeredAt: users.createdAt,
            lastActivityAt: users.lastActivityAt,
            bio: users.bio,
            isBlocked: users.isBlocked,
            shelvesCount: sql<number>`COALESCE(COUNT(DISTINCT ${shelves.id}), 0)`.as('shelves_count'),
            booksCount: sql<number>`COALESCE(COUNT(DISTINCT ${shelfBooks.id}), 0)`.as('books_count'),
            commentsCount: sql<number>`COALESCE(COUNT(DISTINCT ${comments.id}), 0)`.as('comments_count'),
            reviewsCount: sql<number>`COALESCE(COUNT(DISTINCT ${reviews.id}), 0)`.as('reviews_count'),
          })
          .from(users)
          .leftJoin(shelves, eq(shelves.userId, users.id))
          .leftJoin(shelfBooks, eq(shelfBooks.shelfId, shelves.id))
          .leftJoin(comments, eq(comments.userId, users.id))
          .leftJoin(reviews, eq(reviews.userId, users.id))
          .where(whereClause)
          .groupBy(
            users.id,
            users.username,
            users.fullName,
            users.avatarUrl,
            users.profileRating,
            users.createdAt,
            users.lastActivityAt,
            users.bio,
            users.isBlocked
          )
          .orderBy(orderByClause)
          .limit(limit)
          .offset(offset);
        
        // Get total count for pagination
        const countResult = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${users.id})`.as('count'),
          })
          .from(users)
          .where(whereClause);
        
        const total = Number(countResult[0]?.count || 0);
        
        // Format the response
        const formattedUsers = finalResult.map(user => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          profileRating: user.profileRating,
          registeredAt: user.registeredAt,
          lastActivityAt: user.lastActivityAt,
          bio: user.bio,
          isBlocked: user.isBlocked,
          commentsCount: Number(user.commentsCount),
          reviewsCount: Number(user.reviewsCount),
          shelvesCount: Number(user.shelvesCount),
          booksCount: Number(user.booksCount),
        }));
        
        return { users: formattedUsers, total };
      } catch (error) {
        console.error('Error getting public users:', error);
        throw error;
      }
    },

    // User relationships
    async followUser(followerId: string, followingId: string) {
      // This would require a followers/following table which may not exist in the current schema
      // Implementation would depend on the existence of such a table
      console.log(`User ${followerId} wants to follow user ${followingId}`);
      // In a real implementation, this would insert into a followers table
    },

    async unfollowUser(followerId: string, followingId: string) {
      // This would require a followers/following table which may not exist in the current schema
      // Implementation would depend on the existence of such a table
      console.log(`User ${followerId} wants to unfollow user ${followingId}`);
      // In a real implementation, this would delete from a followers table
    },

    async getFollowers(userId: string) {
      // This would require a followers/following table which may not exist in the current schema
      // Returning empty array as placeholder
      return [];
    },

    async getFollowing(userId: string) {
      // This would require a followers/following table which may not exist in the current schema
      // Returning empty array as placeholder
      return [];
    },

    // User activity
    async getUserActivity(userId: string, limit: number = 20, offset: number = 0) {
      try {
        const activityResult = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt
          })
          .from(userActions)
          .where(eq(userActions.userId, userId))
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return activityResult;
      } catch (error) {
        console.error('Error getting user activity:', error);
        throw error;
      }
    },

    async getUserShelves(userId: string) {
      try {
        const shelvesResult = await db
          .select({
            id: shelves.id,
            name: shelves.name,
            description: shelves.description,
            color: shelves.color,
            createdAt: shelves.createdAt,
            updatedAt: shelves.updatedAt
          })
          .from(shelves)
          .where(eq(shelves.userId, userId))
          .orderBy(desc(shelves.updatedAt));

        return shelvesResult;
      } catch (error) {
        console.error('Error getting user shelves:', error);
        throw error;
      }
    },

    async getUserReadingProgress(userId: string) {
      try {
        const progressResult = await db
          .select({
            id: readingProgress.id,
            bookId: readingProgress.bookId,
            userId: readingProgress.userId,
            currentPage: readingProgress.currentPage,
            totalPages: readingProgress.totalPages,
            percentage: readingProgress.percentage,
            lastReadAt: readingProgress.lastReadAt,
            createdAt: readingProgress.createdAt,
            updatedAt: readingProgress.updatedAt
          })
          .from(readingProgress)
          .where(eq(readingProgress.userId, userId))
          .orderBy(desc(readingProgress.lastReadAt));

        return progressResult;
      } catch (error) {
        console.error('Error getting user reading progress:', error);
        throw error;
      }
    },

    async getUserBookmarks(userId: string) {
      try {
        const bookmarksResult = await db
          .select({
            id: bookmarks.id,
            bookId: bookmarks.bookId,
            userId: bookmarks.userId,
            chapterIndex: bookmarks.chapterIndex,
            title: bookmarks.title,
            selectedText: bookmarks.selectedText,
            pageInChapter: bookmarks.pageInChapter,
            percentage: bookmarks.percentage,
            clickCount: bookmarks.clickCount,
            createdAt: bookmarks.createdAt
          })
          .from(bookmarks)
          .where(eq(bookmarks.userId, userId))
          .orderBy(desc(bookmarks.createdAt));

        return bookmarksResult;
      } catch (error) {
        console.error('Error getting user bookmarks:', error);
        throw error;
      }
    },

    async getUserComments(userId: string, limit: number = 20, offset: number = 0) {
      try {
        const commentsResult = await db
          .select({
            id: comments.id,
            bookId: comments.bookId,
            userId: comments.userId,
            content: comments.content,
            parentCommentId: comments.parentCommentId,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt
          })
          .from(comments)
          .where(eq(comments.userId, userId))
          .orderBy(desc(comments.createdAt))
          .limit(limit)
          .offset(offset);

        return commentsResult;
      } catch (error) {
        console.error('Error getting user comments:', error);
        throw error;
      }
    },

    async getUserReviews(userId: string, limit: number = 20, offset: number = 0) {
      try {
        const reviewsResult = await db
          .select({
            id: reviews.id,
            bookId: reviews.bookId,
            userId: reviews.userId,
            rating: reviews.rating,
            content: reviews.content,
            createdAt: reviews.createdAt,
            updatedAt: reviews.updatedAt
          })
          .from(reviews)
          .where(eq(reviews.userId, userId))
          .orderBy(desc(reviews.createdAt))
          .limit(limit)
          .offset(offset);

        return reviewsResult;
      } catch (error) {
        console.error('Error getting user reviews:', error);
        throw error;
      }
    },

    // Profile
    async getUserProfile(userId: string) {
      try {
        const user = await this.getUser(userId);
        if (!user) return null;

        // Get additional profile information
        const [ratingStats] = await db
          .select({
            avgRating: sql<number>`AVG(${profileRatings.rating})`.mapWith(Number),
            ratingCount: count(profileRatings.id).mapWith(Number)
          })
          .from(profileRatings)
          .where(eq(profileRatings.profileId, userId));

        const [commentsCount] = await db
          .select({ count: count(profileComments.id) })
          .from(profileComments)
          .where(eq(profileComments.profileId, userId));

        const [userCommentsCount] = await db
          .select({ count: count(comments.id) })
          .from(comments)
          .where(eq(comments.userId, userId));

        const [userReviewsCount] = await db
          .select({ count: count(reviews.id) })
          .from(reviews)
          .where(eq(reviews.userId, userId));

        return {
          ...user,
          profile: {
            rating: {
              average: ratingStats.avgRating ? parseFloat(ratingStats.avgRating.toFixed(2)) : 0,
              count: Number(ratingStats.ratingCount)
            },
            stats: {
              profileComments: Number(commentsCount.count),
              userComments: Number(userCommentsCount.count),
              userReviews: Number(userReviewsCount.count)
            }
          }
        };
      } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
      }
    },

    async getUserRating(userId: string) {
      try {
        const [ratingStats] = await db
          .select({
            avgRating: sql<number>`AVG(${profileRatings.rating})`.mapWith(Number)
          })
          .from(profileRatings)
          .where(eq(profileRatings.profileId, userId));

        return ratingStats.avgRating ? parseFloat(ratingStats.avgRating.toFixed(2)) : 0;
      } catch (error) {
        console.error('Error getting user rating:', error);
        throw error;
      }
    },

    async getUserRatingStats(userId: string) {
      try {
        const [ratingStats] = await db
          .select({
            avgRating: sql<number>`AVG(${profileRatings.rating})`.mapWith(Number),
            ratingCount: count(profileRatings.id).mapWith(Number)
          })
          .from(profileRatings)
          .where(eq(profileRatings.profileId, userId));

        return {
          average: ratingStats.avgRating ? parseFloat(ratingStats.avgRating.toFixed(2)) : 0,
          count: Number(ratingStats.ratingCount)
        };
      } catch (error) {
        console.error('Error getting user rating stats:', error);
        throw error;
      }
    },

    async getUserCommentsCount(userId: string) {
      try {
        const [result] = await db
          .select({ count: count(comments.id) })
          .from(comments)
          .where(eq(comments.userId, userId));

        return Number(result.count);
      } catch (error) {
        console.error('Error getting user comments count:', error);
        throw error;
      }
    },

    async getUserReviewsCount(userId: string) {
      try {
        const [result] = await db
          .select({ count: count(reviews.id) })
          .from(reviews)
          .where(eq(reviews.userId, userId));

        return Number(result.count);
      } catch (error) {
        console.error('Error getting user reviews count:', error);
        throw error;
      }
    }
  } as UsersServiceInterface;
}