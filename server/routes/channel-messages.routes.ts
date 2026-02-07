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
router.get("/:groupId/channels/:channelId/messages", authenticateToken, async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.groupId, groupId)))
      .limit(1);

    if (!channelInfo[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
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
      .leftJoin(users, eq(messagesTable.senderId, users.id))
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
router.put("/:groupId/channels/:channelId/mark-read", authenticateToken, async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const userId = (req as any).user.userId;
    
    console.log('Mark channel as read - Params:', { groupId, channelId, userId });

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.groupId, groupId)))
      .limit(1);

    if (!channelInfo[0]) {
      console.log('Channel not found:', { channelId, groupId });
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    console.log('Channel found:', channelInfo[0]);

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ))
      .limit(1);

    if (!membership[0]) {
      console.log('User not member of group:', { userId, groupId });
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log('User is member of group, proceeding to update read position');

    // Update or create read position with fallback approach
    try {
      // Attempt upsert operation
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
    } catch (upsertError: any) {
      // If upsert fails due to missing constraint, try manual update/insert
      if (upsertError.code === '42P10' || upsertError.message.includes('constraint')) {
        // Check if record exists
        const existingRecord = await db.select().from(userChannelReadPositions)
          .where(and(
            eq(userChannelReadPositions.userId, userId),
            eq(userChannelReadPositions.channelId, channelId)
          ))
          .limit(1);
        
        if (existingRecord.length > 0) {
          // Update existing record
          await db
            .update(userChannelReadPositions)
            .set({ lastReadAt: new Date() })
            .where(and(
              eq(userChannelReadPositions.userId, userId),
              eq(userChannelReadPositions.channelId, channelId)
            ));
        } else {
          // Insert new record
          await db.insert(userChannelReadPositions)
            .values({
              userId,
              channelId,
              lastReadAt: new Date()
            });
        }
      } else {
        // Re-throw if it's a different error
        throw upsertError;
      }
    }
    
    console.log('Read position updated successfully');

    res.json({ message: 'Channel marked as read' });
  } catch (error: any) {
    console.error('Error marking channel as read:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'Failed to mark channel as read' });
  }
});

// Send message to channel
router.post("/:groupId/channels/:channelId/messages", authenticateToken, async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const { content, parentMessageId, quotedMessageId } = req.body;
    const userId = (req as any).user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if user is a member of the group that owns this channel
    const channelInfo = await db
      .select({ groupId: channels.groupId })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.groupId, groupId)))
      .limit(1);

    if (!channelInfo[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
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