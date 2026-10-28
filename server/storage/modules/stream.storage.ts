import { db } from '../db';
import { userActions, books, articles, news, comments, reviews, reactions, users } from '@shared/schema';
import { eq, and, or, desc, asc, sql, count, inArray } from 'drizzle-orm';

export interface StreamServiceInterface {
  // Stream operations
  getGlobalStream(limit?: number, offset?: number): Promise<any[]>;
  getUserStream(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getShelfStream(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getMyActivityStream(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getLastActions(limit?: number): Promise<any[]>;
  getNewsStream(limit?: number, offset?: number): Promise<any[]>;
  getArticleStream(limit?: number, offset?: number): Promise<any[]>;
  getBookStream(limit?: number, offset?: number): Promise<any[]>;
  
  // Activity creation
  createActivity(activityData: any): Promise<any>;
  updateActivity(activityId: string, activityData: any): Promise<any>;
  deleteActivity(activityId: string): Promise<void>;
}

export function createStreamService() {
  return {
    // Stream operations
    async getGlobalStream(limit: number = 50, offset: number = 0) {
      try {
        const globalStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return globalStream;
      } catch (error) {
        console.error('Error getting global stream:', error);
        throw error;
      }
    },

    async getUserStream(userId: string, limit: number = 50, offset: number = 0) {
      try {
        // This would typically get activities related to the user (mentions, interactions, etc.)
        // For now, we'll return activities of the user themselves
        const userStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(eq(userActions.userId, userId))
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return userStream;
      } catch (error) {
        console.error('Error getting user stream:', error);
        throw error;
      }
    },

    async getShelfStream(userId: string, limit: number = 50, offset: number = 0) {
      try {
        // Get activities related to user's shelves
        const shelfStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(and(
            eq(userActions.userId, userId),
            sql`${userActions.actionType} LIKE '%shelf%'` // Activities related to shelves
          ))
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return shelfStream;
      } catch (error) {
        console.error('Error getting shelf stream:', error);
        throw error;
      }
    },

    async getMyActivityStream(userId: string, limit: number = 50, offset: number = 0) {
      try {
        // Get user's personal activity stream
        const myActivityStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(eq(userActions.userId, userId))
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return myActivityStream;
      } catch (error) {
        console.error('Error getting my activity stream:', error);
        throw error;
      }
    },

    async getLastActions(limit: number = 50) {
      try {
        const lastActions = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .orderBy(desc(userActions.createdAt))
          .limit(limit);

        return lastActions;
      } catch (error) {
        console.error('Error getting last actions:', error);
        throw error;
      }
    },

    async getNewsStream(limit: number = 50, offset: number = 0) {
      try {
        // Get activities related to news
        const newsStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(sql`${userActions.actionType} LIKE '%news%'`)
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return newsStream;
      } catch (error) {
        console.error('Error getting news stream:', error);
        throw error;
      }
    },

    async getArticleStream(limit: number = 50, offset: number = 0) {
      try {
        // Get activities related to articles
        const articleStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(sql`${userActions.actionType} LIKE '%article%'`)
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return articleStream;
      } catch (error) {
        console.error('Error getting article stream:', error);
        throw error;
      }
    },

    async getBookStream(limit: number = 50, offset: number = 0) {
      try {
        // Get activities related to books
        const bookStream = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            targetId: userActions.targetId,
            metadata: userActions.metadata,
            userId: userActions.userId,
            createdAt: userActions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(userActions)
          .leftJoin(users, eq(users.id, userActions.userId))
          .where(sql`${userActions.actionType} LIKE '%book%'`)
          .orderBy(desc(userActions.createdAt))
          .limit(limit)
          .offset(offset);

        return bookStream;
      } catch (error) {
        console.error('Error getting book stream:', error);
        throw error;
      }
    },

    // Activity creation
    async createActivity(activityData: any) {
      try {
        // In a real implementation, this would insert into userActions table
        // For now, we'll return the data as a placeholder
        return activityData;
      } catch (error) {
        console.error('Error creating activity:', error);
        throw error;
      }
    },

    async updateActivity(activityId: string, activityData: any) {
      try {
        // In a real implementation, this would update the userActions table
        // For now, we'll return the data as a placeholder
        return activityData;
      } catch (error) {
        console.error('Error updating activity:', error);
        throw error;
      }
    },

    async deleteActivity(activityId: string) {
      try {
        // In a real implementation, this would delete from userActions table
        // For now, just return
        return;
      } catch (error) {
        console.error('Error deleting activity:', error);
        throw error;
      }
    }
  } as StreamServiceInterface;
}