import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { users, bookmarkCollections, bookmarks, bookmarkCollectionItems } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createStatsRouter() {
  const router = Router();

  // Public: Get platform statistics for landing page
  router.get("/platform", async (req, res) => {
    try {
      const [usersCount, booksCount, articlesCount, activitiesCount, newsCount] = await Promise.all([
        storage.getUsersCount(),
        storage.getBooksCount(),
        storage.getArticlesCount(),
        storage.getActivitiesCount(),
        storage.getNewsCount()
      ]);
      
      res.json({
        users: usersCount,
        books: booksCount,
        articles: articlesCount,
        activities: activitiesCount,
        news: newsCount
      });
    } catch (error) {
      console.error("Get platform stats error:", error);
      res.status(500).json({ error: "Failed to get platform statistics" });
    }
  });

  // Get user statistics (open to all users)
  router.get("/api/users/:userId/statistics", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user statistics endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const stats = await storage.getUserStatistics(user.id);
      
      // Return default stats if user doesn't have statistics yet
      res.json(stats || {
        totalBooksRead: 0,
        totalWordsRead: 0,
        totalLettersRead: 0
      });
    } catch (error) {
      console.error("Get user statistics error:", error);
      res.status(500).json({ error: "Failed to get user statistics" });
    }
  });

  // Get book view statistics
  router.get("/api/books/:id/stats", authenticateToken, async (req, res) => {
    console.log("Get book stats endpoint called");
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      const stats = await storage.getBookViewStats(id);
      
      res.json(stats);
    } catch (error) {
      console.error("Error getting book stats:", error);
      res.status(500).json({ error: "Failed to get book stats" });
    }
  });

  // Public: Get article statistics by category
  router.get("/api/articles/stats-by-category", async (req, res) => {
    console.log("Get article stats by category endpoint called");
    try {
      const stats = await storage.getArticleStatsByCategory();
      res.json(stats);
    } catch (error) {
      console.error("Get article stats by category error:", error);
      res.status(500).json({ error: "Failed to get article stats by category" });
    }
  });

  // Get collection statistics
  router.get("/api/bookmark-collections/:id/stats", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify collection exists and user has access
      const collection = await db.select({
        id: bookmarkCollections.id,
        viewCount: bookmarkCollections.viewCount,
        userId: bookmarkCollections.userId,
        isPublic: bookmarkCollections.isPublic
      })
      .from(bookmarkCollections)
      .where(and(
        eq(bookmarkCollections.id, id),
        or(
          eq(bookmarkCollections.userId, userId),
          eq(bookmarkCollections.isPublic, true)
        )
      ));
      
      if (collection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Get bookmark click statistics
      const bookmarkStats = await db.select({
        totalClicks: sql`COALESCE(SUM(${bookmarks.clickCount}), 0)`.mapWith(Number),
        bookmarkCount: sql`COUNT(*)`.mapWith(Number)
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .where(eq(bookmarkCollectionItems.collectionId, id));

      res.json({
        viewCount: collection[0].viewCount || 0,
        totalBookmarkClicks: bookmarkStats[0].totalClicks || 0,
        bookmarkCount: bookmarkStats[0].bookmarkCount || 0
      });
    } catch (error) {
      console.error("Error getting collection stats:", error);
      res.status(500).json({ error: "Failed to get collection statistics" });
    }
  });

  return router;
}