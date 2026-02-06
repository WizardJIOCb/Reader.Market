import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { messages, conversations, users } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createMessagingRouter() {
  const router = Router();

  // Send a private message
  router.post("/", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { recipientId, content, conversationId, attachments, quotedMessageId, quotedText } = req.body;
    
    console.log("POST /api/messages called:");
    console.log("- userId:", userId);
    console.log("- recipientId:", recipientId);
    console.log("- content:", content);
    console.log("- conversationId:", conversationId);
    console.log("- attachments:", attachments);
    console.log("- quotedMessageId:", quotedMessageId);
    console.log("- quotedText:", quotedText);
    console.log("- Full request body:", JSON.stringify(req.body, null, 2));
    
    try {
      if (!content || content.trim().length === 0) {
        console.log("ERROR: Message content is required");
        return res.status(400).json({ error: "Message content is required" });
      }
      
      if (!recipientId) {
        console.log("ERROR: Recipient ID is required");
        return res.status(400).json({ error: "Recipient ID is required" });
      }
      
      // Check if recipient exists
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      
      // Find or create conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
      } else {
        // Find existing conversation between these users
        conversation = await storage.findConversationBetweenUsers(userId, recipientId);
        
        if (!conversation) {
          // Create new conversation
          conversation = await storage.createConversation(userId, recipientId);
        }
      }
      
      // Process attachments if provided
      let attachmentMetadata = null;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        console.log('🔵 Processing attachments:', attachments);
        const uploadedAttachments = [];
        for (const uploadId of attachments) {
          const fileUpload = await storage.getFileUpload(uploadId);
          console.log('🔵 File upload for', uploadId, ':', fileUpload);
          if (fileUpload && fileUpload.uploaderId === userId && fileUpload.entityType === 'temp') {
            uploadedAttachments.push({
              url: fileUpload.fileUrl,
              filename: fileUpload.filename,
              fileSize: fileUpload.fileSize,
              mimeType: fileUpload.mimeType,
              thumbnailUrl: fileUpload.thumbnailUrl
            });
          }
        }
        if (uploadedAttachments.length > 0) {
          attachmentMetadata = { attachments: uploadedAttachments };
          console.log('🟡 Created attachmentMetadata:', JSON.stringify(attachmentMetadata, null, 2));
        }
      }
      
      const messageData: any = {
        senderId: userId,
        recipientId,
        conversationId: conversation.id,
        content: content.trim(),
        readStatus: false,
        attachmentMetadata
      };
      
      // Add quote data if provided
      if (quotedMessageId) {
        messageData.quotedMessageId = quotedMessageId;
        messageData.quotedText = quotedText || null;
      }
      
      console.log('🟢 Calling createMessage with data:', JSON.stringify(messageData, null, 2));
      
      // Create message with attachments
      const message = await storage.createMessage(messageData);
      console.log('🟢 createMessage returned:', JSON.stringify(message, null, 2));
      
      // Create enriched message object with sender information
      const enrichedMessage = {
        ...message,
        sender: {
          id: message.senderId,
          username: message.senderUsername,
          fullName: message.senderFullName,
          avatarUrl: message.senderAvatarUrl
        }
      };
      
      // Broadcast message via WebSocket
      const io = (req.app as any).io;
      if (io) {
        // Send to recipient and sender
        io.to(`user:${recipientId}`).emit('message:new', enrichedMessage);
        io.to(`user:${userId}`).emit('message:new', enrichedMessage);
        
        // Send to conversation room
        io.to(`conversation:${conversation.id}`).emit('conversation:message', enrichedMessage);
      }
      
      res.status(201).json(enrichedMessage);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get messages in a conversation
  router.get("/conversation/:conversationId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    try {
      // Verify user is part of this conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        return res.status(403).json({ error: "Access denied to this conversation" });
      }
      
      // Get messages
      const messages = await storage.getConversationMessages(conversationId, limit, offset);
      
      // Mark messages as read
      await storage.markConversationMessagesAsRead(conversationId, userId);
      
      // Send unread count update to user
      const io = (req.app as any).io;
      if (io) {
        await storage.sendUnreadCountUpdate(userId, io);
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Get conversation messages error:", error);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });

  // Get unread message count
  router.get("/unread-count", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    
    try {
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Mark message as read
  router.put("/:messageId/read", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId } = req.params;
    
    try {
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  // Add reaction to message
  router.post("/:messageId/reactions", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId } = req.params;
    const { emoji } = req.body;
    
    try {
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Check access - user must be part of conversation or group
      if (message.conversationId) {
        const conversation = await storage.getConversation(message.conversationId);
        if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (message.channelId) {
        // Get channel to find group
        const channels = await storage.getGroupChannels(message.channelId);
        if (channels.length > 0) {
          const isMember = await storage.isGroupMember(channels[0].groupId, userId);
          if (!isMember) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      }
      
      const reaction = await storage.addMessageReaction(messageId, userId, emoji);
      
      // Broadcast reaction via WebSocket
      const io = (req.app as any).io;
      if (io) {
        if (message.conversationId) {
          io.to(`conversation:${message.conversationId}`).emit('reaction:new', {
            reaction,
            messageId,
            conversationId: message.conversationId
          });
        } else if (message.channelId) {
          io.to(`channel:${message.channelId}`).emit('channel:reaction:new', {
            reaction,
            messageId,
            channelId: message.channelId
          });
        }
      }
      
      res.status(201).json(reaction);
    } catch (error) {
      console.error("Add reaction error:", error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  // Remove reaction
  router.delete("/:messageId/reactions/:reactionId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId, reactionId } = req.params;
    
    try {
      // Get message to determine where to broadcast
      const message = await storage.getMessage(messageId);
      
      await storage.removeMessageReaction(reactionId, userId);
      
      // Broadcast reaction removal via WebSocket
      const io = (req.app as any).io;
      if (io && message) {
        if (message.conversationId) {
          io.to(`conversation:${message.conversationId}`).emit('reaction:removed', {
            reactionId,
            messageId,
            conversationId: message.conversationId
          });
        } else if (message.channelId) {
          io.to(`channel:${message.channelId}`).emit('channel:reaction:removed', {
            reactionId,
            messageId,
            channelId: message.channelId
          });
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Remove reaction error:", error);
      res.status(500).json({ error: "Failed to remove reaction" });
    }
  });

  // Get message reactions
  router.get("/:messageId/reactions", authenticateToken, async (req, res) => {
    const { messageId } = req.params;
    
    try {
      const reactions = await storage.getMessageReactions(messageId);
      res.json(reactions);
    } catch (error) {
      console.error("Get reactions error:", error);
      res.status(500).json({ error: "Failed to retrieve reactions" });
    }
  });

  // Delete message
  router.delete("/:messageId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId } = req.params;
    
    try {
      // Get the message to check permissions
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Get user to check if admin/moder
      const user = await storage.getUser(userId);
      const isGlobalAdminOrModer = user && (user.accessLevel === 'admin' || user.accessLevel === 'moder');
      
      // Check if user is the sender (can delete own messages)
      let canDelete = message.senderId === userId || isGlobalAdminOrModer;
      let isGroupAdminOrModer = false;
      
      // If message is in a channel (group chat), check if user is admin/moderator
      if (!canDelete && message.channelId) {
        // Get the channel to find the group
        const channel = await storage.getChannel(message.channelId);
        if (channel) {
          const role = await storage.getGroupMemberRole(channel.groupId, userId);
          isGroupAdminOrModer = role === 'administrator' || role === 'moderator';
          canDelete = isGroupAdminOrModer;
        }
      }
      
      if (!canDelete) {
        return res.status(403).json({ error: "Insufficient permissions to delete this message" });
      }
      
      // Delete the message
      // Pass null for userId if admin/moderator (to bypass sender check in storage)
      const userIdForDelete = (isGlobalAdminOrModer || isGroupAdminOrModer) ? null : userId;
      const deleted = await storage.deleteMessage(messageId, userIdForDelete);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete message" });
      }
      
      // Broadcast deletion via WebSocket
      const io = (req.app as any).io;
      if (io) {
        if (message.conversationId) {
          io.to(`conversation:${message.conversationId}`).emit('message:deleted', {
            messageId,
            conversationId: message.conversationId
          });
        } else if (message.channelId) {
          io.to(`channel:${message.channelId}`).emit('channel:message:deleted', {
            messageId,
            channelId: message.channelId
          });
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  return router;
}