import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { users, comments, reviews, news, userActions } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

// Helper function to get profile activities (since it's not in storage)
async function getProfileActivitiesDirect(profileId: string, limit: number, offset: number) {
  // This would typically be implemented in the storage layer
  // For now, returning an empty array as placeholder
  return [];
}

export function createActivityRouter() {
  const router = Router();

  // Admin: Get recent activity
  router.get("/admin/recent-activity", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get recent activity endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      // Get all activity first, then paginate
      const allActivity = await storage.getRecentActivity(10000); // Get a large number to ensure we get all
      const total = allActivity.length;
      
      // Paginate the activity
      const paginatedActivity = allActivity.slice(offset, offset + limit);
      
      // Get book titles for each activity item
      const activityWithBooks = await Promise.all(paginatedActivity.map(async (item) => {
        const book = await storage.getBook(item.bookId);
        return {
          ...item,
          bookTitle: book ? book.title : 'Unknown Book',
          bookAuthor: book ? book.author : 'Unknown Author'
        };
      }));
      
      res.json({
        items: activityWithBooks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get recent activity error:", error);
      res.status(500).json({ error: "Failed to get recent activity" });
    }
  });

  // Get user activity feed
  router.get("/profile/:profileId/activities", optionalAuthenticateToken, async (req, res) => {
    console.log("Get profile activities endpoint called");
    
    try {
      const { profileId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const activities = await getProfileActivitiesDirect(profileId, limit, offset);
      
      res.json({
        activities,
        pagination: {
          limit,
          offset,
          total: activities.length,
          has_more: activities.length === limit
        }
      });
    } catch (error) {
      console.error("Get profile activities error:", error);
      res.status(500).json({ error: "Failed to get profile activities" });
    }
  });

  return router;
}