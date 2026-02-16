import type { Express } from "express";
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwt-utils';
import { storage } from "../storage";
import {
  addBookChatUser,
  removeBookChatUser,
  updateBookChatUserPosition,
  setBookChatTyping,
  getBookChatOnlineUsers,
} from '../bookChatState';
import { createArticlesRouter } from "./articles.routes";
import { createBookmarksRouter } from "./bookmarks.routes";
import { createBookmarkCollectionsRouter } from "./bookmark-collections.routes";
import { createBooksRouter } from "./books.routes";
import { createCollectionsRouter } from "./collections.routes";
import { createCommentsRouter } from "./comments.routes";
import { createHealthRouter } from "./health.routes";
import { createGitRouter } from "./git.routes";
import { createMessagingRouter } from "./messaging.routes";
import { createConversationsRouter } from "./conversations.routes";
import { createMiscRouter } from "./misc.routes";
import { createNewsRouter } from "./news.routes";
import { createPageViewRouter } from "./page-view.routes";
import { createProfileRouter } from "./profile.routes";
import { createRatingsRouter } from "./ratings.routes";
import { createReviewsRouter } from "./reviews.routes";
import { createArticleCategoriesRouter } from "./article-categories.routes";
import { createSearchRouter } from "./search.routes";
import { createSettingsRouter } from "./settings.routes";
import { createShelvesRouter } from "./shelves.routes";
import { createStatsRouter } from "./stats.routes";
import { createStreamsRouter } from "./streams.routes";
import { createUsersRouter } from "./users.routes";
import { createAuthRouter } from "./auth.routes";
import { createChannelMessagesRouter } from "./channel-messages.routes";
import { createGroupsRouter } from "./groups.routes";
import { createNotificationsRouter } from "./notifications.routes";
import { createUploadsRouter } from "./uploads.routes";
import { createAdminRouter } from "./admin.routes";
import { createActivityRouter } from "./activity.routes";
import { createTTSRouter } from "./tts.routes";
import { createLoggingConfigRouter } from "./logging-config.routes";
import { createBookTranslationsRouter } from "./book-translations.routes";
import { createLogAnalyticsRouter } from "./log-analytics.routes";
import { createAdminGeneralRouter } from "./admin-general.routes";
import { createOAuthRoutes } from "../oauth/routes";

import { type Server } from "http";

function broadcastOnlineUsers(bookId: string, io: SocketIOServer): void {
  const users = getBookChatOnlineUsers(bookId);
  if (users.length > 0) {
    const userIds = users.map(u => u.id);
    io.to(`book-chat:${bookId}`).emit('book-chat:online-users', { bookId, userIds });
    console.log(`[WEBSOCKET] Broadcasting online users for book ${bookId}:`, users.length, 'users');
  }
}

function broadcastPresenceUpdate(bookId: string, userId: string, action: 'joined' | 'left', io: SocketIOServer, username?: string): void {
  io.to(`book-chat:${bookId}`).emit('book-chat:presence-update', { bookId, userId, action, username });
  console.log(`[WEBSOCKET] Presence update for book ${bookId}, user ${userId}:`, action);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  console.log("Registering API routes...");
  
  // Initialize Socket.io server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      credentials: true
    }
  });
  
  // JWT authentication middleware for Socket.io (optional - allows unauthenticated connections)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Allow connection without authentication
      console.log('[WEBSOCKET] Unauthenticated user connecting');
      socket.data.userId = null;
      return next();
    }
    
    try {
      const decoded = await verifyToken(token);
      if (!decoded) {
        console.log('[WEBSOCKET] Invalid token, allowing unauthenticated connection');
        socket.data.userId = null;
        return next();
      }
      
      // Verify user exists
      const userData = await storage.getUser(decoded.userId);
      if (!userData) {
        console.log('[WEBSOCKET] User not found, allowing unauthenticated connection');
        socket.data.userId = null;
        return next();
      }
      
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      console.error('[WEBSOCKET] Token verification failed, allowing unauthenticated connection:', err);
      socket.data.userId = null;
      next();
    }
  });
  
  // Handle WebSocket connections
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log('[WEBSOCKET] User connected:', userId || 'unauthenticated');
    
    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[WEBSOCKET] User ${userId} joined user:${userId} room`);
    }
    
    // Listen for disconnect
    socket.on('disconnect', (reason) => {
      console.log('[WEBSOCKET] User disconnected:', userId || 'unauthenticated', 'reason:', reason);
    });
    
    // Join book-comments room
    socket.on('join:book-comments', (bookId) => {
      if (bookId) {
        const roomName = `book-comments:${bookId}`;
        socket.join(roomName);
        console.log(`[WEBSOCKET] User joined book-comments room: ${roomName}`);
      }
    });
    
    // Leave book-comments room
    socket.on('leave:book-comments', (bookId) => {
      if (bookId) {
        const roomName = `book-comments:${bookId}`;
        socket.leave(roomName);
        console.log(`[WEBSOCKET] User left book-comments room: ${roomName}`);
      }
    });
    
    // Join user shelves room
    socket.on('join:user:shelves', () => {
      if (userId) {
        const roomName = `user:shelves:${userId}`;
        socket.join(roomName);
        console.log(`[WEBSOCKET] User ${userId} joined shelves room: ${roomName}`);
      }
    });
    
    // Leave user shelves room
    socket.on('leave:user:shelves', () => {
      if (userId) {
        const roomName = `user:shelves:${userId}`;
        socket.leave(roomName);
        console.log(`[WEBSOCKET] User ${userId} left shelves room: ${roomName}`);
      }
    });
    
    // Join book-reactions room
    socket.on('join:book-reactions', (bookId) => {
      if (bookId) {
        const roomName = `book-reactions:${bookId}`;
        socket.join(roomName);
        console.log(`[WEBSOCKET] User joined book-reactions room: ${roomName}`);
      }
    });
    
    // Leave book-reactions room
    socket.on('leave:book-reactions', (bookId) => {
      if (bookId) {
        const roomName = `book-reactions:${bookId}`;
        socket.leave(roomName);
        console.log(`[WEBSOCKET] User left book-reactions room: ${roomName}`);
      }
    });
    
    // Join stream:global room for cross-page reaction updates
    socket.on('join:stream:global', () => {
      socket.join('stream:global');
      console.log(`[WEBSOCKET] User joined stream:global room`);
    });
    
    // Leave stream:global room
    socket.on('leave:stream:global', () => {
      socket.leave('stream:global');
      console.log(`[WEBSOCKET] User left stream:global room`);
    });
    
    // ==================== BOOK CHAT ====================
    
    // Join book chat room
    socket.on('join:book-chat', async (bookId: string) => {
      if (!bookId) return;
      
      const roomName = `book-chat:${bookId}`;
      socket.join(roomName);
      console.log(`[WEBSOCKET] User ${userId} joined book-chat room: ${roomName}`);
      
      // Track user as online
      if (userId) {
        // Get user info
        const user = await storage.getUser(userId);
        if (user) {
          // Add user to online tracking
          addBookChatUser(bookId, userId, socket.id, user.username, user.avatarUrl || undefined);
          
          // Broadcast updated online users list
          broadcastOnlineUsers(bookId, io);
          
          // Notify others about presence
          broadcastPresenceUpdate(bookId, userId, 'joined', io, user.username);
        }
      }
    });
    
    // Leave book chat room
    socket.on('leave:book-chat', (bookId: string) => {
      if (!bookId) return;
      
      const roomName = `book-chat:${bookId}`;
      socket.leave(roomName);
      console.log(`[WEBSOCKET] User ${userId} left book-chat room: ${roomName}`);
      
      // Remove user from online tracking
      if (userId) {
        // Get username before removing
        const onlineUsers = getBookChatOnlineUsers(bookId);
        const userData = onlineUsers.find(u => u.id === userId);
        const username = userData?.username;
        
        // Remove from tracking
        removeBookChatUser(bookId, userId);
        
        // Broadcast updated online users list
        broadcastOnlineUsers(bookId, io);
        
        // Notify others about presence
        if (username) {
          broadcastPresenceUpdate(bookId, userId, 'left', io, username);
        }
      }
    });
    
    // Send book chat message
    socket.on('book-chat:send-message', async (data: { bookId: string; content: string; mentionedUserId?: string; quotedMessageId?: string; attachmentUrls?: string[]; attachmentMetadata?: any }) => {
      if (!userId) {
        socket.emit('book-chat:error', { error: 'Authentication required to send messages' });
        return;
      }
      
      const { bookId, content, mentionedUserId, quotedMessageId, attachmentUrls, attachmentMetadata } = data;
      
      if (!bookId || !content?.trim()) {
        socket.emit('book-chat:error', { error: 'Book ID and content are required' });
        return;
      }
      
      try {
        // Create message in database
        const message = await storage.createBookChatMessage({
          bookId,
          userId,
          content: content.trim(),
          mentionedUserId,
          quotedMessageId,
          attachmentUrls,
          attachmentMetadata,
        });
        
        // Broadcast to all users in the book chat room
        io.to(`book-chat:${bookId}`).emit('book-chat:new-message', message);
        console.log(`[WEBSOCKET] Book chat message sent in book ${bookId} by user ${userId}`);
        
        // Notify mentioned user if any
        if (mentionedUserId) {
          io.to(`user:${mentionedUserId}`).emit('notification:new', {
            type: 'book-chat-mention',
            conversationId: bookId,
            senderId: userId,
          });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Error sending book chat message:', error);
        socket.emit('book-chat:error', { error: 'Failed to send message' });
      }
    });
    
    // Delete book chat message
    socket.on('book-chat:delete-message', async (data: { bookId: string; messageId: string }) => {
      if (!userId) {
        socket.emit('book-chat:error', { error: 'Authentication required' });
        return;
      }
      
      const { bookId, messageId } = data;
      
      try {
        // Check if user is admin/moder
        const user = await storage.getUser(userId);
        const isAdminOrModer = user?.accessLevel === 'admin' || user?.accessLevel === 'moder';
        
        const deleted = await storage.deleteBookChatMessage(messageId, userId, isAdminOrModer);
        
        if (deleted) {
          io.to(`book-chat:${bookId}`).emit('book-chat:message-deleted', { messageId });
          console.log(`[WEBSOCKET] Book chat message ${messageId} deleted by user ${userId}`);
        }
      } catch (error) {
        console.error('[WEBSOCKET] Error deleting book chat message:', error);
        socket.emit('book-chat:error', { error: 'Failed to delete message' });
      }
    });
    
    // Book chat typing indicator
    socket.on('book-chat:typing', (data: { bookId: string; typing: boolean }) => {
      if (!userId) return;
      
      const { bookId, typing } = data;
      
      // Set typing status
      setBookChatTyping(bookId, userId, typing);
      
      // Broadcast typing status to room (exclude sender)
      socket.to(`book-chat:${bookId}`).emit('book-chat:user-typing', { 
        userId, 
        bookId, 
        typing 
      });
    });
    
    // Reading position update
    socket.on('book-chat:reading-position', (data: { bookId: string; chapterIndex: number; pageInChapter: number; totalPagesInChapter: number }) => {
      if (!userId) return;
      
      const { bookId, chapterIndex, pageInChapter, totalPagesInChapter } = data;
      
      // Update user's reading position in online tracking
      updateBookChatUserPosition(bookId, userId, chapterIndex, pageInChapter, totalPagesInChapter);
      
      // Broadcast to others in the room
      socket.to(`book-chat:${bookId}`).emit('book-chat:reading-position', {
        userId,
        bookId,
        chapterIndex,
        pageInChapter,
        totalPagesInChapter,
      });
    });
  });
  
  // Attach io to app so routes can access it
  (app as any).io = io;

  app.use("/api/books", createBooksRouter());
  app.use("/api/profile", createProfileRouter());
  app.use("/api/users", createUsersRouter());
  app.use("/api/admin", createAdminRouter());
  app.use("/api/admin", createAdminGeneralRouter());
  app.use("/api/comments", createCommentsRouter());
  app.use("/api/reviews", createReviewsRouter());
  app.use("/api/bookmarks", createBookmarksRouter());
  app.use("/api/bookmark-collections", createBookmarkCollectionsRouter());
  app.use("/api/news", createNewsRouter());
  app.use("/api/messages", createMessagingRouter());
  app.use("/api/conversations", createConversationsRouter());
  app.use("/api/shelves", createShelvesRouter());
  app.use("/api/articles", createArticlesRouter());
  app.use("/api/ratings", createRatingsRouter());
  app.use("/api/collections", createCollectionsRouter());
  app.use("/api/article-categories", createArticleCategoriesRouter());
  app.use("/api/settings", createSettingsRouter());
  app.use("/api/search", createSearchRouter());
  app.use("/api/stats", createStatsRouter());
  app.use("/api/stream", createStreamsRouter());
  app.use("/api/activity", createActivityRouter());
  app.use("/api/tts", createTTSRouter());
  app.use("/api/admin", createLoggingConfigRouter());
  app.use("/api/book-translations", createBookTranslationsRouter());
  app.use("/api/admin", createLogAnalyticsRouter());
  
  // Additional route modules
  app.use("/api/health", createHealthRouter());
  app.use("/api", createGitRouter()); // Git routes don't have a specific prefix
  app.use("/api/page-view", createPageViewRouter());
  app.use("/api", createMiscRouter()); // Misc routes like /popular-books and /public/users
  app.use("/api/auth", createAuthRouter());
  app.use("/api/groups", createGroupsRouter());
  app.use("/api/groups", createChannelMessagesRouter()); // Channel messages routes
  app.use("/api/notifications", createNotificationsRouter());
  app.use("/api/uploads", createUploadsRouter());
  
  // OAuth routes (mounted at root for /auth/* paths)
  app.use(createOAuthRoutes(app));
  
  // More route modules will be added here as we migrate them
  return httpServer;
}