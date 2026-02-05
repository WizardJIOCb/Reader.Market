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
    // Get recent public activities
    const globalActivities = await db
      .select({
        id: activityFeed.id,
        activityType: activityFeed.activityType,
        entityId: activityFeed.entityId,
        userId: activityFeed.userId,
        targetUserId: activityFeed.targetUserId,
        bookId: activityFeed.bookId,
        metadata: activityFeed.metadata,
        createdAt: activityFeed.createdAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        },
        book: {
          id: books.id,
          title: books.title,
          author: books.author,
          coverImageUrl: books.coverImageUrl
        }
      })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .leftJoin(books, eq(activityFeed.bookId, books.id))
      .orderBy(desc(activityFeed.createdAt))
      .limit(50);

    res.json(globalActivities);
  } catch (error) {
    console.error('Error fetching global stream:', error);
    res.status(500).json({ error: 'Failed to fetch global stream' });
  }
});

// Personal stream - content from people the user follows
router.get("/personal", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // For now, return activities related to user's interests
    // In a real implementation, this would include activities from followed users
    const personalActivities = await db
      .select({
        id: activityFeed.id,
        activityType: activityFeed.activityType,
        entityId: activityFeed.entityId,
        userId: activityFeed.userId,
        targetUserId: activityFeed.targetUserId,
        bookId: activityFeed.bookId,
        metadata: activityFeed.metadata,
        createdAt: activityFeed.createdAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        },
        book: {
          id: books.id,
          title: books.title,
          author: books.author,
          coverImageUrl: books.coverImageUrl
        }
      })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .leftJoin(books, eq(activityFeed.bookId, books.id))
      .orderBy(desc(activityFeed.createdAt))
      .limit(50);

    res.json(personalActivities);
  } catch (error) {
    console.error('Error fetching personal stream:', error);
    res.status(500).json({ error: 'Failed to fetch personal stream' });
  }
});

// Shelves stream - activity related to user's shelves
router.get("/shelves", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Get activities related to user's shelves
    const shelfActivities = await db
      .select({
        id: activityFeed.id,
        activityType: activityFeed.activityType,
        entityId: activityFeed.entityId,
        userId: activityFeed.userId,
        targetUserId: activityFeed.targetUserId,
        bookId: activityFeed.bookId,
        metadata: activityFeed.metadata,
        createdAt: activityFeed.createdAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        },
        book: {
          id: books.id,
          title: books.title,
          author: books.author,
          coverImageUrl: books.coverImageUrl
        }
      })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .leftJoin(books, eq(activityFeed.bookId, books.id))
      .where(eq(activityFeed.userId, userId))
      .orderBy(desc(activityFeed.createdAt))
      .limit(50);

    res.json(shelfActivities);
  } catch (error) {
    console.error('Error fetching shelves stream:', error);
    res.status(500).json({ error: 'Failed to fetch shelves stream' });
  }
});

// Get shelf filters for stream
router.get("/shelves/filters", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Get user's shelves to use as filters
    const userShelves = await db
      .select({
        id: shelves.id,
        name: shelves.name,
        description: shelves.description,
        color: shelves.color,
        createdAt: shelves.createdAt
      })
      .from(shelves)
      .where(eq(shelves.userId, userId))
      .orderBy(asc(shelves.name));

    res.json(userShelves);
  } catch (error) {
    console.error('Error fetching shelf filters:', error);
    res.status(500).json({ error: 'Failed to fetch shelf filters' });
  }
});

// Get last actions for stream
router.get("/last-actions", async (req, res) => {
  try {
    // Get most recent activities across all types
    const lastActions = await db
      .select({
        id: activityFeed.id,
        activityType: activityFeed.activityType,
        entityId: activityFeed.entityId,
        userId: activityFeed.userId,
        targetUserId: activityFeed.targetUserId,
        bookId: activityFeed.bookId,
        metadata: activityFeed.metadata,
        createdAt: activityFeed.createdAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        }
      })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .orderBy(desc(activityFeed.createdAt))
      .limit(20);

    res.json(lastActions);
  } catch (error) {
    console.error('Error fetching last actions:', error);
    res.status(500).json({ error: 'Failed to fetch last actions' });
  }
});

// Admin endpoints for managing activities
router.delete("/activities/:entityId", authenticateToken, requireAdminOrModerator, async (req, res) => {
  try {
    const { entityId } = req.params;

    await db
      .update(activityFeed)
      .set({ deletedAt: new Date() })
      .where(eq(activityFeed.entityId, entityId));

    res.json({ message: 'Activity hidden successfully' });
  } catch (error) {
    console.error('Error hiding activity:', error);
    res.status(500).json({ error: 'Failed to hide activity' });
  }
});

router.put("/activities/:entityId", authenticateToken, requireAdminOrModerator, async (req, res) => {
  try {
    const { entityId } = req.params;
    const { action } = req.body;

    if (action === 'unhide') {
      await db
        .update(activityFeed)
        .set({ deletedAt: null })
        .where(eq(activityFeed.entityId, entityId));
      
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