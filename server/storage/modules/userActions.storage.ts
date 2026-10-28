import { db } from '../db';
import { userActions, users, books, news, groups } from '@shared/schema';
import { eq, isNull, desc, sql } from 'drizzle-orm';

export interface UserAction {
  id: string;
  userId: string;
  actionType: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: any;
  createdAt: Date;
  deletedAt?: Date | null;
}

export interface LastActionItem {
  id: string;
  type: string;
  action_type: string;
  entityId: string;
  userId: string;
  user: {
    id?: string;
    username?: string;
    avatar_url?: string | null;
  };
  target: any;
  metadata: any;
  createdAt: Date;
  timestamp: string;
}

export class UserActionsStorage {
  async createUserAction(userId: string, actionType: string, targetType?: string | null, targetId?: string | null, metadata?: any): Promise<UserAction | null> {
    try {
      const [result] = await db.insert(userActions).values({
        userId,
        actionType,
        targetType: targetType || null,
        targetId: targetId || null,
        metadata: metadata || {}
      }).returning();
      
      return result;
    } catch (error) {
      console.error("Error creating user action:", error);
      return null;
    }
  }

  async deleteUserAction(id: string): Promise<boolean> {
    try {
      const [result] = await db.update(userActions).set({ deletedAt: new Date() }).where(eq(userActions.id, id)).returning();
      return !!result;
    } catch (error) {
      console.error("Error deleting user action:", error);
      return false;
    }
  }
}

// We'll create the factory function separately in the main index.ts to avoid circular dependencies

export function createUserActionsStorage(db: any) {
  const storage = new UserActionsStorage();
  return {
    createUserAction: storage.createUserAction.bind(storage),
    deleteUserAction: storage.deleteUserAction.bind(storage)
  };
}
