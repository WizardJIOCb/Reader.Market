import { Router, type Express } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { 
  channels,
  messages as messagesTable,
  userChannelReadPositions,
  users,
  groupMembers
} from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createChannelMessagesRouter() {
  const router = Router();

// Get messages in a channel
router.get("/:channelId/messages", authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channelInfo[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, channelInfo[0].groupId),
        eq(groupMembers.userId, userId)
      ))
      .limit(1);

    if (!membership[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages with user info
    const channelMessages = await db
      .select({
        id: messagesTable.id,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
        updatedAt: messagesTable.updatedAt,
        senderId: messagesTable.senderId,
        senderUsername: users.username,
        senderAvatar: users.avatarUrl,
        parentMessageId: messagesTable.parentMessageId,
        quotedMessageId: messagesTable.quotedMessageId,
        quotedText: messagesTable.quotedText,
        attachmentUrls: messagesTable.attachmentUrls,
        attachmentMetadata: messagesTable.attachmentMetadata
      })
      .from(messagesTable)
      .innerJoin(users, eq(messagesTable.senderId, users.id))
      .where(eq(messagesTable.channelId, channelId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(50); // Limit to last 50 messages

    res.json(channelMessages);
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    res.status(500).json({ error: 'Failed to fetch channel messages' });
  }
});

// Mark channel as read
router.put("/:channelId/mark-read", authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channelInfo[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, channelInfo[0].groupId),
        eq(groupMembers.userId, userId)
      ))
      .limit(1);

    if (!membership[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update or create read position
    await db.insert(userChannelReadPositions)
      .values({
        userId,
        channelId,
        lastReadAt: new Date()
      })
      .onConflictDoUpdate({
        target: [userChannelReadPositions.userId, userChannelReadPositions.channelId],
        set: { lastReadAt: new Date() }
      });

    res.json({ message: 'Channel marked as read' });
  } catch (error) {
    console.error('Error marking channel as read:', error);
    res.status(500).json({ error: 'Failed to mark channel as read' });
  }
});

// Send message to channel
router.post("/:channelId/messages", authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, parentMessageId, quotedMessageId } = req.body;
    const userId = (req as any).user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channelInfo[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, channelInfo[0].groupId),
        eq(groupMembers.userId, userId)
      ))
      .limit(1);

    if (!membership[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newMessage = await db
      .insert(messagesTable)
      .values({
        senderId: userId,
        channelId,
        content: content.trim(),
        parentMessageId: parentMessageId || null,
        quotedMessageId: quotedMessageId || null
      })
      .returning();

    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Error sending channel message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

  return router;
}