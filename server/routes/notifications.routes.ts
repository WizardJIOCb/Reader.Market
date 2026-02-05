import { Router, type Express } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { notifications, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export function createNotificationsRouter() {
  const router = Router();

// Get user notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const userNotifications = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        relatedEntityId: notifications.relatedEntityId,
        relatedEntityType: notifications.relatedEntityType,
        content: notifications.content,
        readStatus: notifications.readStatus,
        createdAt: notifications.createdAt
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json(userNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as any).user.userId;

    const updatedNotification = await db
      .update(notifications)
      .set({ readStatus: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    if (updatedNotification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    await db
      .update(notifications)
      .set({ readStatus: true })
      .where(eq(notifications.userId, userId));

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

  return router;
}