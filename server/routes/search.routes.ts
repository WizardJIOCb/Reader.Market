import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { books, users, groups } from '@shared/schema';
import { eq, and, or, asc, desc, sql, ilike } from 'drizzle-orm';

export function createSearchRouter() {
  const router = Router();


  // Search users
  router.get("/users/search", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const users = await storage.searchUsers(q.trim());
      res.json(users);
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Search public groups
  router.get("/groups/search", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const groups = await storage.searchGroups(q.trim());
      res.json(groups);
    } catch (error) {
      console.error("Search groups error:", error);
      res.status(500).json({ error: "Failed to search groups" });
    }
  });

  return router;
}