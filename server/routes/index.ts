import type { Express } from "express";
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwt-utils';
import { storage } from "../storage";
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

import { type Server } from "http";

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
  
  // More route modules will be added here as we migrate them
  return httpServer;
}