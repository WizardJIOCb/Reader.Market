import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';

export function createConversationsRouter() {
  const router = Router();

  // Get conversations for a user
  router.get("/", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    
    console.log("=== GET /api/conversations ===");
    console.log("CODE VERSION: 2026-01-07-v2 - FIXED QUERY");
    console.log("Timestamp:", new Date().toISOString());
    console.log("User ID from token:", userId);
    console.log("User username:", (req as any).user.username);
    
    try {
      const conversations = await storage.getUserConversations(userId);
      console.log("Conversations returned:", conversations.length);
      if (conversations.length > 0) {
        console.log("Sample conversation:", JSON.stringify(conversations[0], null, 2));
      } else {
        console.log("⚠️  WARNING: No conversations found for this user!");
      }
      console.log("=========================");
      
      // Add version header for debugging
      res.setHeader('X-API-Version', '2026-01-07-v2');
      res.json(conversations);
    } catch (error) {
      console.error("❌ Get conversations error:", error);
      res.status(500).json({ error: "Failed to retrieve conversations" });
    }
  });

  // Create a new conversation
  router.post("/", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { otherUserId } = req.body;
    
    console.log("POST /api/conversations called with userId:", userId, "otherUserId:", otherUserId);
    
    try {
      if (!otherUserId) {
        return res.status(400).json({ error: "Other user ID is required" });
      }
      
      // Check if conversation already exists
      const existing = await storage.findConversationBetweenUsers(userId, otherUserId);
      console.log("Existing conversation found:", existing);
      
      if (existing) {
        // Get the other user's details
        const otherUser = await storage.getUser(otherUserId);
        console.log("Other user details:", otherUser);
        
        const response = {
          ...existing,
          otherUser: otherUser ? {
            id: otherUser.id,
            username: otherUser.username,
            fullName: otherUser.fullName,
            avatarUrl: otherUser.avatarUrl,
          } : null,
          lastMessage: existing.lastMessageId ? null : null // Will be populated by getUserConversations
        };
        console.log("Returning existing conversation with otherUser:", response);
        return res.json(response);
      }
      
      // Create new conversation
      const conversation = await storage.createConversation(userId, otherUserId);
      console.log("Created new conversation:", conversation);
      
      // Get the other user's details
      const otherUser = await storage.getUser(otherUserId);
      console.log("Other user details for new conversation:", otherUser);
      
      const response = {
        ...conversation,
        otherUser: otherUser ? {
          id: otherUser.id,
          username: otherUser.username,
          fullName: otherUser.fullName,
          avatarUrl: otherUser.avatarUrl,
        } : null,
        lastMessage: null
      };
      console.log("Returning new conversation with otherUser:", response);
      res.status(201).json(response);
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get conversation details
  router.get("/:conversationId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { conversationId } = req.params;
    
    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Check if user is part of this conversation
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        return res.status(403).json({ error: "Access denied to this conversation" });
      }
      
      // Get the other participant's details
      const otherUserId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
      const otherUser = await storage.getUser(otherUserId);
      
      const response = {
        ...conversation,
        otherUser: otherUser ? {
          id: otherUser.id,
          username: otherUser.username,
          fullName: otherUser.fullName,
          avatarUrl: otherUser.avatarUrl,
        } : null
      };
      
      res.json(response);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Failed to retrieve conversation" });
    }
  });

  return router;
}