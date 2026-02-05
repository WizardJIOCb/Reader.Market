import { eq, ilike } from "drizzle-orm";
import { users } from "@shared/schema";
import type { DB } from "../db";
import type { User, InsertUser } from "@shared/schema";

export function createUsersStorage(db: DB) {
  return {
    async getUser(id: string): Promise<User | undefined> {
      try {
        const result = await db.select().from(users).where(eq(users.id, id));
        return result[0];
      } catch (error) {
        console.error("Error getting user:", error);
        return undefined;
      }
    },

    async getUserByUsername(username: string): Promise<User | undefined> {
      try {
        console.log("getUserByUsername called with username:", username);
        const result = await db.select().from(users).where(eq(users.username, username));
        console.log("Database query completed, result length:", result.length);
        return result[0];
      } catch (error) {
        console.error("Error getting user by username:", error);
        return undefined;
      }
    },

    async getUserByUsernameCaseInsensitive(username: string): Promise<User | undefined> {
      try {
        console.log("getUserByUsernameCaseInsensitive called with username:", username);
        const result = await db.select().from(users).where(ilike(users.username, username));
        console.log("Database query completed, result length:", result.length);
        return result[0];
      } catch (error) {
        console.error("Error getting user by username (case-insensitive):", error);
        return undefined;
      }
    },

    async createUser(userData: InsertUser): Promise<User> {
      try {
        console.log("Creating user with data:", userData);
        const result = await db.insert(users).values(userData).returning();
        return result[0];
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    },

    async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
      try {
        const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
        return result[0];
      } catch (error) {
        console.error("Error updating user:", error);
        throw error;
      }
    },

    async updateUserLastLogin(userId: string): Promise<void> {
      try {
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
      } catch (error) {
        console.error("Error updating user last login:", error);
        throw error;
      }
    },

    async updateUserLastActivity(userId: string): Promise<void> {
      try {
        await db.update(users).set({ lastActivityAt: new Date() }).where(eq(users.id, userId));
      } catch (error) {
        console.error("Error updating user last activity:", error);
        // Don't throw - this is a non-critical background operation
      }
    },
  };
}

export type UsersStorage = ReturnType<typeof createUsersStorage>;