import { Router, type Express } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { 
  activityFeed, 
  users, 
  books, 
  news, 
  comments, 
  reviews,
  shelves
} from '@shared/schema';
import { eq, and, or, desc, asc, sql, ilike } from 'drizzle-orm';

export function createStreamsRouter() {
  const router = Router();

// Global stream - public content
router.get("/global", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const before = req.query.before as string;
    
    const activities = await storage.getGlobalActivities(limit, offset, before);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching global stream:', error);
    res.status(500).json({ error: 'Failed to fetch global stream' });
  }
});

// Personal stream - content from people the user follows
router.get("/personal", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const before = req.query.before as string;
    
    const activities = await storage.getPersonalActivities(userId, limit, offset, before);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching personal stream:', error);
    res.status(500).json({ error: 'Failed to fetch personal stream' });
  }
});

// Shelves stream - activity related to user's shelves
router.get("/shelves", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const shelfIds = req.query.shelfIds ? (req.query.shelfIds as string).split(',') : undefined;
    const bookIds = req.query.bookIds ? (req.query.bookIds as string).split(',') : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const before = req.query.before as string;
    
    const activities = await storage.getShelfActivities(userId, shelfIds, bookIds, limit, offset, before);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching shelves stream:', error);
    res.status(500).json({ error: 'Failed to fetch shelves stream' });
  }
});

// Get shelf filters for stream
router.get("/shelves/filters", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const shelvesWithBooks = await storage.getUserShelvesWithBooks(userId);

    res.json(shelvesWithBooks);
  } catch (error) {
    console.error('Error fetching shelf filters:', error);
    res.status(500).json({ error: 'Failed to fetch shelf filters' });
  }
});

// Get last actions for stream
router.get("/last-actions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Validate limits
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedOffset = Math.max(0, offset);
    
    const activities = await storage.getLastActions(validatedLimit, validatedOffset);
    
    res.json({
      activities,
      pagination: {
        limit: validatedLimit,
        offset: validatedOffset,
        total: activities.length,
        has_more: activities.length === validatedLimit
      }
    });
  } catch (error) {
    console.error('Error fetching last actions:', error);
    res.status(500).json({ error: 'Failed to fetch last actions' });
  }
});

// Admin endpoints for managing activities
router.delete("/activities/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(activityFeed)
      .set({ deletedAt: new Date() })
      .where(eq(activityFeed.id, id));

    res.json({ message: 'Activity hidden successfully' });
  } catch (error) {
    console.error('Error hiding activity:', error);
    res.status(500).json({ error: 'Failed to hide activity' });
  }
});

router.put("/activities/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (action === 'unhide') {
      await db
        .update(activityFeed)
        .set({ deletedAt: null })
        .where(eq(activityFeed.id, id));
      
      res.json({ message: 'Activity restored successfully' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

  return router;
}