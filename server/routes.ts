import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { getPersonalActivitiesDirect, getProfileActivitiesDirect, getProfileCommentsDirect } from './directStorage';
import { sql } from "drizzle-orm/sql";
import { eq, and, inArray, or, ilike, desc, asc, exists, ne } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Ollama } from "ollama";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createCommentActivity, createReviewActivity, createBookActivity, createNewsActivity } from "./streamHelpers";
import { logUserAction, logGroupMessageAction } from "./actionLoggingMiddleware";
import { createOAuthRoutes } from "./oauth/routes";
import { profileComments, readingProgress, bookmarkCollections, bookmarkCollectionItems, collectionBooks, users, bookmarks, books } from "@shared/schema";
import bookTranslationRoutes from "./routes/bookTranslations";
import loggingConfigRoutes from "./routes/loggingConfig";
import logAnalyticsRoutes from "./routes/logAnalytics";
import ttsRoutes from "./routes/tts.routes";
import ttsPersonaRoutes from "./routes/tts.persona.routes";
import { logAggregator, logMiddleware } from './logAggregator';

// Import db from storage module
import { db } from './storage';

// Initialize Ollama client
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// Configure multer for file uploads
// Use a relative path approach that works after bundling
const storageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storageEngine,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept book files and image files
    const allowedBookTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/epub+zip',
      'text/plain',
      'application/fb2',
      'application/x-fictionbook+xml',
      'text/xml',
      'application/octet-stream'
    ];
    
    const allowedImageTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp'
    ];
    
    // Check if it's an FB2 file by extension
    const fileName = file.originalname.toLowerCase();
    const isFB2File = fileName.endsWith('.fb2');
    
    if (allowedBookTypes.includes(file.mimetype) || allowedImageTypes.includes(file.mimetype) || isFB2File) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Configure multer specifically for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create avatars directory if it doesn't exist
    const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId-timestamp.ext
    const userId = (req as any).user?.userId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp'
    ];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      (error as any).code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  }
});

// Helper function to generate JWT token
const generateToken = (userId: string, accessLevel?: string) => {
  return jwt.sign({ userId, accessLevel }, process.env.JWT_SECRET || "default_secret", {
    expiresIn: "7d",
  });
};

// Middleware to authenticate requests
const authenticateToken = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  // Promisify jwt.verify
  const verifyToken = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  };

  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || "default_secret") as any;
    
    // Verify that the user actually exists in the database
    const userData = await storage.getUser(decoded.userId);
    if (!userData) {
      return res.status(401).json({ error: "User not found. Please log in again." });
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Optional authentication middleware - allows both authenticated and unauthenticated requests
const optionalAuthenticateToken = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // If no token, continue without user data
  if (!token) {
    (req as any).user = null;
    return next();
  }

  // Promisify jwt.verify
  const verifyToken = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  };

  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || "default_secret") as any;
    
    // Verify that the user actually exists in the database
    const userData = await storage.getUser(decoded.userId);
    if (!userData) {
      // If user not found, continue without user data instead of returning error
      (req as any).user = null;
      return next();
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    // If token is invalid, continue without user data instead of returning error
    console.log("Optional auth: Invalid token, continuing as unauthenticated");
    (req as any).user = null;
    next();
  }
};

// Middleware to check if user has admin or moder access level
const requireAdminOrModerator = async (req: Request, res: Response, next: Function) => {
  const userId = (req as any).user.userId;
  
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if user has admin or moder access level
    if (user.accessLevel !== 'admin' && user.accessLevel !== 'moder') {
      return res.status(403).json({ error: "Access denied: Admin or moderator privileges required" });
    }
    
    next();
  } catch (error) {
    console.error("Admin access check error:", error);
    return res.status(500).json({ error: "Failed to verify admin access" });
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  console.log("Registering API routes...");
  
  // Initialize Socket.io server (moved up so OAuth routes can access it)
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any;
      
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
    const isAuthenticated = !!userId;
    
    if (isAuthenticated) {
      console.log('\x1b[34m%s\x1b[0m', `[WEBSOCKET] 🔗 User ${userId} connected via WebSocket`);
      
      // Join user's personal room for notifications (authenticated only)
      const personalRoom = `user:${userId}`;
      socket.join(personalRoom);
      console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ User ${userId} joined personal room: ${personalRoom}`);
    } else {
      console.log('\x1b[34m%s\x1b[0m', `[WEBSOCKET] 🔗 Unauthenticated user connected via WebSocket`);
    }
    
    // Log all rooms this socket is in
    const rooms = Array.from(socket.rooms);
    console.log('\x1b[36m%s\x1b[0m', `[WEBSOCKET] 📋 Socket rooms: ${JSON.stringify(rooms)}`);
    
    // Handle joining conversation rooms (authenticated only)
    socket.on('join:conversation', (conversationId: string) => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to join conversation - denied');
        return;
      }
      console.log(`User ${userId} joining conversation ${conversationId}`);
      socket.join(`conversation:${conversationId}`);
    });
    
    // Handle leaving conversation rooms (authenticated only)
    socket.on('leave:conversation', (conversationId: string) => {
      if (!isAuthenticated) return;
      console.log(`User ${userId} leaving conversation ${conversationId}`);
      socket.leave(`conversation:${conversationId}`);
    });
    
    // Handle joining channel rooms (authenticated only)
    socket.on('join:channel', (channelId: string) => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to join channel - denied');
        return;
      }
      console.log(`User ${userId} joining channel ${channelId}`);
      socket.join(`channel_${channelId}`);
    });
    
    // Handle leaving channel rooms (authenticated only)
    socket.on('leave:channel', (channelId: string) => {
      if (!isAuthenticated) return;
      console.log(`User ${userId} leaving channel ${channelId}`);
      socket.leave(`channel:${channelId}`);
    });
    
    // Handle typing indicators for conversations (authenticated only)
    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!isAuthenticated) return;
      socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
        userId,
        conversationId: data.conversationId,
        typing: true
      });
    });
    
    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!isAuthenticated) return;
      socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
        userId,
        conversationId: data.conversationId,
        typing: false
      });
    });
    
    // Handle typing indicators for channels (authenticated only)
    socket.on('channel:typing:start', (data: { channelId: string }) => {
      if (!isAuthenticated) return;
      socket.to(`channel:${data.channelId}`).emit('channel:user:typing', {
        userId,
        channelId: data.channelId,
        typing: true
      });
    });
    
    socket.on('channel:typing:stop', (data: { channelId: string }) => {
      if (!isAuthenticated) return;
      socket.to(`channel:${data.channelId}`).emit('channel:user:typing', {
        userId,
        channelId: data.channelId,
        typing: false
      });
    });
    
    // Handle joining stream rooms
    socket.on('join:stream:global', () => {
      // Global stream is accessible to everyone (authenticated and unauthenticated)
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} joining global stream`);
      socket.join('stream:global');
      console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ Joined global stream room`);
    });
    
    socket.on('join:stream:personal', () => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to join personal stream - denied');
        return;
      }
      console.log(`User ${userId} joining personal stream`);
      // Users automatically get personal stream via their personalRoom
    });
    
    socket.on('join:stream:shelves', () => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to join shelves stream - denied');
        return;
      }
      console.log(`User ${userId} joining shelves stream`);
      socket.join(`stream:shelves:${userId}`);
      console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ User ${userId} joined shelves stream room`);
    });
    
    socket.on('join:stream:last-actions', () => {
      // Last actions stream is accessible to everyone (authenticated and unauthenticated)
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} joining last actions stream`);
      socket.join('stream:last-actions');
      console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ Joined last actions stream room`);
    });
    
    // Handle leaving stream rooms
    socket.on('leave:stream:global', () => {
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} leaving global stream`);
      socket.leave('stream:global');
    });
    
    socket.on('leave:stream:shelves', () => {
      if (!isAuthenticated) return;
      console.log(`User ${userId} leaving shelves stream`);
      socket.leave(`stream:shelves:${userId}`);
    });
    
    socket.on('leave:stream:last-actions', () => {
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} leaving last actions stream`);
      socket.leave('stream:last-actions');
    });
    
    // Book chat room handlers
    socket.on('join:book-chat', (bookId: string) => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to join book chat - denied');
        return;
      }
      const roomName = `book-chat:${bookId}`;
      socket.join(roomName);
      console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ User ${userId} joined book chat room: ${roomName}`);
      
      // Notify others that user joined
      socket.to(roomName).emit('book-chat:user-joined', {
        oderId: userId,
        bookId,
      });
      
      // Get list of users in the room
      const room = io.sockets.adapter.rooms.get(roomName);
      const socketsInRoom = room ? Array.from(room) : [];
      
      // Get user IDs from connected sockets
      const onlineUserIds: string[] = [];
      socketsInRoom.forEach(socketId => {
        const s = io.sockets.sockets.get(socketId);
        if (s && s.data.userId && s.data.userId !== userId) {
          onlineUserIds.push(s.data.userId);
        }
      });
      
      // Send current online users to the joining user
      socket.emit('book-chat:online-users', {
        bookId,
        userIds: onlineUserIds,
      });
      
      // Broadcast updated online list to all in room
      io.to(roomName).emit('book-chat:presence-update', {
        bookId,
        userId,
        action: 'joined',
      });
    });
    
    socket.on('leave:book-chat', (bookId: string) => {
      if (!isAuthenticated) return;
      const roomName = `book-chat:${bookId}`;
      socket.leave(roomName);
      console.log(`[WEBSOCKET] User ${userId} left book chat room: ${roomName}`);
      
      // Notify others that user left
      io.to(roomName).emit('book-chat:presence-update', {
        bookId,
        userId,
        action: 'left',
      });
    });
    
    socket.on('book-chat:send-message', async (data: { bookId: string; content: string; mentionedUserId?: string; quotedMessageId?: string; attachmentUrls?: string[]; attachmentMetadata?: any }) => {
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to send book chat message - denied');
        return;
      }
      
      try {
        // Save message to database
        const message = await storage.createBookChatMessage({
          bookId: data.bookId,
          userId: userId!,
          content: data.content,
          mentionedUserId: data.mentionedUserId,
          quotedMessageId: data.quotedMessageId,
          attachmentUrls: data.attachmentUrls,
          attachmentMetadata: data.attachmentMetadata,
        });
        
        // Broadcast to all users in the book chat room
        const roomName = `book-chat:${data.bookId}`;
        io.to(roomName).emit('book-chat:new-message', message);
        
        console.log(`[WEBSOCKET] Book chat message sent in ${roomName} by user ${userId}`);
      } catch (error) {
        console.error('[WEBSOCKET] Error sending book chat message:', error);
        socket.emit('book-chat:error', { error: 'Failed to send message' });
      }
    });
    
    socket.on('book-chat:typing', (data: { bookId: string; typing: boolean }) => {
      if (!isAuthenticated) return;
      const roomName = `book-chat:${data.bookId}`;
      socket.to(roomName).emit('book-chat:user-typing', {
        userId,
        bookId: data.bookId,
        typing: data.typing,
      });
    });
    

    socket.on('book-chat:delete-message', async (data: { bookId: string; messageId: string }) => {
      console.log('[WEBSOCKET] Received book-chat:delete-message', { bookId: data.bookId, messageId: data.messageId, isAuthenticated, userId });
      if (!isAuthenticated) {
        console.log('[WEBSOCKET] Unauthenticated user tried to delete book chat message - denied');
        return;
      }
      
      try {
        // Get user to check if admin/moder
        const user = await storage.getUser(userId!);
        const isAdminOrModer = user && (user.accessLevel === 'admin' || user.accessLevel === 'moder');
        console.log('[WEBSOCKET] User access level:', user?.accessLevel, 'isAdminOrModer:', isAdminOrModer);
        
        // Delete message
        const deleted = await storage.deleteBookChatMessage(data.messageId, userId!, isAdminOrModer || false);
        console.log('[WEBSOCKET] Delete result:', deleted);
        
        if (deleted) {
          // Broadcast deletion to all users in the book chat room
          const roomName = `book-chat:${data.bookId}`;
          io.to(roomName).emit('book-chat:message-deleted', { messageId: data.messageId });
          console.log(`[WEBSOCKET] Book chat message ${data.messageId} deleted by user ${userId}`);
        } else {
          console.log('[WEBSOCKET] Delete failed - broadcasting error');
          socket.emit('book-chat:error', { error: 'Failed to delete message or permission denied' });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Error deleting book chat message:', error);
        socket.emit('book-chat:error', { error: 'Failed to delete message' });
      }
    });
    
    // NEW: Handle reading position updates
    socket.on('book-chat:reading-position', (data: { 
      bookId: string; 
      chapterIndex: number; 
      pageInChapter: number;
      totalPagesInChapter: number;
    }) => {
      if (!isAuthenticated) return;
      
      const roomName = `book-chat:${data.bookId}`;
      
      // Broadcast position update to all users in the room except sender
      socket.to(roomName).emit('book-chat:reading-position', {
        userId,
        bookId: data.bookId,
        chapterIndex: data.chapterIndex,
        pageInChapter: data.pageInChapter,
        totalPagesInChapter: data.totalPagesInChapter,
      });
      
      console.log(`[WEBSOCKET] Reading position updated for user ${userId} in ${roomName}: Chapter ${data.chapterIndex}, Page ${data.pageInChapter}/${data.totalPagesInChapter}`);
    });
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} disconnected from WebSocket`);
    });
  });
  
  // Store io instance globally so we can use it in route handlers
  (app as any).io = io;
  
  // Register OAuth routes WITHOUT /api prefix (they handle their own /auth prefix)
  // Must be after io is attached so registration activity can be broadcasted
  app.use(createOAuthRoutes(app));
  
  // Register book translation routes
  app.use('/api', bookTranslationRoutes);
  
  // Register logging configuration routes
  app.use('/api/admin', loggingConfigRoutes);
  
  // Register log analytics routes
  app.use('/api/admin', logAnalyticsRoutes);
  
  // Register TTS routes
  app.use('/api/tts', ttsRoutes);
  app.use('/api/tts', ttsPersonaRoutes);
  
  // Add log middleware to capture HTTP requests
  app.use(logMiddleware(logAggregator));
  
  // put application routes here
  // prefix all routes with /api
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    console.log("Health check endpoint called");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // Git commit history endpoint - no authentication required
  app.get("/git-to-gpt", async (req, res) => {
    console.log("Git commit history endpoint called");
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Get parameters
      const countParam = req.query.count;
      const count = countParam !== undefined ? parseInt(countParam as string, 10) : undefined;
      const template = req.query.template as string | undefined;
      
      console.log(`Requested count: ${count}, template: ${template}`);
            
      const commits = [];
      let page = 1;
      const perPage = 100; // Maximum allowed by GitHub API
      let hasNextPage = true;
            
      // Fetch commits until we have enough or reach the end
      while (hasNextPage && (count === 0 || commits.length < (count || 100))) {
        const apiUrl = `https://api.github.com/repos/WizardJIOCb/Reader.Market/commits?per_page=${perPage}&page=${page}&_=${currentTime}`;
        console.log(`Fetching GitHub commits from: ${apiUrl}`);
              
        // Fetch from GitHub API
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'reader.market-app/1.0',
            'Accept': 'application/vnd.github.v3+json'
          }
        });
              
        if (!response.ok) {
          throw new Error(`GitHub API responded with status ${response.status}`);
        }
              
        const commitsData = await response.json();
              
        // Transform GitHub API response to our format
        const pageCommits = commitsData.map((commit: any) => ({
          hash: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line only
          author: commit.commit.author.name,
          timestamp: commit.commit.author.date,
          url: commit.html_url
        }));
              
        commits.push(...pageCommits);
        console.log(`Page ${page}: fetched ${pageCommits.length} commits`);
              
        // Check if there are more pages
        hasNextPage = pageCommits.length === perPage && (count === 0 || commits.length < (count || 100));
        page++;
      }
            
      // Apply count limit if specified
      const finalCommits = count !== undefined && count > 0 ? commits.slice(0, count) : commits;
            
      console.log(`Total commits fetched: ${finalCommits.length}`);
      
      // If template is specified, return HTML instead of JSON
      console.log(`Template requested: ${template}`);
      if (template === 'cool') {
        const htmlResponse = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Git History - Reader.Market</title>
    <style>
        :root {
            /* Reader.Market light theme colors */
            --background: #f5f0e6; /* 35 30% 96% - soft cream paper */
            --foreground: #262626; /* 220 10% 15% - dark charcoal ink */
            --primary: #3a5a7a;    /* 230 45% 35% - academic blue */
            --secondary: #e6d9c2;  /* 35 20% 90% - darker paper for secondary */
            --accent: #c47a40;     /* 25 60% 50% - subtle orange/sepia highlight */
            --muted: #d9cab3;      /* 35 15% 85% - muted background */
            --border: #d9cab3;     /* 35 15% 85% - border color */
            --button: #3a5a7a;     /* Primary blue for buttons */
            --card: #faf5eb;       /* Light card background */
            --card-hover: #f0e6d2; /* Slightly darker on hover */
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--background);
            color: var(--foreground);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--primary);
            font-size: 2.2rem;
            font-weight: 700;
        }
        
        .header p {
            color: var(--foreground);
            margin: 0 0 20px 0;
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .stat-box {
            background: var(--secondary);
            border: 1px solid var(--border);
            color: var(--foreground);
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .commits-grid {
            display: grid;
            gap: 16px;
        }
        
        .commit-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .commit-card:hover {
            background: var(--card-hover);
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        }
        
        .commit-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .commit-hash {
            font-family: 'Monaco', 'Consolas', monospace;
            background: var(--primary);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .commit-date {
            color: var(--foreground);
            font-size: 0.85rem;
            opacity: 0.7;
        }
        
        .commit-message {
            font-size: 1.1rem;
            font-weight: 500;
            color: var(--foreground);
            margin-bottom: 15px;
            line-height: 1.5;
        }
        
        .commit-author {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .author-avatar {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.8rem;
        }
        
        .author-name {
            font-weight: 500;
            color: var(--foreground);
            opacity: 0.8;
        }
        
        .commit-link {
            display: inline-block;
            background: var(--button);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-top: 12px;
        }
        
        .commit-link:hover {
            background: #2c4a6a;
            transform: translateY(-1px);
        }
        
        .footer {
            text-align: center;
            color: var(--foreground);
            margin-top: 40px;
            padding: 20px;
            font-size: 0.9rem;
            border-top: 1px solid var(--border);
            opacity: 0.7;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.8rem;
            }
            
            .stats {
                gap: 12px;
            }
            
            .commit-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .commit-card {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Reader.Market Commits</h1>
            <p>Полная история изменений проекта</p>
            <div class="stats">
                <div class="stat-box">Всего коммитов: ${finalCommits.length}</div>
                <div class="stat-box">Репозиторий: WizardJIOCb/Reader.Market</div>
                <div class="stat-box">Обновлено: ${new Date().toLocaleString('ru-RU')}</div>
            </div>
        </div>
        
        <div class="commits-grid">
            ${finalCommits.map((commit: any) => `
                <div class="commit-card">
                    <div class="commit-header">
                        <div class="commit-hash">${commit.hash.substring(0, 7)}</div>
                        <div class="commit-date">${new Date(commit.timestamp).toLocaleString('ru-RU')}</div>
                    </div>
                    
                    <div class="commit-message">${commit.message}</div>
                    
                    <div class="commit-author">
                        <div class="author-avatar">${commit.author.charAt(0)}</div>
                        <div class="author-name">${commit.author}</div>
                    </div>
                    
                    <a href="${commit.url}" target="_blank" class="commit-link">
                        📄 Посмотреть на GitHub
                    </a>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            Generated by git-to-gpt endpoint • ${new Date().toISOString()}
        </div>
    </div>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlResponse);
      }
      
      // Default JSON response
      res.json({
        success: true,
        repository: 'WizardJIOCb/Reader.Market',
        url: `https://github.com/WizardJIOCb/Reader.Market/commits/main?cache=${currentTime}`,
        api_url: `https://api.github.com/repos/WizardJIOCb/Reader.Market/commits`,
        timestamp: new Date().toISOString(),
        cache_buster: currentTime,
        requested_count: count,
        total_fetched: finalCommits.length,
        commits: finalCommits
      });
      
    } catch (error) {
      console.error('Error fetching git history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch commit history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Navigation tracking endpoints (lightweight, just for logging)
  app.get("/api/page-view/home", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "home" });
  });
  
  app.get("/api/page-view/stream", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "stream" });
  });
  
  app.get("/api/page-view/search", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "search" });
  });
  
  app.get("/api/page-view/shelves", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "shelves" });
  });
  
  app.get("/api/page-view/messages", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "messages" });
  });
  
  app.get("/api/page-view/about", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "about" });
  });
  
  app.get("/api/page-view/users", authenticateToken, logUserAction, (req, res) => {
    res.json({ page: "users" });
  });
  
  // Get popular books for landing page
  app.get("/api/popular-books", async (req, res) => {
    try {
      const popularBooks = await storage.getPopularBooks(6);
      res.json(popularBooks);
    } catch (error) {
      console.error('[API] Error fetching popular books:', error);
      res.status(500).json({ error: 'Failed to fetch popular books' });
    }
  });
  
  // Get public users list with search, sort, and pagination
  app.get("/api/public/users", async (req, res) => {
    try {
      // Parse and validate query parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const rawLimit = parseInt(req.query.limit as string) || 9;
      const limit = [3, 6, 9, 12].includes(rawLimit) ? rawLimit : 9; // Validate limit
      const search = req.query.search as string | undefined;
      const rawSortBy = req.query.sortBy as string || 'rating';
      const sortOrder = (req.query.order as string) === 'asc' ? 'asc' : 'desc';
      
      // Whitelist sortBy parameter to prevent SQL injection
      const allowedSortOptions = ['rating', 'shelves', 'books', 'comments', 'reviews', 'lastActivity', 'registered'];
      const sortBy = allowedSortOptions.includes(rawSortBy) 
        ? rawSortBy as 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' | 'registered'
        : 'rating';
      
      const { users, total } = await storage.getPublicUsers(page, limit, search, sortBy, sortOrder);
      
      const pages = Math.ceil(total / limit);
      
      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error) {
      console.error('[API] Error fetching public users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // User registration
  app.post("/api/auth/register", async (req, res) => {
    console.log("Registration endpoint called");
    try {
      const { username, password, email, fullName, language } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Check if user already exists (case-insensitive)
      const existingUser = await storage.getUserByUsernameCaseInsensitive(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user with language preference
      const user = await storage.createUser({ 
        username, 
        password: hashedPassword,
        email,
        fullName,
        language: language || 'en' // Default to 'en' if not provided
      });
      
      // Generate token
      const token = generateToken(user.id, user.accessLevel);
      
      // Create default "My books" shelf for new user
      try {
        console.log('[Registration] Creating default shelf for new user');
        await storage.createShelf(user.id, {
          name: 'My books',
          description: 'My personal book collection',
          color: 'bg-blue-100 dark:bg-blue-900/20'
        });
        console.log('[Registration] ✅ Default shelf created');
      } catch (shelfError) {
        console.error('[Registration] Failed to create default shelf:', shelfError);
        // Don't fail registration if shelf creation fails
      }
      
      // Log user registration action and broadcast via WebSocket
      try {
        console.log('[Registration] Creating user action for registration event');
        const action = await storage.createUserAction({
          userId: user.id,
          actionType: 'user_registered',
          targetType: 'user',
          targetId: user.id,
          metadata: { username: user.username }
        });
        console.log('[Registration] User action created:', action?.id);
        
        // Broadcast registration event via WebSocket
        if ((app as any).io && action) {
          const io = (app as any).io;
          console.log('[Registration] Broadcasting registration event to stream:global');
          
          const eventData = {
            id: action.id,
            type: 'user_action',
            action_type: 'user_registered',
            entityId: action.id,
            userId: user.id,
            user: {
              id: user.id,
              username: user.username,
              avatar_url: user.avatarUrl || null
            },
            target: {
              type: 'user',
              id: user.id,
              username: user.username,
              avatar_url: user.avatarUrl || null
            },
            metadata: { username: user.username },
            createdAt: action.createdAt,
            timestamp: action.createdAt.toISOString()
          };
          
          // Broadcast to both global stream and last-actions room
          io.to('stream:global').emit('stream:last-action', eventData);
          io.to('stream:last-actions').emit('stream:last-action', eventData);
          console.log('[Registration] ✅ Registration event broadcasted to stream:global and stream:last-actions');
        }
      } catch (actionError) {
        console.error('[Registration] Failed to log user action or broadcast event:', actionError);
        // Don't fail registration if action logging fails
      }
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  // User login
  app.post("/api/auth/login", async (req, res) => {
    console.log("Login endpoint called");
    try {
      const { username, password } = req.body;
      console.log("Login attempt for username:", username);
      
      if (!username || !password) {
        console.log("Missing username or password");
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Find user
      console.log("Searching for user by username:", username);
      const user = await storage.getUserByUsername(username);
      console.log("User lookup result:", user ? "found" : "not found");
      
      if (!user) {
        console.log("User not found, returning invalid credentials");
        return res.status(400).json({ error: "Invalid credentials" });
      }
      
      // Check password
      console.log("Checking password for user:", username);
      const validPassword = await bcrypt.compare(password, user.password);
      console.log("Password validation result:", validPassword);
      
      if (!validPassword) {
        console.log("Invalid password, returning invalid credentials");
        return res.status(400).json({ error: "Invalid credentials" });
      }
      
      // Check if user is blocked
      if (user.isBlocked) {
        console.log("User is blocked:", username);
        return res.status(403).json({ 
          error: "Account blocked",
          blockReason: user.blockReason || "Your account has been blocked. Please contact support for more information."
        });
      }
      
      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);
      
      // Generate token
      console.log("Generating token for user ID:", user.id);
      const token = generateToken(user.id, user.accessLevel);
      console.log("Token generated successfully");
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      console.log("Sending login response");
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Get current user profile
  app.get("/api/profile", authenticateToken, logUserAction, async (req, res) => {
    console.log("Profile endpoint called");
    try {
      const userId = (req as any).user.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });
  
  // Get specific user profile by ID (open to all users)
  app.get("/api/profile/:userId", optionalAuthenticateToken, logUserAction, async (req, res) => {
    console.log("Get specific user profile endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        // Try to find by username
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch profile rating from user record (already calculated with Bayesian algorithm)
      let profileRating = user.profileRating ? Number(user.profileRating) : null;
      let ratingCount = 0;
      try {
        const ratings = await storage.getProfileRatings(user.id);
        ratingCount = ratings.length;
      } catch (error) {
        console.error("Error fetching profile ratings:", error);
      }
      
      // Return user profile without sensitive information
      const { password: _, ...userWithoutPassword } = user;
      res.json({
        ...userWithoutPassword,
        profileRating,
        ratingCount
      });
    } catch (error) {
      console.error("Get specific user profile error:", error);
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });
  
  // Get user by ID (alias for /api/profile/:userId for backward compatibility with useUserProfile hook)
  app.get("/api/users/:userId", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user by ID endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      // Only accept UUIDs for this endpoint
      if (!isUuid) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }
      
      const user = await storage.getUser(targetUserId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch profile rating from user record (already calculated with Bayesian algorithm)
      let profileRating = user.profileRating ? Number(user.profileRating) : null;
      let ratingCount = 0;
      try {
        const ratings = await storage.getProfileRatings(user.id);
        ratingCount = ratings.length;
      } catch (error) {
        console.error("Error fetching profile ratings:", error);
      }
      
      // Return user profile without sensitive information
      const { password: _, ...userWithoutPassword } = user;
      res.json({
        ...userWithoutPassword,
        profileRating,
        ratingCount
      });
    } catch (error) {
      console.error("Get user by ID error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  
  // Update current user profile
  app.put("/api/profile", authenticateToken, async (req, res) => {
    console.log("Update profile endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { fullName, bio, avatarUrl } = req.body;
      
      // Only allow updating specific profile fields
      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  
  // Update user language preference
  app.put("/api/profile/language", authenticateToken, async (req, res) => {
    console.log("========================================");
    console.log("Update language preference endpoint called");
    console.log("Method:", req.method);
    console.log("Path:", req.path);
    console.log("Body:", req.body);
    console.log("========================================");
    try {
      const userId = (req as any).user.userId;
      const { language } = req.body;
      
      // Validate language code
      const supportedLanguages = ['en', 'ru'];
      if (!language || !supportedLanguages.includes(language)) {
        return res.status(400).json({ error: "Invalid language code. Supported languages: en, ru" });
      }
      
      // Update user language preference
      const updatedUser = await storage.updateUser(userId, { language });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json({ success: true, language: updatedUser.language, user: userWithoutPassword });
    } catch (error) {
      console.error("Update language preference error:", error);
      res.status(500).json({ error: "Failed to update language preference" });
    }
  });
  
  // Change user password
  app.put("/api/profile/password", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      
      // Get user with current password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user has a password (might be OAuth-only user)
      if (!user.password) {
        return res.status(400).json({ error: "Cannot change password for OAuth-only accounts" });
      }
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
  
  // Upload user avatar
  app.post("/api/profile/avatar", authenticateToken, (req, res, next) => {
    console.log("Avatar upload middleware - starting multer");
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'File upload failed: ' + err.message });
      }
      console.log("Multer processing complete, file:", req.file);
      next();
    });
  }, async (req, res) => {
    console.log("Upload avatar endpoint called");
    console.log("Request headers:", req.headers);
    console.log("Request file:", req.file);
    
    try {
      const userId = (req as any).user.userId;
      
      if (!req.file) {
        console.error("No file uploaded in request");
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      console.log("File uploaded successfully:", req.file.filename);
      
      // Get current user to check for old avatar
      const user = await storage.getUser(userId);
      if (!user) {
        console.error("User not found:", userId);
        return res.status(404).json({ error: "User not found" });
      }
      
      // Delete old avatar file if it exists
      if (user.avatarUrl) {
        const oldAvatarPath = path.join(process.cwd(), user.avatarUrl);
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
            console.log("Old avatar deleted:", oldAvatarPath);
          } catch (err) {
            console.error("Error deleting old avatar:", err);
            // Continue even if old file deletion fails
          }
        }
      }
      
      // Generate relative URL path for the avatar
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      console.log("Updating user with avatar URL:", avatarUrl);
      
      // Update user with new avatar URL
      const updatedUser = await storage.updateUser(userId, { avatarUrl });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      console.log("Avatar upload successful, returning user data");
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Upload avatar error:", error);
      
      // Clean up uploaded file if database update fails
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error cleaning up uploaded file:", err);
        }
      }
      
      return res.status(500).json({ error: "Failed to upload avatar" });
    }
  });
  
  // Delete user avatar
  app.delete("/api/profile/avatar", authenticateToken, async (req, res) => {
    console.log("Delete avatar endpoint called");
    try {
      const userId = (req as any).user.userId;
      
      // Get current user to check for avatar
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Delete avatar file if it exists
      if (user.avatarUrl) {
        const avatarPath = path.join(process.cwd(), user.avatarUrl);
        if (fs.existsSync(avatarPath)) {
          try {
            fs.unlinkSync(avatarPath);
            console.log("Avatar deleted:", avatarPath);
          } catch (err) {
            console.error("Error deleting avatar file:", err);
            // Continue even if file deletion fails
          }
        }
      }
      
      // Update user to remove avatar URL
      const updatedUser = await storage.updateUser(userId, { avatarUrl: null });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Delete avatar error:", error);
      res.status(500).json({ error: "Failed to delete avatar" });
    }
  });
  
  // Get user statistics (open to all users)
  app.get("/api/users/:userId/statistics", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user statistics endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const stats = await storage.getUserStatistics(user.id);
      
      // Return default stats if user doesn't have statistics yet
      res.json(stats || {
        totalBooksRead: 0,
        totalWordsRead: 0,
        totalLettersRead: 0
      });
    } catch (error) {
      console.error("Get user statistics error:", error);
      res.status(500).json({ error: "Failed to get user statistics" });
    }
  });
  
  // News endpoints
  // Get published news
  app.get("/api/news", async (req, res) => {
    console.log("Get published news endpoint called");
    try {
      const newsItems = await storage.getPublishedNews();
      res.json(newsItems);
    } catch (error) {
      console.error("Get published news error:", error);
      res.status(500).json({ error: "Failed to get published news" });
    }
  });
  
  // Get specific news item
  app.get("/api/news/:id", optionalAuthenticateToken, logUserAction, async (req, res) => {
    console.log("Get news by ID endpoint called");
    try {
      const { id } = req.params;
      const newsItem = await storage.getNews(id);
      
      if (!newsItem) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      // Increment view count (works for both authenticated and unauthenticated users)
      await storage.incrementNewsViewCount(id);
      
      res.json(newsItem);
    } catch (error) {
      console.error("Get news by ID error:", error);
      res.status(500).json({ error: "Failed to get news item" });
    }
  });
  
  // Get news comments
  app.get("/api/news/:id/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news comments endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId; // Optional userId
      const comments = await storage.getNewsComments(id, userId);
      console.log("Returning", comments.length, "comments for news ID:", id);
      res.json(comments);
    } catch (error) {
      console.error("Get news comments error:", error);
      res.status(500).json({ error: "Failed to get news comments" });
    }
  });
  
  // Post news comment
  app.post("/api/news/:id/comments", authenticateToken, async (req, res) => {
    console.log("Post news comment endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      const { content, attachments } = req.body;
      const userId = (req as any).user.userId;
      
      console.log("Received comment data - userId:", userId, "newsId:", id, "content:", content, "attachments:", attachments);
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      const comment = await storage.createNewsComment({
        userId,
        newsId: id,
        content,
        attachments
      });
      
      console.log("Created comment with ID:", comment.id);
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        console.log('[STREAM] Starting activity broadcast for news comment:', comment.id);
        console.log('[STREAM] Socket.IO instance available:', !!(app as any).io);
        
        const user = await storage.getUser(userId);
        const newsItem = await storage.getNews(id);
        
        console.log('[STREAM] User found:', !!user, user ? user.username : 'N/A');
        console.log('[STREAM] News found:', !!newsItem, newsItem ? newsItem.title : 'N/A');
        
        if (user && newsItem && (app as any).io) {
                console.log('[STREAM] Broadcasting news comment to stream:global room...');
          
          const io = (app as any).io;
          
          // Create activity data with snake_case field names (matching ActivityCard expectations)
          const activityData = {
            id: comment.id,
            type: 'comment',
            entityId: comment.id,
            userId: userId,
            newsId: id,
            metadata: {
              content_preview: content.substring(0, 200),
              author_id: userId,
              author_name: user.username || user.fullName || 'Anonymous',
              author_avatar: user.avatarUrl || null,
              news_id: newsItem.slug || id,
              news_title: newsItem.title,
              reactions: [] // Start with empty reactions array
            },
            createdAt: comment.createdAt
          };
          
          console.log('[STREAM] Activity data:', activityData);
          
          // Broadcast to global stream
          io.to('stream:global').emit('stream:new-activity', activityData);
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ News comment broadcast sent to stream:global');
          
          // Also broadcast counter update for the news item
          try {
            const updatedNews = await storage.getNews(id);
            if (updatedNews) {
              io.to('stream:global').emit('stream:counter-update', {
                entityId: id,
                entityType: 'news',
                commentCount: updatedNews.commentCount,
                reactionCount: updatedNews.reactionCount,
                viewCount: updatedNews.viewCount
              });
              console.log('[STREAM] News counter update broadcast sent');
            }
          } catch (counterError) {
            console.error('[STREAM] Failed to broadcast counter update:', counterError);
          }
        } else {
          console.warn('[STREAM] Missing requirements for broadcast:', {
            hasUser: !!user,
            hasNews: !!newsItem,
            hasIo: !!(app as any).io
          });
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast news comment activity:', streamError);
        // Don't fail the request if stream activity broadcast fails
      }
      
      res.json(comment);
    } catch (error) {
      console.error("Post news comment error:", error);
      res.status(500).json({ error: "Failed to post news comment" });
    }
  });
  
  // Get news reactions
  app.get("/api/news/:id/reactions", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news reactions endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      const reactions = await storage.getNewsReactions(id);
      console.log("Returning", reactions.length, "reactions for news ID:", id);
      res.json(reactions);
    } catch (error) {
      console.error("Get news reactions error:", error);
      res.status(500).json({ error: "Failed to get news reactions" });
    }
  });
  
  // Post news reaction
  app.post("/api/news/:id/reactions", authenticateToken, async (req, res) => {
    console.log("Post news reaction endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).user.userId;
      
      console.log("Received reaction data - userId:", userId, "newsId:", id, "emoji:", emoji);
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      const reaction = await storage.createNewsReaction({
        userId,
        newsId: id,
        emoji
      });
      
      console.log("Reaction result:", reaction);
      
      // Get all reactions for this news item and aggregate them
      const allReactions = await storage.getReactionsForNews(id);
      console.log("All reactions after toggle:", allReactions);
      
      // Group and aggregate reactions by emoji
      const groupedReactions: Record<string, any[]> = {};
      allReactions.forEach((r: any) => {
        const key = r.emoji;
        if (!groupedReactions[key]) {
          groupedReactions[key] = [];
        }
        groupedReactions[key].push(r);
      });
      
      // Aggregate reactions
      const aggregatedReactions: any[] = [];
      Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
        const userReacted = reactionList.some((r: any) => r.userId === userId);
        aggregatedReactions.push({
          emoji,
          count: reactionList.length,
          userReacted
        });
      });
      
      console.log("Aggregated reactions to return:", aggregatedReactions);
      
      // Broadcast reaction update and counter update for the news item
      try {
        if ((app as any).io) {
          const updatedNews = await storage.getNews(id);
          if (updatedNews) {
            const io = (app as any).io;
            
            // Broadcast reaction update with aggregated data
            io.to('stream:global').emit('stream:reaction-update', {
              entityId: id,
              entityType: 'news',
              reactions: aggregatedReactions,
              action: reaction.removed ? 'removed' : 'added'
            });
            console.log('[STREAM] News reaction update broadcast sent');
            
            // Broadcast counter update
            io.to('stream:global').emit('stream:counter-update', {
              entityId: id,
              entityType: 'news',
              commentCount: updatedNews.commentCount,
              reactionCount: updatedNews.reactionCount,
              viewCount: updatedNews.viewCount
            });
            console.log('[STREAM] News counter update broadcast sent after reaction');
          }
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast news updates:', streamError);
      }
      
      res.json({ action: reaction.removed ? 'removed' : 'added', reactions: aggregatedReactions });
    } catch (error) {
      console.error("Post news reaction error:", error);
      res.status(500).json({ error: "Failed to post news reaction" });
    }
  });
  
  // Get news comment reactions
  app.get("/api/news/comments/:commentId/reactions", authenticateToken, async (req, res) => {
    console.log("Get news comment reactions endpoint called for comment ID:", req.params.commentId);
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify that the comment exists
      const comment = await storage.getCommentById(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Get reactions for this comment
      const reactions = await storage.getReactions(commentId, 'comment');
      
      // Group and aggregate reactions by emoji
      const reactionsMap: Record<string, any[]> = {};
      
      // Group reactions by emoji
      const groupedReactions: Record<string, any[]> = {};
      reactions.forEach((reaction: any) => {
        const key = reaction.emoji;
        if (!groupedReactions[key]) {
          groupedReactions[key] = [];
        }
        groupedReactions[key].push(reaction);
      });
      
      // Aggregate reactions
      const aggregatedReactions: any[] = [];
      Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
        // Check if current user reacted with this emoji
        const userReacted = reactionList.some(reaction => reaction.userId === userId);
        
        aggregatedReactions.push({
          emoji,
          count: reactionList.length,
          userReacted
        });
      });
      
      res.json(aggregatedReactions);
    } catch (error) {
      console.error("Get news comment reactions error:", error);
      res.status(500).json({ error: "Failed to get news comment reactions" });
    }
  });
  
  // Post news comment reaction
  app.post("/api/news/comments/:commentId/reactions", authenticateToken, async (req, res) => {
    console.log("Post news comment reaction endpoint called for comment ID:", req.params.commentId);
    try {
      const { commentId } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).user.userId;
      
      console.log("Received comment reaction data - userId:", userId, "commentId:", commentId, "emoji:", emoji);
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Verify that the comment exists
      const comment = await storage.getCommentById(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Check if user already reacted with this emoji
      // Using createReaction which acts as a toggle
      const reactionResult = await storage.createReaction({
        userId,
        commentId,
        emoji
      });
      
      let action = 'added';
      if (reactionResult.removed) {
        action = 'removed';
      }
      
      // Get all reactions for this comment
      const updatedReactions = await storage.getReactions(commentId, 'comment');
      
      // Group and aggregate reactions by emoji
      const groupedReactions: Record<string, any[]> = {};
      updatedReactions.forEach((reaction: any) => {
        const key = reaction.emoji;
        if (!groupedReactions[key]) {
          groupedReactions[key] = [];
        }
        groupedReactions[key].push(reaction);
      });
      
      // Aggregate reactions
      const aggregatedReactions: any[] = [];
      Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
        const userReacted = reactionList.some((reaction: any) => reaction.userId === userId);
        
        aggregatedReactions.push({
          emoji,
          count: reactionList.length,
          userReacted
        });
      });
      
      console.log(action === 'added' ? "Added" : "Removed", "reaction to comment with ID:", commentId);
      
      // Broadcast reaction update to activity stream via WebSocket
      try {
        if ((app as any).io) {
          console.log('[STREAM] Broadcasting reaction update for comment:', commentId);
          const io = (app as any).io;
          
          // Broadcast reaction update with aggregated data
          io.to('stream:global').emit('stream:reaction-update', {
            commentId,
            entityId: commentId,
            entityType: 'comment',
            reactions: aggregatedReactions,
            action
          });
          
          console.log('[STREAM] Reaction update broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast reaction update:', streamError);
      }
      
      res.json({ action, reactions: aggregatedReactions });
    } catch (error) {
      console.error("Post news comment reaction error:", error);
      res.status(500).json({ error: "Failed to post news comment reaction" });
    }
  });
  
  // Admin: Create news
  app.post("/api/admin/news", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Create news endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { title, titleEn, slug, content, contentEn, published } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      
      const newsData = {
        title,
        titleEn: titleEn || undefined,
        slug: slug || undefined,
        content,
        contentEn: contentEn || undefined,
        authorId: userId,
        published: published || false,
        publishedAt: published ? new Date() : null
      };
      
      const newsItem = await storage.createNews(newsData);
      
      // Create activity feed entry and broadcast via WebSocket only if published
      if (published) {
        try {
          console.log('[STREAM DEBUG] Starting activity broadcast for news:', newsItem.id);
          console.log('[STREAM DEBUG] Socket.IO instance available:', !!(app as any).io);
          
          const user = await storage.getUser(userId);
          
          console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
          
          if (user && (app as any).io) {
            console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
            
            const io = (app as any).io;
            
            // Check room status
            const globalRoom = io.sockets.adapter.rooms.get('stream:global');
            console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
            if (globalRoom && globalRoom.size > 0) {
              console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
            }
            
            // Create activity data with snake_case field names
            const activityData = {
              id: newsItem.id,
              type: 'news',
              entityId: newsItem.id,
              userId: userId,
              metadata: {
                title: title,
                content_preview: content.substring(0, 200),
                author_id: userId,
                author_name: user.username || user.fullName || 'Anonymous',
                author_avatar: user.avatarUrl || null,
                view_count: 0,
                comment_count: 0,
                reaction_count: 0
              },
              createdAt: newsItem.createdAt
            };
            
            console.log('[STREAM DEBUG] Activity data:', activityData);
            
            // Broadcast to global stream
            io.to('stream:global').emit('stream:new-activity', activityData);
            console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✅ Direct broadcast sent to stream:global');
          } else {
            console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
              hasUser: !!user,
              hasIo: !!(app as any).io
            });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast news activity:', streamError);
          // Don't fail the request if stream activity broadcast fails
        }
      }
      
      res.status(201).json(newsItem);
    } catch (error) {
      console.error("Create news error:", error);
      res.status(500).json({ error: "Failed to create news" });
    }
  });
  
  // Admin: Update news
  app.put("/api/admin/news/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update news endpoint called");
    try {
      const { id } = req.params;
      const { title, titleEn, slug, content, contentEn, published } = req.body;
      
      const existingNews = await storage.getNews(id);
      if (!existingNews) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      const newsData = {
        title: title !== undefined ? title : existingNews.title,
        titleEn: titleEn !== undefined ? (titleEn || undefined) : existingNews.titleEn,
        slug: slug !== undefined ? (slug || undefined) : existingNews.slug,
        content: content !== undefined ? content : existingNews.content,
        contentEn: contentEn !== undefined ? (contentEn || undefined) : existingNews.contentEn,
        published: published !== undefined ? published : existingNews.published,
        publishedAt: (() => {
          const isPublishing = published !== undefined ? published : existingNews.published;
          
          if (isPublishing) {
            // If transitioning to published, set new timestamp
            // If already published, preserve existing timestamp (convert string to Date)
            if (published === true && !existingNews.published) {
              return new Date(); // First time publishing
            } else if (existingNews.publishedAt) {
              return new Date(existingNews.publishedAt); // Convert string to Date
            } else {
              return new Date(); // Fallback if somehow publishedAt is missing
            }
          } else {
            return null; // Unpublished state
          }
        })()
      };
      
      const updatedNews = await storage.updateNews(id, newsData);
      
      // Create activity feed entry and broadcast via WebSocket if newly published
      if (published && !existingNews.published) {
        try {
          console.log('[STREAM DEBUG] Starting activity broadcast for published news:', updatedNews.id);
          console.log('[STREAM DEBUG] Socket.IO instance available:', !!(app as any).io);
          
          const user = await storage.getUser((req as any).user.userId);
          
          console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
          
          if (user && (app as any).io) {
            console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
            
            const io = (app as any).io;
            
            // Check room status
            const globalRoom = io.sockets.adapter.rooms.get('stream:global');
            console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
            if (globalRoom && globalRoom.size > 0) {
              console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
            }
            
            const newsContent = content !== undefined ? content : existingNews.content;
            const newsTitle = title !== undefined ? title : existingNews.title;
            
            // Create activity data with snake_case field names
            const activityData = {
              id: updatedNews.id,
              type: 'news',
              entityId: updatedNews.id,
              userId: user.id,
              metadata: {
                title: newsTitle,
                content_preview: newsContent.substring(0, 200),
                author_id: user.id,
                author_name: user.username || user.fullName || 'Anonymous',
                author_avatar: user.avatarUrl || null,
                view_count: 0,
                comment_count: 0,
                reaction_count: 0
              },
              createdAt: updatedNews.publishedAt || updatedNews.createdAt
            };
            
            console.log('[STREAM DEBUG] Activity data:', activityData);
            
            // Broadcast to global stream
            io.to('stream:global').emit('stream:new-activity', activityData);
            console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✅ Direct broadcast sent to stream:global');
          } else {
            console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
              hasUser: !!user,
              hasIo: !!(app as any).io
            });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast news activity:', streamError);
          // Don't fail the request if stream activity broadcast fails
        }
      }
      
      res.json(updatedNews);
    } catch (error) {
      console.error("Update news error:", error);
      res.status(500).json({ error: "Failed to update news" });
    }
  });
  
  // Admin: Delete news
  app.delete("/api/admin/news/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete news endpoint called");
    try {
      const { id } = req.params;
      
      const existingNews = await storage.getNews(id);
      if (!existingNews) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      await storage.deleteNews(id);
      
      // Broadcast deletion via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          console.log('[STREAM] Broadcasting news deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete news error:", error);
      res.status(500).json({ error: "Failed to delete news" });
    }
  });
  
  // Admin: Get all news (for admin panel)
  app.get("/api/admin/news", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all news for admin endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      // Get all news items (published and unpublished)
      const allNews = await storage.getAllNews();
      const total = allNews.length;
      const paginatedNews = allNews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedNews,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get all news for admin error:", error);
      res.status(500).json({ error: "Failed to get news items" });
    }
  });
  
  // Admin: Update user access level
  app.put("/api/admin/users/:userId/access-level", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update user access level endpoint called");
    try {
      const { userId } = req.params;
      const { accessLevel, isBlocked, blockReason } = req.body;
      
      if (!accessLevel || !['admin', 'moder', 'user'].includes(accessLevel)) {
        return res.status(400).json({ error: "Valid access level is required (admin, moder, or user)" });
      }
      
      const updatedUser = await storage.updateAccessLevel(userId, accessLevel, isBlocked, blockReason);
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user access level error:", error);
      res.status(500).json({ error: "Failed to update user access level" });
    }
  });
  
  // Admin: Update any comment
  app.put("/api/admin/comments/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin update comment endpoint called");
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Admins can update any comment
      const updatedComment = await storage.updateComment(id, { content });
      
      res.json(updatedComment);
    } catch (error) {
      console.error("Admin update comment error:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });
  
  // Admin: Update any review
  app.put("/api/admin/reviews/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin update review endpoint called");
    try {
      const { id } = req.params;
      const { content, rating } = req.body;
      
      if (!content && rating === undefined) {
        return res.status(400).json({ error: "Either content or rating is required" });
      }
      
      // Admins can update any review
      const updatedReview = await storage.updateReview(id, { content, rating });
      
      res.json(updatedReview);
    } catch (error) {
      console.error("Admin update review error:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });
  
  // Admin: Get pending comments
  app.get("/api/admin/comments/pending", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get pending comments endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const allComments = await storage.getAllComments();
      const total = allComments.length;
      const paginatedComments = allComments
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedComments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get pending comments error:", error);
      res.status(500).json({ error: "Failed to get pending comments" });
    }
  });
  
  // Admin: Get pending reviews
  app.get("/api/admin/reviews/pending", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get pending reviews endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const allReviews = await storage.getAllReviews();
      const total = allReviews.length;
      const paginatedReviews = allReviews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedReviews,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get pending reviews error:", error);
      res.status(500).json({ error: "Failed to get pending reviews" });
    }
  });
  
  // Admin: Get recent activity
  app.get("/api/admin/recent-activity", authenticateToken, requireAdminOrModerator, async (req, res) => {
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
  
  // Shelf endpoints
  // Get all shelves for the current user
  app.get("/api/shelves", authenticateToken, async (req, res) => {
    console.log("Get shelves endpoint called");
    try {
      const userId = (req as any).user.userId;
      const shelves = await storage.getShelves(userId);
      res.json(shelves);
    } catch (error) {
      console.error("Get shelves error:", error);
      res.status(500).json({ error: "Failed to get shelves" });
    }
  });
  
  // Get shelves with books for the current user (optimized)
  app.get("/api/shelves/with-books", authenticateToken, async (req, res) => {
    console.log("Get shelves with books endpoint called");
    try {
      const userId = (req as any).user.userId;
      const shelvesWithBooks = await storage.getShelvesWithBooks(userId);
      res.json(shelvesWithBooks);
    } catch (error) {
      console.error("Get shelves with books error:", error);
      res.status(500).json({ error: "Failed to get shelves with books" });
    }
  });
  
  // Get shelves for a specific user with books (for profile viewing) - open to all users
  app.get("/api/users/:userId/shelves/with-books", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user shelves with books endpoint called");
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get the requesting user ID if authenticated
      const requestingUserId = (req as any).user?.userId || null;
      
      const shelvesWithBooks = await storage.getShelvesWithBooks(userId);
      res.json(shelvesWithBooks);
    } catch (error) {
      console.error("Get user shelves with books error:", error);
      res.status(500).json({ error: "Failed to get user shelves with books" });
    }
  });
  
  // Get shelves for a specific user (for profile viewing) - open to all users
  app.get("/api/users/:userId/shelves", optionalAuthenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const shelves = await storage.getShelves(userId);
      res.json(shelves);
    } catch (error) {
      console.error("Get user shelves error:", error);
      res.status(500).json({ error: "Failed to get user shelves" });
    }
  });
  
  // Get shelves for a specific user (alternative endpoint) - open to all users
  app.get("/api/shelves/user/:userId", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user shelves endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const shelves = await storage.getShelves(user.id);
      res.json(shelves);
    } catch (error) {
      console.error("Get user shelves error:", error);
      res.status(500).json({ error: "Failed to get user shelves" });
    }
  });
  
  // Get books by IDs - open to all users
  app.post("/api/books/by-ids", optionalAuthenticateToken, async (req, res) => {
    console.log("Get books by IDs endpoint called");
    try {
      const { bookIds } = req.body;
      if (!bookIds || !Array.isArray(bookIds)) {
        return res.status(400).json({ error: "bookIds array is required" });
      }
      
      // Get books without reading progress first
      let books = await storage.getBooksByIds(bookIds);
      
      // If user is authenticated, add reading progress data
      const userId = (req as any).user?.userId;
      if (userId) {
        try {
          // Get reading progress for all these books for this user
          const readingProgressRecords = await db.select({
            bookId: readingProgress.bookId,
            percentage: readingProgress.percentage,
            currentPage: readingProgress.currentPage,
            totalPages: readingProgress.totalPages,
            lastReadAt: readingProgress.lastReadAt
          })
          .from(readingProgress)
          .where(and(
            eq(readingProgress.userId, userId),
            inArray(readingProgress.bookId, bookIds)
          ));
          
          // Create a map for quick lookup
          const readingProgressMap = new Map(readingProgressRecords.map(record => [
            record.bookId, 
            {
              percentage: record.percentage ? parseFloat(record.percentage.toString()) : 0,
              currentPage: record.currentPage || 0,
              totalPages: record.totalPages || 0,
              lastReadAt: record.lastReadAt
            }
          ]));
          
          // Add reading progress to each book
          books = books.map(book => ({
            ...book,
            readingProgress: readingProgressMap.get(book.id) || null
          }));
          
          console.log(`Added reading progress for ${readingProgressMap.size} books`);
        } catch (progressError) {
          console.error('Error fetching reading progress for books by IDs:', progressError);
          // Continue without reading progress if there's an error
        }
      }
      
      res.json(books);
    } catch (error) {
      console.error("Get books by IDs error:", error);
      res.status(500).json({ error: "Failed to get books" });
    }
  });

  // Get popular books (sorted by rating)
  app.get("/api/books/popular", optionalAuthenticateToken, async (req, res) => {
    console.log("Get popular books endpoint called");
    try {
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const books = await storage.getPopularBooks(sortBy);
      res.json(books);
    } catch (error) {
      console.error("Get popular books error:", error);
      res.status(500).json({ error: "Failed to get popular books" });
    }
  });

  // Get books by genre
  app.get("/api/books/genre/:genre", optionalAuthenticateToken, async (req, res) => {
    console.log("Get books by genre endpoint called");
    try {
      const { genre } = req.params;
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const books = await storage.getBooksByGenre(genre, sortBy);
      res.json(books);
    } catch (error) {
      console.error("Get books by genre error:", error);
      res.status(500).json({ error: "Failed to get books by genre" });
    }
  });

  // Get recently reviewed books
  app.get("/api/books/recently-reviewed", optionalAuthenticateToken, async (req, res) => {
    console.log("Get recently reviewed books endpoint called");
    try {
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const books = await storage.getRecentlyReviewedBooks(sortBy);
      res.json(books);
    } catch (error) {
      console.error("Get recently reviewed books error:", error);
      res.status(500).json({ error: "Failed to get recently reviewed books" });
    }
  });

  // Get user's currently reading books
  app.get("/api/books/currently-reading", authenticateToken, async (req, res) => {
    console.log("Get user's currently reading books endpoint called");
    try {
      const userId = (req as any).user.userId;
      const books = await storage.getCurrentUserBooks(userId);
      res.json(books);
    } catch (error) {
      console.error("Get user's currently reading books error:", error);
      res.status(500).json({ error: "Failed to get user's currently reading books" });
    }
  });

  // Get new releases
  app.get("/api/books/new-releases", optionalAuthenticateToken, async (req, res) => {
    console.log("Get new releases endpoint called");
    try {
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const books = await storage.getNewReleases(sortBy);
      console.log("New releases fetched successfully, count:", books.length);
      res.json(books);
    } catch (error) {
      console.error("Get new releases error:", error);
      res.status(500).json({ error: "Failed to get new releases" });
    }
  });

  // Search books
  app.get("/api/books/search", optionalAuthenticateToken, async (req, res) => {
    console.log("Search books endpoint called");
    try {
      const query = req.query.query ? String(req.query.query) : '';
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const sortDirection = req.query.sortDirection === 'asc' ? 'asc' : 'desc'; // Default to 'desc'
      console.log("Search query:", query, "sortBy:", sortBy, "sortDirection:", sortDirection);
      
      let books = await storage.searchBooks(query, sortBy, sortDirection);
      
      // For books without ratings, calculate them
      for (const book of books) {
        if (book.rating === null || book.rating === undefined) {
          await storage.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      books = await storage.searchBooks(query, sortBy, sortDirection);
      
      // Log search action and broadcast via WebSocket (only if query is not empty and user is authenticated)
      const userId = (req as any).user?.userId;
      if (query && query.trim() && userId && process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
        try {
          console.log('[Search] Creating user action for search event');
          const action = await storage.createUserAction({
            userId: userId,
            actionType: 'search_books',
            targetType: null,
            targetId: null,
            metadata: { 
              search_query: query.substring(0, 100),
              results_count: books.length
            }
          });
          console.log('[Search] User action created:', action?.id);
          
          // Broadcast search event via WebSocket
          if ((req.app as any).io && action) {
            const io = (req.app as any).io;
            console.log('[Search] Broadcasting search event');
            
            // Get user info for broadcast
            const user = await storage.getUser(userId);
            
            const eventData = {
              id: action.id,
              type: 'user_action',
              action_type: action.actionType,
              entityId: action.id,
              userId: userId,
              user: {
                id: userId,
                username: user?.username || 'Unknown',
                avatar_url: user?.avatarUrl || null
              },
              target: null,
              metadata: action.metadata,
              createdAt: action.createdAt,
              timestamp: action.createdAt.toISOString()
            };
            
            // Broadcast to last-actions room
            io.to('stream:last-actions').emit('stream:last-action', eventData);
            console.log('[Search] ✅ Search event broadcasted');
          }
        } catch (actionError) {
          console.error('[Search] Failed to log user action or broadcast event:', actionError);
          // Don't fail search if action logging fails
        }
      }
      
      res.json(books);
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });

  // Track book view when user visits book detail page
  app.post("/api/books/:id/track-view", optionalAuthenticateToken, async (req, res) => {
    console.log("Track book view endpoint called");
    try {
      const { id } = req.params;
      const { viewType } = req.body;
      const userId = (req as any).user?.userId;
      
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      if (!viewType || !['card_view', 'reader_open'].includes(viewType)) {
        return res.status(400).json({ error: "Valid viewType is required (card_view or reader_open)" });
      }
      
      await storage.incrementBookViewCount(id, viewType);
      
      // Log navigate_reader action if viewType is reader_open (only for authenticated users)
      if (viewType === 'reader_open' && userId && process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
        try {
          const user = await storage.getUser(userId);
          const book = await storage.getBook(id);
          
          if (user && book) {
            const actionData = {
              userId,
              actionType: 'navigate_reader',
              targetType: 'book',
              targetId: id,
              metadata: {
                book_title: book.title
              }
            };
            
            const action = await storage.createUserAction(actionData);
            
            // Broadcast to WebSocket
            const io = (app as any).io;
            if (io && action) {
              const broadcastData = {
                id: action.id,
                type: 'user_action',
                action_type: action.actionType,
                user: {
                  id: user.id,
                  username: user.username,
                  avatar_url: user.avatarUrl
                },
                target: {
                  type: 'book',
                  id: id,
                  title: book.title
                },
                metadata: action.metadata,
                timestamp: action.createdAt.toISOString()
              };
              
              io.to('stream:last-actions').emit('stream:last-action', broadcastData);
            }
          }
        } catch (actionLogError) {
          console.error('[Action Logging] Failed to log reader action:', actionLogError);
        }
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error tracking book view:", error);
      res.status(500).json({ error: "Failed to track book view" });
    }
  });
  
  // Get book view statistics
  app.get("/api/books/:id/stats", authenticateToken, async (req, res) => {
    console.log("Get book stats endpoint called");
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      const stats = await storage.getBookViewStats(id);
      
      res.json(stats);
    } catch (error) {
      console.error("Error getting book stats:", error);
      res.status(500).json({ error: "Failed to get book stats" });
    }
  });

  // ========== Reading Progress & Settings Routes ==========
  
  // Get reading progress for a book
  app.get("/api/books/:bookId/reading-progress", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      
      // Return empty progress object if no progress found (not 404)
      // This is expected for books that haven't been read yet
      if (!progress) {
        return res.json({
          currentPage: 1,
          totalPages: 1,
          percentage: 0,
          chapterIndex: 0,
        });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error getting reading progress:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });
  
  // Get reading progress for a specific user and book (public endpoint for comments)
  app.get("/api/books/:bookId/reading-progress/:userId", optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId, userId } = req.params;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      
      // Return empty progress object if no progress found
      if (!progress) {
        return res.json({
          currentPage: 1,
          totalPages: 1,
          percentage: 0,
          chapterIndex: 0,
          lastReadAt: null
        });
      }
      
      res.json({
        currentPage: progress.currentPage,
        totalPages: progress.totalPages,
        percentage: progress.percentage,
        chapterIndex: progress.chapterIndex,
        lastReadAt: progress.lastReadAt
      });
    } catch (error) {
      console.error("Error getting user reading progress:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });
  
  // Update reading progress for a book (upsert)
  app.put("/api/books/:bookId/reading-progress", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { currentPage, totalPages, percentage, chapterIndex } = req.body;
      
      const progress = await storage.updateReadingProgress(userId, bookId, {
        currentPage,
        totalPages,
        percentage,
        chapterIndex,
        lastReadAt: new Date(),
      });
      
      res.json(progress);
    } catch (error) {
      console.error("Error updating reading progress:", error);
      res.status(500).json({ error: "Failed to update reading progress" });
    }
  });
  
  // Get reader settings for a book
  app.get("/api/books/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      
      if (!progress || !progress.settings) {
        return res.status(404).json({ error: "No reader settings found" });
      }
      
      res.json(progress.settings);
    } catch (error) {
      console.error("Error getting reader settings:", error);
      res.status(500).json({ error: "Failed to get reader settings" });
    }
  });
  
  // Update reader settings for a book
  app.put("/api/books/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const settings = req.body;
      
      const progress = await storage.updateReadingProgress(userId, bookId, {
        settings,
        lastReadAt: new Date(),
      });
      
      res.json(progress.settings || settings);
    } catch (error) {
      console.error("Error updating reader settings:", error);
      res.status(500).json({ error: "Failed to update reader settings" });
    }
  });
  
  // ========== Bookmarks Routes ==========
  
  // Get all bookmarks for a book
  app.get("/api/books/:bookId/bookmarks", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const bookmarksList = await storage.getBookmarks(userId, bookId);
      
      res.json(bookmarksList);
    } catch (error) {
      console.error("Error getting bookmarks:", error);
      res.status(500).json({ error: "Failed to get bookmarks" });
    }
  });
  
  // Create a bookmark
  app.post("/api/books/:bookId/bookmarks", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { title, chapterIndex, percentage, selectedText, pageInChapter, collectionId } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Bookmark title is required" });
      }
      
      // Get book title for default collection name
      const book = await db.select({ title: books.title }).from(books).where(eq(books.id, bookId));
      if (book.length === 0) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      const bookTitle = book[0].title;
      
      // Create the bookmark
      const bookmark = await storage.createBookmark({
        userId,
        bookId,
        title,
        chapterIndex,
        percentage,
        selectedText,
        pageInChapter,
      });
      
      // Add to collection (either specified or default)
      let targetCollectionId = collectionId;
      
      if (!targetCollectionId) {
        // Try to get existing default collection
        let defaultCollection = await storage.getDefaultBookmarkCollection(userId, bookId);
        
        // If no default collection exists, create one
        if (!defaultCollection) {
          defaultCollection = await storage.createDefaultBookmarkCollection(userId, bookId, bookTitle);
        }
        
        targetCollectionId = defaultCollection.id;
      }
      
      // Add bookmark to the collection
      await storage.addBookmarkToCollection(targetCollectionId, bookmark.id, userId);
      
      res.status(201).json({
        ...bookmark,
        collectionId: targetCollectionId
      });
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });
  
  // Delete a bookmark
  app.delete("/api/bookmarks/:bookmarkId", authenticateToken, async (req, res) => {
    try {
      const { bookmarkId } = req.params;
      const userId = (req as any).user.userId;
      
      // Note: In a production app, we should verify ownership before deleting
      // For now, we trust the storage layer handles this correctly
      await storage.deleteBookmark(bookmarkId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Bookmark Collections Endpoints
  
  // Create a bookmark collection
  app.post("/api/bookmark-collections", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { name, description, color, isPublic, bookId, bookIds } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Collection name is required" });
      }
      
      const collection = await storage.createBookmarkCollection({
        userId,
        name,
        description: description || '',
        color: color || '#3b82f6',
        isPublic: isPublic || false,
        bookId: bookId || null, // Include bookId if provided (deprecated)
        bookIds: bookIds || [] // Include bookIds array if provided
      });
      
      res.status(201).json(collection);
    } catch (error) {
      console.error("Error creating bookmark collection:", error);
      res.status(500).json({ error: "Failed to create bookmark collection" });
    }
  });

  // Get all bookmark collections for user (including public collections from others)
  app.get("/api/bookmark-collections", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      
      // Use the storage method which properly calculates book counts
      const collections = await storage.getBookmarkCollections(userId);
      
      res.json(collections);
    } catch (error) {
      console.error("Error getting bookmark collections:", error);
      res.status(500).json({ error: "Failed to get bookmark collections" });
    }
  });

  // Get a specific bookmark collection
  app.get("/api/bookmark-collections/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      // Use the storage method which properly gets associated books
      const collection = await storage.getBookmarkCollection(id, userId);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Track collection view (increment view count)
      try {
        await db.update(bookmarkCollections)
          .set({ viewCount: sql`${bookmarkCollections.viewCount} + 1` })
          .where(eq(bookmarkCollections.id, id));
      } catch (error) {
        console.error("Error tracking collection view:", error);
      }
      
      res.json(collection);
    } catch (error) {
      console.error("Error getting bookmark collection:", error);
      res.status(500).json({ error: "Failed to get bookmark collection" });
    }
  });

  // Update a bookmark collection
  app.put("/api/bookmark-collections/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const updateData = req.body;
      
      const collection = await storage.updateBookmarkCollection(id, userId, updateData);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      res.json(collection);
    } catch (error) {
      console.error("Error updating bookmark collection:", error);
      res.status(500).json({ error: "Failed to update bookmark collection" });
    }
  });

  // Delete a bookmark collection
  app.delete("/api/bookmark-collections/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      const success = await storage.deleteBookmarkCollection(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark collection:", error);
      res.status(500).json({ error: "Failed to delete bookmark collection" });
    }
  });

  // Add bookmark to collection
  app.post("/api/bookmark-collections/:collectionId/bookmarks/:bookmarkId", authenticateToken, async (req, res) => {
    try {
      const { collectionId, bookmarkId } = req.params;
      const userId = (req as any).user.userId;
      
      const result = await storage.addBookmarkToCollection(collectionId, bookmarkId, userId);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding bookmark to collection:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to add bookmark to collection" });
    }
  });

  // Remove bookmark from collection
  app.delete("/api/bookmark-collections/:collectionId/bookmarks/:bookmarkId", authenticateToken, async (req, res) => {
    try {
      const { collectionId, bookmarkId } = req.params;
      const userId = (req as any).user.userId;
      
      const success = await storage.removeBookmarkFromCollection(collectionId, bookmarkId, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Collection or bookmark not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error removing bookmark from collection:", error);
      res.status(500).json({ error: "Failed to remove bookmark from collection" });
    }
  });

  // Get collections for a specific bookmark
  app.get("/api/bookmarks/:bookmarkId/collections", authenticateToken, async (req, res) => {
    try {
      const { bookmarkId } = req.params;
      const userId = (req as any).user.userId;
      
      const collections = await storage.getBookmarkCollectionsForBookmark(bookmarkId, userId);
      res.json(collections);
    } catch (error) {
      console.error("Error getting collections for bookmark:", error);
      res.status(500).json({ error: "Failed to get collections for bookmark" });
    }
  });

  // Clone a bookmark collection
  app.post("/api/bookmark-collections/:id/clone", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const { name, description } = req.body;
      
      // Get the original collection (we'll check if it's public or owned by user)
      const originalCollection = await db.select().from(bookmarkCollections)
        .where(eq(bookmarkCollections.id, id));
      
      if (originalCollection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      const collectionToClone = originalCollection[0];
      
      // Check if user can clone this collection (own collection or public collection)
      if (collectionToClone.userId !== userId && !collectionToClone.isPublic) {
        return res.status(403).json({ error: "Cannot clone private collection" });
      }
      
      // Create new collection with user's ID
      const newCollectionData = {
        userId,
        name: name || `Копия ${collectionToClone.name}`,
        description: description || collectionToClone.description || '',
        color: collectionToClone.color,
        isPublic: false // Cloned collections are private by default
      };
      
      const newCollection = await storage.createBookmarkCollection(newCollectionData);
      
      // Copy all bookmarks from original collection to new collection
      const originalItems = await db.select().from(bookmarkCollectionItems)
        .where(eq(bookmarkCollectionItems.collectionId, id));
      
      // Add each bookmark to the new collection
      for (const item of originalItems) {
        try {
          await db.insert(bookmarkCollectionItems).values({
            collectionId: newCollection.id,
            bookmarkId: item.bookmarkId
          });
        } catch (error) {
          // Skip if bookmark already exists in collection (due to unique constraint)
          console.log(`Bookmark ${item.bookmarkId} already exists in collection`);
        }
      }
      
      // Return the new collection with updated bookmark count
      const updatedCollection = {
        ...newCollection,
        bookmarkCount: originalItems.length
      };
      
      res.status(201).json(updatedCollection);
    } catch (error) {
      console.error("Error cloning bookmark collection:", error);
      res.status(500).json({ error: "Failed to clone bookmark collection" });
    }
  });
  
  // Get bookmarks in a specific collection for the current book
  app.get("/api/bookmark-collections/:collectionId/bookmarks/:bookId", authenticateToken, async (req, res) => {
    try {
      const { collectionId, bookId } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify the collection belongs to the user
      const collection = await db.select()
        .from(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.id, collectionId),
          eq(bookmarkCollections.userId, userId)
        ));
      
      if (collection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Get bookmarks in this collection for the specified book
      const bookmarksInCollection = await db.select({
        id: bookmarks.id,
        title: bookmarks.title,
        chapterIndex: bookmarks.chapterIndex,
        percentage: bookmarks.percentage,
        selectedText: bookmarks.selectedText,
        pageInChapter: bookmarks.pageInChapter,
        createdAt: bookmarks.createdAt
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .where(and(
        eq(bookmarkCollectionItems.collectionId, collectionId),
        eq(bookmarks.bookId, bookId),
        eq(bookmarks.userId, userId)
      ))
      .orderBy(asc(bookmarks.chapterIndex), asc(bookmarks.percentage));
      
      res.json(bookmarksInCollection);
    } catch (error) {
      console.error("Error getting bookmarks for collection:", error);
      res.status(500).json({ error: "Failed to get bookmarks for collection" });
    }
  });
  
  // Get collections that contain bookmarks for a specific book
  app.get("/api/bookmark-collections/book/:bookId", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      console.log('[API] Getting collections for book:', bookId);
      console.log('[API] Requesting user ID:', userId);
      
      // Debug: Check if this is the collection owner
      const collectionOwnerId = '605db90f-4691-4281-991e-b2e248e33915'; // From database check
      console.log('[API] Collection owner ID:', collectionOwnerId);
      console.log('[API] Is same user?', userId === collectionOwnerId);
      console.log('[API] Is different user?', userId !== collectionOwnerId);
      
      // Get collections that either:
      // 1. Contain bookmarks for this book (user's own collections)
      // 2. Are specifically linked to this book via book_id (user's own collections)
      // 3. Are public collections from other users that contain this book
      
      // First get collections with bookmarks for this book (user's own)
      console.log('[API] Query 1: Collections with bookmarks for this book');
      const collectionsWithBookmarks = await db.selectDistinct({
        id: bookmarkCollections.id,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        bookId: bookmarkCollections.bookId, // Include bookId in response
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
        ownerId: users.id,
        ownerUsername: users.username,
        ownerFullName: users.fullName,
        ownerAvatarUrl: users.avatarUrl,
        ownerProfileRating: users.profileRating
      })
      .from(bookmarkCollections)
      .innerJoin(bookmarkCollectionItems, eq(bookmarkCollections.id, bookmarkCollectionItems.collectionId))
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .leftJoin(users, eq(bookmarkCollections.userId, users.id))
      .where(and(
        eq(bookmarks.bookId, bookId),
        eq(bookmarkCollections.userId, userId)
      ));
      
      console.log('[API] Query 1 result count:', collectionsWithBookmarks.length);
      
      // Then get collections specifically linked to this book (user's own)
      console.log('[API] Query 2: Collections specifically linked to this book');
      const collectionsForBook = await db.select({
        id: bookmarkCollections.id,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        bookId: bookmarkCollections.bookId, // Include bookId in response
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
        ownerId: users.id,
        ownerUsername: users.username,
        ownerFullName: users.fullName,
        ownerAvatarUrl: users.avatarUrl,
        ownerProfileRating: users.profileRating
      })
      .from(bookmarkCollections)
      .leftJoin(users, eq(bookmarkCollections.userId, users.id))
      .where(and(
        eq(bookmarkCollections.bookId, bookId),
        eq(bookmarkCollections.userId, userId)
      ));
      
      console.log('[API] Query 2 result count:', collectionsForBook.length);
      
      // Finally, get public collections from other users that contain this book
      // This includes collections that are associated with the book via collectionBooks table
      // Also include user's own collections that are associated via collectionBooks table
      console.log('[API] Query 3: Public collections from other users (and user\'s own via collectionBooks)');
      const publicCollectionsFromOthers = await db.selectDistinct({
        id: bookmarkCollections.id,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        bookId: bookmarkCollections.bookId,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
        ownerId: users.id,
        ownerUsername: users.username,
        ownerFullName: users.fullName,
        ownerAvatarUrl: users.avatarUrl,
        ownerProfileRating: users.profileRating
      })
      .from(bookmarkCollections)
      .innerJoin(collectionBooks, eq(bookmarkCollections.id, collectionBooks.collectionId))
      .leftJoin(users, eq(bookmarkCollections.userId, users.id))
      .where(and(
        eq(collectionBooks.bookId, bookId),
        eq(bookmarkCollections.isPublic, true)
      ));
      
      console.log('[API] Query 3 result count:', publicCollectionsFromOthers.length);
      if (publicCollectionsFromOthers.length > 0) {
        console.log('[API] Query 3 results:');
        publicCollectionsFromOthers.forEach((col, i) => {
          console.log(`  ${i + 1}. ${col.name} (ID: ${col.id}) - Owner: ${col.ownerUsername}`);
        });
      }
      
      // Combine and deduplicate results
      const allCollections = [...collectionsWithBookmarks, ...collectionsForBook, ...publicCollectionsFromOthers];
      const uniqueCollections = Array.from(
        new Map(allCollections.map(item => [item.id, item])).values()
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Add bookmark count for each collection
      const collectionsWithCounts = await Promise.all(uniqueCollections.map(async (collection) => {
        const itemCount = await db.select({ count: sql`count(*)` })
          .from(bookmarkCollectionItems)
          .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
          .where(and(
            eq(bookmarkCollectionItems.collectionId, collection.id),
            eq(bookmarks.bookId, bookId)
          ));
        
        // Check if this is a clone
        const isClone = collection.name.startsWith('Копия ');
        
        return {
          ...collection,
          bookmarkCount: parseInt((itemCount[0] as any).count.toString()),
          isClone,
          isOwn: collection.ownerId === userId
        };
      }));
      
      res.json(collectionsWithCounts);
    } catch (error) {
      console.error("Error getting collections for book:", error);
      res.status(500).json({ error: "Failed to get collections for book" });
    }
  });
  
  // Update a bookmark (rename)
  app.put("/api/bookmarks/:bookmarkId", authenticateToken, async (req, res) => {
    try {
      const { bookmarkId } = req.params;
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Bookmark title is required" });
      }
      
      const bookmark = await storage.updateBookmark(bookmarkId, title);
      res.json(bookmark);
    } catch (error) {
      console.error("Error updating bookmark:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });
  
  // Book chat endpoints
  
  // Get book chat messages
  app.get("/api/books/:bookId/chat", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const messages = await storage.getBookChatMessages(bookId, limit, offset);
      res.json(messages);
    } catch (error) {
      console.error("Error getting book chat messages:", error);
      res.status(500).json({ error: "Failed to get chat messages" });
    }
  });
  
  // Get online users for a book chat room
  app.get("/api/books/:bookId/chat/online", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const io = (app as any).io;
      const roomName = `book-chat:${bookId}`;
      
      const room = io.sockets.adapter.rooms.get(roomName);
      const socketsInRoom = room ? Array.from(room) : [];
      
      // Get user IDs and fetch user info
      const onlineUsers: any[] = [];
      for (const socketId of socketsInRoom) {
        const s = io.sockets.sockets.get(socketId);
        if (s && s.data.userId) {
          const user = await storage.getUser(s.data.userId);
          if (user) {
            onlineUsers.push({
              id: user.id,
              username: user.username,
              avatarUrl: user.avatarUrl,
            });
          }
        }
      }
      
      // Remove duplicates (same user may have multiple connections)
      const uniqueUsers = onlineUsers.filter((user, index, self) =>
        index === self.findIndex(u => u.id === user.id)
      );
      
      res.json(uniqueUsers);
    } catch (error) {
      console.error("Error getting online users:", error);
      res.status(500).json({ error: "Failed to get online users" });
    }
  });
  
  // Get a single book by ID
  app.get("/api/books/:id", optionalAuthenticateToken, logUserAction, async (req, res) => {
    console.log("Get book by ID endpoint called");
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      console.log(`Getting book with ID: ${id}`);
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      let book = await storage.getBook(id, userId);
      console.log(`Retrieved book:`, book);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // If the book has no rating or the rating is null, calculate it
      if (book.rating === null || book.rating === undefined) {
        console.log(`Book ${id} has no rating, calculating...`);
        await storage.updateBookAverageRating(id);
        // Fetch the book again with the updated rating
        book = await storage.getBook(id, userId);
        console.log(`Book after rating calculation:`, book);
      }
      
      console.log(`Returning book:`, book);
      res.json(book);
    } catch (error) {
      console.error("Get book by ID error:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });

  // Add reaction to a book
  app.post("/api/books/:id/reactions", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).user.userId;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Create or remove reaction (toggle)
      const result = await storage.createReaction({
        userId,
        bookId: id,
        emoji
      });
      
      // Log book reaction activity (only when added)
      if (result.created && process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
        try {
          const actionData = {
            userId: userId,
            actionType: 'book_reaction',
            targetType: 'book',
            targetId: id,
            metadata: { 
              emoji: emoji,
              book_title: book.title
            }
          };
          
          const userAction = await storage.createUserAction(actionData);
          
          if ((app as any).io && userAction) {
            const io = (app as any).io;
            const user = await storage.getUser(userId);
            
            const eventData = {
              id: userAction.id,
              type: 'user_action',
              action_type: userAction.actionType,
              entityId: userAction.id,
              userId: userId,
              user: {
                id: userId,
                username: user?.username || 'Unknown',
                avatar_url: user?.avatarUrl || null
              },
              target: {
                type: 'book',
                id: id,
                title: book.title
              },
              metadata: userAction.metadata,
              createdAt: userAction.createdAt,
              timestamp: userAction.createdAt.toISOString()
            };
            
            io.to('stream:last-actions').emit('stream:last-action', eventData);
          }
        } catch (actionError) {
          console.error('[Book Reaction] Failed to log action:', actionError);
        }
      }
      
      // Broadcast reaction update to activity stream for real-time UI updates
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          const updatedReactions = await storage.getAggregatedBookReactions(id, userId);
          
          io.to('stream:global').emit('stream:reaction-update', {
            entityId: id,
            entityType: 'book',
            reactions: updatedReactions
          });
        }
      } catch (broadcastError) {
        console.error('[Book Reaction] Failed to broadcast reaction update:', broadcastError);
      }
      
      res.json({
        action: result.created ? 'added' : 'removed',
        reaction: result.reaction || null
      });
    } catch (error) {
      console.error("Add book reaction error:", error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  // Get reactions for a book
  app.get("/api/books/:id/reactions", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get aggregated reactions
      const reactions = await storage.getAggregatedBookReactions(id, userId);
      
      res.json(reactions);
    } catch (error) {
      console.error("Get book reactions error:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  });
  
  // Get detailed reactions for a book (with user information)
  app.get("/api/books/:id/reactions/detail", optionalAuthenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get detailed reactions with user information
      const reactions = await storage.getReactions(id, 'book');
      
      res.json(reactions);
    } catch (error) {
      console.error("Get book reactions detail error:", error);
      res.status(500).json({ error: "Failed to get reaction details" });
    }
  });

  // Upload book endpoint
  app.post("/api/books/upload", authenticateToken, upload.fields([{ name: 'bookFile' }, { name: 'coverImage' }]), async (req, res) => {
    console.log("Upload book endpoint called");
    console.log("req.files received:", req.files ? Object.keys(req.files) : 'none');
    try {
      const userId = (req as any).user.userId;
      
      // Extract book metadata from form data
      const { title, author, description, genre, year, publishedAt } = req.body;
      
      if (!title || !author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      
      // Create book record
      const bookData: any = {
        title,
        author,
        description: description || '',
        genre: genre || '',
        publishedYear: year ? parseInt(year) : null,
        userId, // Add userId to track who uploaded the user
        uploadedAt: new Date(), // Set upload time to current time
        publishedAt: publishedAt ? new Date(publishedAt) : (year ? new Date(`${year}-01-01`) : null) // Set publication date
      };
      
      // If book file was uploaded, add file information
      if (req.files && (req.files as any).bookFile) {
        const bookFile = (req.files as any).bookFile[0];
        console.log("Book file uploaded:", { filename: bookFile.filename, path: bookFile.path });
        // Store only the relative path from the uploads directory
        // Use filename as fallback if regex fails
        let filePath = bookFile.path.replace(/^.*[\\\/](uploads[\\\/].*)$/, '$1');
        if (filePath === bookFile.path || !filePath.startsWith('uploads')) {
          // Regex failed, construct path from filename
          filePath = 'uploads/' + bookFile.filename;
        }
        // Normalize backslashes to forward slashes
        bookData.filePath = filePath.replace(/\\/g, '/');
        bookData.fileSize = bookFile.size;
        bookData.fileType = bookFile.mimetype;
        console.log("Book file path stored:", bookData.filePath);
      }
      
      // If cover image was uploaded, add cover image information
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      console.log("Checking for coverImage in files:", files ? Object.keys(files) : 'no files');
      
      if (files && files.coverImage && files.coverImage.length > 0) {
        const coverImage = files.coverImage[0];
        console.log("Cover image uploaded:", { filename: coverImage.filename, path: coverImage.path, originalname: coverImage.originalname });
        // Store only the relative path from the uploads directory
        // Use filename as fallback if regex fails
        let coverPath = coverImage.path.replace(/^.*[\\\/](uploads[\\\/].*)$/, '$1');
        if (coverPath === coverImage.path || !coverPath.startsWith('uploads')) {
          // Regex failed, construct path from filename
          coverPath = 'uploads/' + coverImage.filename;
        }
        // Normalize backslashes to forward slashes
        bookData.coverImageUrl = coverPath.replace(/\\/g, '/');
        console.log("Cover image URL stored:", bookData.coverImageUrl);
      } else {
        console.log("No cover image found in upload. files.coverImage:", files?.coverImage);
      }
      
      const book = await storage.createBook(bookData);
      
      // Add book to the "Uploaded" shelf if it exists, or create it
      let uploadedShelf = (await storage.getShelves(userId)).find(shelf => shelf.name === "Загруженные");
      
      if (!uploadedShelf) {
        // Create the "Загруженные" shelf
        uploadedShelf = await storage.createShelf(userId, {
          name: "Загруженные",
          description: "Загруженные книги",
          color: "bg-blue-100 dark:bg-blue-900/20"
        });
      }
      
      // Add book to the shelf
      await storage.addBookToShelf(uploadedShelf.id, book.id);
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        const user = await storage.getUser(userId);
        
        if (user) {
          await createBookActivity(
            book.id,
            book.title,
            book.author,
            userId,
            user.username || user.fullName || 'Anonymous',
            book.coverImageUrl || '',
            (app as any).io // Socket.IO instance
          );
          console.log(`[STREAM] Book activity created for book ${book.id}`);
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to create book activity:', streamError);
        // Don't fail the request if stream activity creation fails
      }
      
      res.status(201).json({ 
        message: "Book uploaded successfully", 
        book,
        shelf: uploadedShelf 
      });
    } catch (error: any) {
      console.error("Upload book error:", error);
      res.status(500).json({ error: error.message || "Failed to upload book" });
    }
  });

  // Create a new shelf
  app.post("/api/shelves", authenticateToken, async (req, res) => {
    console.log("Create shelf endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { name, description, color } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Shelf name is required" });
      }
      
      const shelf = await storage.createShelf(userId, { name, description, color });
      
      // Log shelf creation action and broadcast via WebSocket
      try {
        console.log('[Shelf Creation] Creating user action for shelf creation event');
        const action = await storage.createUserAction({
          userId: userId,
          actionType: 'shelf_created',
          targetType: 'shelf',
          targetId: shelf.id,
          metadata: { shelf_name: name }
        });
        console.log('[Shelf Creation] User action created:', action?.id);
        
        // Broadcast shelf creation event via WebSocket
        if ((app as any).io && action) {
          const io = (app as any).io;
          console.log('[Shelf Creation] Broadcasting shelf creation event');
          
          // Get user info for broadcast
          const user = await storage.getUser(userId);
          
          const eventData = {
            id: action.id,
            type: 'user_action',
            action_type: 'shelf_created',
            entityId: action.id,
            userId: userId,
            user: {
              id: userId,
              username: user?.username || 'Unknown',
              avatar_url: user?.avatarUrl || null
            },
            target: {
              type: 'shelf',
              id: shelf.id,
              name: name
            },
            metadata: { shelf_name: name },
            createdAt: action.createdAt,
            timestamp: action.createdAt.toISOString()
          };
          
          // Broadcast to both global stream and last-actions room
          io.to('stream:global').emit('stream:last-action', eventData);
          io.to('stream:last-actions').emit('stream:last-action', eventData);
          console.log('[Shelf Creation] ✅ Shelf creation event broadcasted');
        }
      } catch (actionError) {
        console.error('[Shelf Creation] Failed to log user action or broadcast event:', actionError);
        // Don't fail shelf creation if action logging fails
      }
      
      res.status(201).json(shelf);
    } catch (error) {
      console.error("Create shelf error:", error);
      res.status(500).json({ error: "Failed to create shelf" });
    }
  });

  // Update a shelf
  app.put("/api/shelves/:id", authenticateToken, async (req, res) => {
    console.log("Update shelf endpoint called");
    try {
      const { id } = req.params;
      const { name, description, color } = req.body;
      
      // In a real implementation, you'd verify the shelf belongs to the user
      const shelf = await storage.updateShelf(id, { name, description, color });
      res.json(shelf);
    } catch (error) {
      console.error("Update shelf error:", error);
      res.status(500).json({ error: "Failed to update shelf" });
    }
  });

  // Delete a shelf
  app.delete("/api/shelves/:id", authenticateToken, async (req, res) => {
    console.log("Delete shelf endpoint called");
    try {
      const { id } = req.params;
      
      // In a real implementation, you'd verify the shelf belongs to the user
      await storage.deleteShelf(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete shelf error:", error);
      res.status(500).json({ error: "Failed to delete shelf" });
    }
  });

  // Add a book to a shelf
  app.post("/api/shelves/:id/books/:bookId", authenticateToken, async (req, res) => {
    console.log("Add book to shelf endpoint called");
    try {
      const { id: shelfId, bookId } = req.params;
      
      console.log(`Request to add book ${bookId} to shelf ${shelfId}`);
      
      // Verify that the shelf exists
      const shelf = await storage.getShelf(shelfId);
      if (!shelf) {
        console.log(`Shelf with ID ${shelfId} not found`);
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        console.log(`Book with ID ${bookId} not found`);
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Verify the shelf belongs to the user
      const userId = (req as any).user.userId;
      if (shelf.userId !== userId) {
        console.log(`Access denied: Shelf ${shelfId} does not belong to user ${userId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.addBookToShelf(shelfId, bookId);
      
      // Log book added to shelf action and broadcast via WebSocket
      try {
        console.log('[Book to Shelf] Creating user action for book added to shelf event');
        const action = await storage.createUserAction({
          userId: userId,
          actionType: 'book_added_to_shelf',
          targetType: 'book',
          targetId: bookId,
          metadata: { 
            book_title: book.title,
            shelf_id: shelfId,
            shelf_name: shelf.name 
          }
        });
        console.log('[Book to Shelf] User action created:', action?.id);
        
        // Broadcast book added to shelf event via WebSocket
        if ((app as any).io && action) {
          const io = (app as any).io;
          console.log('[Book to Shelf] Broadcasting book added to shelf event');
          
          // Get user info for broadcast
          const user = await storage.getUser(userId);
          
          const eventData = {
            id: action.id,
            type: 'user_action',
            action_type: 'book_added_to_shelf',
            entityId: action.id,
            userId: userId,
            user: {
              id: userId,
              username: user?.username || 'Unknown',
              avatar_url: user?.avatarUrl || null
            },
            target: {
              type: 'book',
              id: bookId,
              title: book.title,
              shelf_id: shelfId,
              shelf_name: shelf.name
            },
            metadata: { 
              book_title: book.title,
              shelf_id: shelfId,
              shelf_name: shelf.name 
            },
            createdAt: action.createdAt,
            timestamp: action.createdAt.toISOString()
          };
          
          // Broadcast to both global stream and last-actions room
          io.to('stream:global').emit('stream:last-action', eventData);
          io.to('stream:last-actions').emit('stream:last-action', eventData);
          console.log('[Book to Shelf] ✅ Book added to shelf event broadcasted');
        }
      } catch (actionError) {
        console.error('[Book to Shelf] Failed to log user action or broadcast event:', actionError);
        // Don't fail book addition if action logging fails
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Add book to shelf error:", error);
      res.status(500).json({ error: "Failed to add book to shelf" });
    }
  });

  // Remove a book from a shelf
  app.delete("/api/shelves/:id/books/:bookId", authenticateToken, async (req, res) => {
    console.log("Remove book from shelf endpoint called");
    try {
      const { id: shelfId, bookId } = req.params;
      
      console.log(`Request to remove book ${bookId} from shelf ${shelfId}`);
      
      // Verify that the shelf exists
      const shelf = await storage.getShelf(shelfId);
      if (!shelf) {
        console.log(`Shelf with ID ${shelfId} not found`);
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        console.log(`Book with ID ${bookId} not found`);
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Verify the shelf belongs to the user
      const userId = (req as any).user.userId;
      if (shelf.userId !== userId) {
        console.log(`Access denied: Shelf ${shelfId} does not belong to user ${userId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.removeBookFromShelf(shelfId, bookId);
      res.status(204).send();
    } catch (error) {
      console.error("Remove book from shelf error:", error);
      res.status(500).json({ error: "Failed to remove book from shelf" });
    }
  });

  // Delete a book
  app.delete("/api/books/:id", authenticateToken, async (req, res) => {
    console.log("Delete book endpoint called");
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      // Attempt to delete the book
      const success = await storage.deleteBook(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete book error:", error);
      if (error.message && error.message.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Comments endpoints
  // Create a comment
  app.post("/api/books/:bookId/comments", authenticateToken, async (req, res) => {
    console.log("Create comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const { content, attachments, parentCommentId, quotedText } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      
      // Process attachments if provided
      let attachmentMetadata = null;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const uploadedAttachments = [];
        for (const uploadId of attachments) {
          const fileUpload = await storage.getFileUpload(uploadId);
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
        }
      }
      
      const comment = await storage.createComment({
        userId,
        bookId,
        content,
        attachmentMetadata,
        parentCommentId: parentCommentId || null,
        quotedText: quotedText || null
      });
      
      // Automatically subscribe user to this book when they comment
      try {
        await storage.subscribeToEntity(userId, 'book', bookId);
        console.log(`[SUBSCRIPTION] User ${userId} automatically subscribed to book ${bookId}`);
      } catch (subscribeError) {
        console.error('[SUBSCRIPTION] Failed to subscribe user to book:', subscribeError);
        // Don't fail the comment creation if subscription fails
      }
      
      // Create activity feed entry and broadcast via WebSocket
      // TEMPORARY: Direct broadcast test to diagnose real-time issues
      try {
        console.log('[STREAM DEBUG] Starting activity broadcast for comment:', comment.id);
        console.log('[STREAM DEBUG] Socket.IO instance available:', !!(app as any).io);
        
        const user = await storage.getUser(userId);
        const book = await storage.getBook(bookId);
        
        console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
        console.log('[STREAM DEBUG] Book found:', !!book, book ? book.title : 'N/A');
        
        if (user && book && (app as any).io) {
          console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
          
          const io = (app as any).io;
          
          // Check room status
          const globalRoom = io.sockets.adapter.rooms.get('stream:global');
          console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
          if (globalRoom && globalRoom.size > 0) {
            console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
          }
          
          // Create activity data with snake_case field names (matching ActivityCard expectations)
          const activityData = {
            id: comment.id,
            type: 'comment',
            entityId: comment.id,
            userId: userId,
            bookId: bookId,
            parentCommentId: parentCommentId || null, // Include parent comment ID for replies
            metadata: {
              content_preview: content.substring(0, 200),
              author_id: userId,
              author_name: user.username || user.fullName || 'Anonymous',
              author_avatar: user.avatarUrl || null,
              book_id: bookId,
              book_title: book.title,
              parentCommentId: parentCommentId || null, // Also include in metadata for redundancy
              reactions: [] // Start with empty reactions array
            },
            createdAt: comment.createdAt
          };
          
          console.log('[STREAM DEBUG] Activity data:', activityData);
          
          // Broadcast to global stream
          io.to('stream:global').emit('stream:new-activity', activityData);
          console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✅ Direct broadcast sent to stream:global');
          
          // Also broadcast counter update for the book
          try {
            const updatedBook = await storage.getBook(bookId);
            if (updatedBook) {
              io.to('stream:global').emit('stream:counter-update', {
                entityId: bookId,
                entityType: 'book',
                commentCount: updatedBook.commentCount || 0,
                reviewCount: updatedBook.reviewCount || 0
              });
              console.log('[STREAM] Book counter update broadcast sent');
            }
          } catch (counterError) {
            console.error('[STREAM] Failed to broadcast book counter update:', counterError);
          }
        } else {
          console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
            hasUser: !!user,
            hasBook: !!book,
            hasIo: !!(app as any).io
          });
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast comment activity:', streamError);
        // Don't fail the request if stream activity broadcast fails
      }
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Get comments for a book
  app.get("/api/books/:bookId/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get comments endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId;
      const comments = await storage.getComments(bookId, userId);
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  // Get replies for a book comment (threaded/nested)
  app.get("/api/comments/:commentId/replies", optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.userId;
      const replies = await storage.getBookCommentReplies(commentId, userId);
      res.json(replies);
    } catch (error) {
      console.error("Get comment replies error:", error);
      res.status(500).json({ error: "Failed to get replies" });
    }
  });

  // Toggle reaction on a book comment
  app.post("/api/comments/:commentId/reaction", authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }

      // Check if user already reacted with this emoji
      const existingReactions = await storage.getCommentReactions(commentId, userId);
      const alreadyReacted = existingReactions.some(r => r.emoji === emoji && r.userReacted);
      
      let action: 'added' | 'removed';
      if (alreadyReacted) {
        await storage.removeBookCommentReaction(userId, commentId, emoji);
        action = 'removed';
      } else {
        await storage.addBookCommentReaction(userId, commentId, emoji);
        action = 'added';
        
        // Get updated reactions to include total count
        const updatedReactions = await storage.getCommentReactions(commentId, userId);
        const totalReactionCount = updatedReactions.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          console.log('[Book Comment Reaction] ENABLE_LAST_ACTIONS_TRACKING:', process.env.ENABLE_LAST_ACTIONS_TRACKING);
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            console.log('[Book Comment Reaction] Logging reaction activity for comment:', commentId);
            const comment = await storage.getCommentById(commentId);
            console.log('[Book Comment Reaction] Comment found:', !!comment, comment?.bookId);
            if (comment) {
              const book = await storage.getBook(comment.bookId);
              const commentAuthor = await storage.getUser(comment.userId);
              console.log('[Book Comment Reaction] Book:', book?.title, 'Author:', commentAuthor?.username);
              
              const actionData = {
                userId: userId,
                actionType: 'book_comment_reaction',
                targetType: 'book',
                targetId: comment.bookId,
                metadata: { 
                  emoji: emoji,
                  comment_id: commentId,
                  comment_preview: comment.content.substring(0, 50),
                  comment_author: commentAuthor?.username || 'Unknown',
                  book_title: book?.title || 'Unknown',
                  total_reactions: totalReactionCount
                }
              };
              
              console.log('[Book Comment Reaction] Creating user action:', actionData);
              const userAction = await storage.createUserAction(actionData);
              console.log('[Book Comment Reaction] User action created:', userAction?.id);
              
              if ((app as any).io && userAction) {
                const io = (app as any).io;
                const user = await storage.getUser(userId);
                
                const eventData = {
                  id: userAction.id,
                  type: 'user_action',
                  action_type: userAction.actionType,
                  entityId: userAction.id,
                  userId: userId,
                  user: {
                    id: userId,
                    username: user?.username || 'Unknown',
                    avatar_url: user?.avatarUrl || null
                  },
                  target: {
                    type: 'book',
                    id: comment.bookId,
                    title: book?.title || 'Unknown'
                  },
                  metadata: userAction.metadata,
                  createdAt: userAction.createdAt,
                  timestamp: userAction.createdAt.toISOString()
                };
                
                console.log('[Book Comment Reaction] Broadcasting to stream:last-actions');
                io.to('stream:last-actions').emit('stream:last-action', eventData);
                console.log('[Book Comment Reaction] ✅ Broadcast sent');
              }
            }
          }
        } catch (actionError) {
          console.error('[Book Comment Reaction] Failed to log action:', actionError);
        }
      }
      
      // Get updated reactions
      const reactions = await storage.getCommentReactions(commentId, userId);
      res.json({ action, reactions });
    } catch (error) {
      console.error("Toggle comment reaction error:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });
  
  // Get detailed reactions for a book comment
  app.get("/api/comments/:commentId/reactions", optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      
      // Get detailed reactions with user information
      const reactions = await storage.getReactions(commentId, 'comment');
      
      res.json(reactions);
    } catch (error) {
      console.error("Get comment reactions error:", error);
      res.status(500).json({ error: "Failed to get comment reactions" });
    }
  });

  // Admin: Delete any comment
  app.delete("/api/admin/comments/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin delete comment endpoint called");
    try {
      const { id } = req.params;
      
      // Admins can delete any comment
      const success = await storage.deleteComment(id, null);
      
      if (!success) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Broadcast deletion via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          console.log('[STREAM] Broadcasting comment deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Admin delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });
  
  // Delete a comment (user can delete their own)
  app.delete("/api/comments/:id", authenticateToken, async (req, res) => {
    console.log("Delete comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      
      const success = await storage.deleteComment(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Comment not found or unauthorized" });
      }
      
      // Broadcast deletion via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          console.log('[STREAM] Broadcasting comment deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Reviews endpoints
  // Create a review
  app.post("/api/books/:bookId/reviews", authenticateToken, async (req, res) => {
    console.log("Create review endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const { rating, content, attachments, parentReviewId, quotedText } = req.body;
      
      console.log(`Creating review for book ${bookId} by user ${userId} with rating ${rating}`);
      
      // Content is always required
      if (content === undefined || content === null || content.trim() === '') {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Rating is only required for root reviews, not for replies
      if (!parentReviewId) {
        if (rating === undefined || rating === null) {
          return res.status(400).json({ error: "Rating is required for reviews" });
        }
        // Validate rating is between 1 and 10
        if (typeof rating !== 'number' || rating < 1 || rating > 10) {
          return res.status(400).json({ error: "Rating must be a number between 1 and 10" });
        }
      }
      
      // Only check for existing review if this is not a reply
      if (!parentReviewId) {
        const existingReview = await storage.getUserReview(userId, bookId);
        if (existingReview) {
          return res.status(400).json({ error: "You have already reviewed this book" });
        }
      }
      
      // Process attachments if provided
      let attachmentMetadata = null;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const uploadedAttachments = [];
        for (const uploadId of attachments) {
          const fileUpload = await storage.getFileUpload(uploadId);
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
        }
      }
      
      const review = await storage.createReview({
        userId,
        bookId,
        rating,
        content,
        attachmentMetadata,
        parentReviewId: parentReviewId || null,
        quotedText: quotedText || null
      });
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        console.log('[STREAM DEBUG] Starting activity broadcast for review:', review.id);
        console.log('[STREAM DEBUG] Socket.IO instance available:', !!(app as any).io);
        
        const user = await storage.getUser(userId);
        const book = await storage.getBook(bookId);
        
        console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
        console.log('[STREAM DEBUG] Book found:', !!book, book ? book.title : 'N/A');
        
        if (user && book && (app as any).io) {
          console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
          
          const io = (app as any).io;
          
          // Check room status
          const globalRoom = io.sockets.adapter.rooms.get('stream:global');
          console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
          if (globalRoom && globalRoom.size > 0) {
            console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
          }
          
          // Create activity data with snake_case field names (matching ActivityCard expectations)
          const activityData = {
            id: review.id,
            type: 'review',
            entityId: review.id,
            userId: userId,
            bookId: bookId,
            metadata: {
              content_preview: content.substring(0, 200),
              rating: rating,
              author_id: userId,
              author_name: user.username || user.fullName || 'Anonymous',
              author_avatar: user.avatarUrl || null,
              book_id: bookId,
              book_title: book.title,
              reactions: [] // Start with empty reactions array
            },
            createdAt: review.createdAt
          };
          
          console.log('[STREAM DEBUG] Activity data:', activityData);
          
          // Broadcast to global stream
          io.to('stream:global').emit('stream:new-activity', activityData);
          console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✅ Direct broadcast sent to stream:global');
          
          // Also broadcast counter update for the book
          try {
            const updatedBook = await storage.getBook(bookId);
            if (updatedBook) {
              io.to('stream:global').emit('stream:counter-update', {
                entityId: bookId,
                entityType: 'book',
                commentCount: updatedBook.commentCount || 0,
                reviewCount: updatedBook.reviewCount || 0
              });
              console.log('[STREAM] Book counter update broadcast sent for review');
            }
          } catch (counterError) {
            console.error('[STREAM] Failed to broadcast book counter update:', counterError);
          }
        } else {
          console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
            hasUser: !!user,
            hasBook: !!book,
            hasIo: !!(app as any).io
          });
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast review activity:', streamError);
        // Don't fail the request if stream activity broadcast fails
      }
      
      console.log(`Successfully created review for book ${bookId}:`, review);
      res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Get user's review for a book
  app.get("/api/books/:bookId/my-review", authenticateToken, async (req, res) => {
    console.log("Get user's review endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const review = await storage.getUserReview(userId, bookId);
      
      if (review) {
        // Get reactions for this review
        const reactions = await storage.getReactions(review.id, 'review');
        
        // Group and aggregate reactions by emoji
        const reactionsMap: Record<string, any[]> = {};
        
        // Group reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        reactions.forEach(reaction => {
          const key = reaction.emoji;
          if (!groupedReactions[key]) {
            groupedReactions[key] = [];
          }
          groupedReactions[key].push(reaction);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          // Check if current user reacted with this emoji
          const userReacted = reactionList.some(reaction => reaction.userId === userId);
          
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted
          });
        });
        
        // Add reactions to review
        const reviewWithReactions = {
          ...review,
          reactions: aggregatedReactions
        };
        
        res.json(reviewWithReactions);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Get user's review error:", error);
      res.status(500).json({ error: "Failed to get user's review" });
    }
  });

  // Get user's review for a specific book
  app.get("/api/books/:bookId/user-review/:userId", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user's review for book endpoint called");
    try {
      const { bookId, userId } = req.params;
      
      const review = await storage.getUserReview(userId, bookId);
      
      if (review) {
        // Get reactions for this review
        const reactions = await storage.getReviewReactions(review.id, (req as any).user?.userId);
        
        // Aggregate reactions by emoji
        const reactionMap: Record<string, any[]> = {};
        reactions.forEach((reaction: any) => {
          if (!reactionMap[reaction.emoji]) {
            reactionMap[reaction.emoji] = [];
          }
          reactionMap[reaction.emoji].push(reaction);
        });
        
        // Convert to aggregated format
        const aggregatedReactions = Object.entries(reactionMap).map(([emoji, reactionList]) => {
          const userId = (req as any).user?.userId;
          const userReacted = reactionList.some((reaction: any) => reaction.userId === userId);
          
          return {
            emoji,
            count: reactionList.length,
            userReacted
          };
        });
        
        // Add reactions to review
        const reviewWithReactions = {
          ...review,
          reactions: aggregatedReactions
        };
        
        res.json(reviewWithReactions);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Get user's review error:", error);
      res.status(500).json({ error: "Failed to get user's review" });
    }
  });

  // Get reviews for a book
  app.get("/api/books/:bookId/reviews", optionalAuthenticateToken, async (req, res) => {
    console.log("Get reviews endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId; // Optional userId
      
      // getReviews now returns only root reviews with reactions and reply counts
      const reviews = await storage.getReviews(bookId, userId);
      
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Admin: Delete any review
  app.delete("/api/admin/reviews/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin delete review endpoint called");
    try {
      const { id } = req.params;
      
      // Admins can delete any review
      const success = await storage.deleteReview(id, null);
      
      if (!success) {
        return res.status(404).json({ error: "Review not found" });
      }
      
      // Broadcast deletion via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          console.log('[STREAM] Broadcasting review deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Admin delete review error:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });
  
  // Delete a review (user can delete their own)
  app.delete("/api/reviews/:id", authenticateToken, async (req, res) => {
    console.log("Delete review endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      
      const success = await storage.deleteReview(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Review not found or unauthorized" });
      }
      
      // Broadcast deletion via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          console.log('[STREAM] Broadcasting review deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✅ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Get replies for a review
  app.get("/api/reviews/:reviewId/replies", optionalAuthenticateToken, async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = (req as any).user?.userId;
      
      const replies = await storage.getReviewReplies(reviewId, userId);
      res.json(replies);
    } catch (error) {
      console.error("Get review replies error:", error);
      res.status(500).json({ error: "Failed to get review replies" });
    }
  });

  // Toggle reaction on a review
  app.post("/api/reviews/:reviewId/reaction", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { reviewId } = req.params;
      const { emoji } = req.body;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Check if user already reacted with this emoji
      const existingReactions = await storage.getReviewReactions(reviewId, userId);
      const existingReaction = existingReactions.find(r => r.emoji === emoji && r.userReacted);
      
      if (existingReaction) {
        // Remove the reaction
        await storage.removeReviewReaction(userId, reviewId, emoji);
      } else {
        // Add the reaction
        await storage.addReviewReaction(userId, reviewId, emoji);
        
        // Get updated reactions to include total count
        const updatedReactionsForCount = await storage.getReviewReactions(reviewId, userId);
        const totalReactionCount = updatedReactionsForCount.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          console.log('[Book Review Reaction] ENABLE_LAST_ACTIONS_TRACKING:', process.env.ENABLE_LAST_ACTIONS_TRACKING);
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            console.log('[Book Review Reaction] Logging reaction activity for review:', reviewId);
            const review = await storage.getReviewById(reviewId);
            console.log('[Book Review Reaction] Review found:', !!review, review?.bookId);
            if (review) {
              const book = await storage.getBook(review.bookId);
              const reviewAuthor = await storage.getUser(review.userId);
              console.log('[Book Review Reaction] Book:', book?.title, 'Author:', reviewAuthor?.username);
              
              const actionData = {
                userId: userId,
                actionType: 'book_review_reaction',
                targetType: 'book',
                targetId: review.bookId,
                metadata: { 
                  emoji: emoji,
                  review_id: reviewId,
                  review_preview: review.content.substring(0, 50),
                  review_author: reviewAuthor?.username || 'Unknown',
                  book_title: book?.title || 'Unknown',
                  total_reactions: totalReactionCount
                }
              };
              
              console.log('[Book Review Reaction] Creating user action:', actionData);
              const userAction = await storage.createUserAction(actionData);
              console.log('[Book Review Reaction] User action created:', userAction?.id);
              
              if ((app as any).io && userAction) {
                const io = (app as any).io;
                const user = await storage.getUser(userId);
                
                const eventData = {
                  id: userAction.id,
                  type: 'user_action',
                  action_type: userAction.actionType,
                  entityId: userAction.id,
                  userId: userId,
                  user: {
                    id: userId,
                    username: user?.username || 'Unknown',
                    avatar_url: user?.avatarUrl || null
                  },
                  target: {
                    type: 'book',
                    id: review.bookId,
                    title: book?.title || 'Unknown'
                  },
                  metadata: userAction.metadata,
                  createdAt: userAction.createdAt,
                  timestamp: userAction.createdAt.toISOString()
                };
                
                console.log('[Book Review Reaction] Broadcasting to stream:last-actions');
                io.to('stream:last-actions').emit('stream:last-action', eventData);
                console.log('[Book Review Reaction] ✅ Broadcast sent');
              }
            }
          }
        } catch (actionError) {
          console.error('[Book Review Reaction] Failed to log action:', actionError);
        }
      }
      
      // Return updated reactions
      const updatedReactions = await storage.getReviewReactions(reviewId, userId);
      res.json({ reactions: updatedReactions });
    } catch (error) {
      console.error("Toggle review reaction error:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });
  
  // Get detailed reactions for a review
  app.get("/api/reviews/:reviewId/reactions", optionalAuthenticateToken, async (req, res) => {
    try {
      const { reviewId } = req.params;
      
      // Get detailed reactions with user information
      const reactions = await storage.getReactions(reviewId, 'review');
      
      res.json(reactions);
    } catch (error) {
      console.error("Get review reactions error:", error);
      res.status(500).json({ error: "Failed to get review reactions" });
    }
  });

  // Reactions endpoints
  // Create/toggle a reaction
  app.post("/api/reactions", authenticateToken, async (req, res) => {
    console.log("Create reaction endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { commentId, reviewId, emoji } = req.body;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      if (!commentId && !reviewId) {
        return res.status(400).json({ error: "Either commentId or reviewId is required" });
      }
      
      if (commentId && reviewId) {
        return res.status(400).json({ error: "Only one of commentId or reviewId should be provided" });
      }
      
      if (commentId === '' || reviewId === '') {
        return res.status(400).json({ error: "commentId or reviewId cannot be empty" });
      }
      
      const reaction = await storage.createReaction({
        userId,
        commentId,
        reviewId,
        emoji
      });
      
      // Broadcast reaction update to activity stream via WebSocket
      try {
        if ((app as any).io) {
          const io = (app as any).io;
          const entityId = commentId || reviewId;
          const entityType = commentId ? 'comment' : 'review';
          
          // Get all reactions for this comment/review
          const updatedReactions = await storage.getReactions(entityId, entityType);
          
          // Group and aggregate reactions by emoji
          const groupedReactions: Record<string, any[]> = {};
          updatedReactions.forEach((r: any) => {
            const key = r.emoji;
            if (!groupedReactions[key]) {
              groupedReactions[key] = [];
            }
            groupedReactions[key].push(r);
          });
          
          // Aggregate reactions
          const aggregatedReactions: any[] = [];
          Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
            const userReacted = reactionList.some((r: any) => r.userId === userId);
            aggregatedReactions.push({
              emoji,
              count: reactionList.length,
              userReacted
            });
          });
          
          // Broadcast reaction update with aggregated data
          io.to('stream:global').emit('stream:reaction-update', {
            entityId,
            entityType,
            reactions: aggregatedReactions,
            action: reaction.removed ? 'removed' : 'added'
          });
          
          console.log(`[STREAM] Reaction update broadcast sent for ${entityType}:`, entityId);
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast reaction update:', streamError);
      }
      
      res.json(reaction);
    } catch (error) {
      console.error("Create reaction error:", error);
      res.status(500).json({ error: "Failed to create reaction" });
    }
  });
  
  // Admin: Get all reactions for a news article
  app.get("/api/admin/news/:id/reactions", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get news reactions (admin) endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      
      // Get reactions for this news article
      const reactions = await storage.getReactionsForNews(id);
      
      // Get user information for each reaction
      const reactionsWithUsers = await Promise.all(reactions.map(async (reaction: any) => {
        const user = await storage.getUser(reaction.userId);
        return {
          ...reaction,
          userFullName: user?.fullName,
          userUsername: user?.username
        };
      }));
      
      res.json(reactionsWithUsers);
    } catch (error) {
      console.error("Get news reactions (admin) error:", error);
      res.status(500).json({ error: "Failed to get news reactions" });
    }
  });
  
  // Get detailed reactions for a news article (public endpoint)
  app.get("/api/news/:id/reactions", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news reactions (public) endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      
      // Get reactions for this news article
      const reactions = await storage.getReactionsForNews(id);
      
      res.json(reactions);
    } catch (error) {
      console.error("Get news reactions (public) error:", error);
      res.status(500).json({ error: "Failed to get news reactions" });
    }
  });
  
  // Admin: Update reaction count for a news article
  app.put("/api/admin/news/:id/reaction-count", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update news reaction count (admin) endpoint called for news ID:", req.params.id);
    try {
      const { id } = req.params;
      const { reactionCount } = req.body;
      
      if (reactionCount === undefined || reactionCount < 0) {
        return res.status(400).json({ error: "Valid reaction count is required" });
      }
      
      // Update the news article with the new reaction count
      const updatedNews = await storage.updateNews(id, { reactionCount: parseInt(reactionCount) });
      
      res.json(updatedNews);
    } catch (error) {
      console.error("Update news reaction count (admin) error:", error);
      res.status(500).json({ error: "Failed to update news reaction count" });
    }
  });
  
  // Admin: Delete any reaction
  app.delete("/api/admin/reactions/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin delete reaction endpoint called");
    try {
      const { id } = req.params;
      
      // Admins can delete any reaction
      const success = await storage.deleteReaction(id, null);
      
      if (!success) {
        return res.status(404).json({ error: "Reaction not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Admin delete reaction error:", error);
      res.status(500).json({ error: "Failed to delete reaction" });
    }
  });
  
  // ========================================
  // OLD MESSAGING ENDPOINTS - DEPRECATED (Commented out to use new conversation-based endpoints)
  // ========================================
  /*
  // OLD: Send a new message
  app.post("/api/messages", authenticateToken, async (req, res) => {
    console.log("OLD Send message endpoint called");
    try {
      const senderId = (req as any).user.userId;
      const { recipientId, content } = req.body;
      
      if (!recipientId || !content) {
        return res.status(400).json({ error: "Recipient ID and content are required" });
      }
      
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      
      if (senderId === recipientId) {
        return res.status(400).json({ error: "Cannot send message to yourself" });
      }
      
      const messageData = {
        senderId,
        recipientId,
        content,
      };
      
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // OLD: Get messages with a specific user
  app.get("/api/messages/:userId", authenticateToken, async (req, res) => {
    console.log("OLD Get messages endpoint called");
    try {
      const currentUserId = (req as any).user.userId;
      const { userId: otherUserId } = req.params;
      
      if (!otherUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const otherUser = await storage.getUser(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const messages = await storage.getMessagesBetweenUsers(currentUserId, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });
  
  // OLD: Get conversations for current user
  app.get("/api/conversations", authenticateToken, async (req, res) => {
    console.log("OLD Get conversations endpoint called");
    try {
      const userId = (req as any).user.userId;
      const conversations = await storage.getConversationsForUser(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });
  
  // OLD: Mark message as read
  app.put("/api/messages/:messageId/read", authenticateToken, async (req, res) => {
    console.log("OLD Mark message as read endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { messageId } = req.params;
      
      if (!messageId) {
        return res.status(400).json({ error: "Message ID is required" });
      }
      
      await storage.markMessageAsRead(messageId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });
  
  // OLD: Get unread messages count
  app.get("/api/messages/unread-count", authenticateToken, async (req, res) => {
    console.log("OLD Get unread messages count endpoint called");
    try {
      const userId = (req as any).user.userId;
      const count = await storage.getUnreadMessagesCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread messages count" });
    }
  });
  */
  
  // Admin: Delete any message
  app.delete("/api/admin/messages/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin delete message endpoint called");
    try {
      const { id } = req.params;
      
      // Admins can delete any message
      const success = await storage.deleteMessage(id, null);
      
      if (!success) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.status(204).send(); // No content response for successful deletion
    } catch (error) {
      console.error("Admin delete message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  
  // Admin: Get dashboard statistics
  app.get("/api/admin/dashboard-stats", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get dashboard stats endpoint called");
    try {
      // Calculate statistics for news from last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      // Calculate statistics for comments and reviews from today
      // We need to get the start of the current day in UTC to match the database timezone
      const today = new Date();
      const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
      
      // For database queries, we need to ensure we're comparing the same timezone
      // The database stores timestamps in UTC, so we need to make sure our comparison date is also in UTC
      
      // Get news count from last month
      const newsFromLastMonth = await storage.getNewsCountSince(oneMonthAgo);
      
      // Get comments count from today
      const commentsFromToday = await storage.getCommentsCountSince(startOfToday);
      
      // Get reviews count from today
      const reviewsFromToday = await storage.getReviewsCountSince(startOfToday);
      
      // Get user registration statistics
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      // Count total users
      const totalUsersResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const totalUsers = parseInt(totalUsersResult.rows[0].count as string);
      console.log('[DASHBOARD-STATS] Total users:', totalUsers);
      
      // Count users registered today
      const todayUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= ${startOfToday}
      `);
      const todayUsers = parseInt(todayUsersResult.rows[0].count as string);
      console.log('[DASHBOARD-STATS] Today users:', todayUsers, 'startOfToday:', startOfToday);
      
      // Count users registered this week
      const weekUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= ${oneWeekAgo}
      `);
      const weekUsers = parseInt(weekUsersResult.rows[0].count as string);
      console.log('[DASHBOARD-STATS] Week users:', weekUsers);
      
      // Count users registered this month
      const monthUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= ${oneMonthAgo}
      `);
      const monthUsers = parseInt(monthUsersResult.rows[0].count as string);
      console.log('[DASHBOARD-STATS] Month users:', monthUsers);
      
      // Count users registered this year
      const yearUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= ${oneYearAgo}
      `);
      const yearUsers = parseInt(yearUsersResult.rows[0].count as string);
      console.log('[DASHBOARD-STATS] Year users:', yearUsers);
      
      const result = {
        newsChange: newsFromLastMonth,
        commentsChange: commentsFromToday,
        reviewsChange: reviewsFromToday,
        userStats: {
          total: totalUsers,
          today: todayUsers,
          week: weekUsers,
          month: monthUsers,
          year: yearUsers
        }
      };
      
      console.log('[DASHBOARD-STATS] Sending response:', JSON.stringify(result));
      res.json(result);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ error: "Failed to get dashboard statistics" });
    }
  });
  
  // Admin: Get all users with statistics
  app.get("/api/admin/users", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get users with stats endpoint called");
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;
      
      let users;
      let totalCount;
      
      if (search) {
        // Search users by username, full name, or email
        const searchPattern = `%${search}%`;
        const usersResult = await db.execute(sql`
          SELECT 
            u.id,
            u.username,
            u.full_name as "fullName",
            u.email,
            u.access_level as "accessLevel",
            COALESCE(u.is_blocked, false) as "isBlocked",
            u.block_reason as "blockReason",
            u.created_at as "createdAt",
            u.last_login_at as "lastLogin",
            u.last_activity_at as "lastActivity",
            COUNT(DISTINCT s.id)::text as "shelvesCount",
            COUNT(DISTINCT sb.book_id)::text as "booksOnShelvesCount",
            COUNT(DISTINCT c.id)::text as "commentsCount",
            COUNT(DISTINCT r.id)::text as "reviewsCount"
          FROM users u
          LEFT JOIN shelves s ON u.id = s.user_id
          LEFT JOIN shelf_books sb ON s.id = sb.shelf_id
          LEFT JOIN comments c ON u.id = c.user_id
          LEFT JOIN reviews r ON u.id = r.user_id
          WHERE 
            LOWER(u.username) LIKE LOWER(${searchPattern}) OR
            LOWER(u.full_name) LIKE LOWER(${searchPattern}) OR
            LOWER(u.email) LIKE LOWER(${searchPattern})
          GROUP BY u.id, u.username, u.full_name, u.email, u.access_level, u.is_blocked, u.block_reason, u.created_at, u.updated_at, u.last_login_at, u.last_activity_at
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
        
        users = usersResult.rows;
        
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM users
          WHERE 
            LOWER(username) LIKE LOWER(${searchPattern}) OR
            LOWER(full_name) LIKE LOWER(${searchPattern}) OR
            LOWER(email) LIKE LOWER(${searchPattern})
        `);
        totalCount = parseInt(countResult.rows[0].count as string);
      } else {
        users = await storage.getUsersWithStats(limit, offset);
        
        // Get total count for pagination
        const totalCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        totalCount = parseInt(totalCountResult.rows[0].count as string);
      }
      
      res.json({
        users,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error("Get users with stats error:", error);
      res.status(500).json({ error: "Failed to get users with statistics" });
    }
  });
  
  // Admin: Update user
  app.put("/api/admin/users/:userId", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update user endpoint called");
    try {
      const { userId } = req.params;
      const { username, fullName, email, bio } = req.body;
      
      // Build update object
      const updateData: any = {};
      if (username) updateData.username = username;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (bio !== undefined) updateData.bio = bio;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  
  // Admin: Change user password
  app.put("/api/admin/users/:userId/password", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Change user password endpoint called");
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user with new password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Change user password error:", error);
      res.status(500).json({ error: "Failed to change user password" });
    }
  });
  
  // Admin: Generate impersonation token
  app.post("/api/admin/users/:userId/impersonate", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Generate impersonation token endpoint called");
    try {
      const { userId } = req.params;
      
      // Check if the target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Generate a temporary token for the target user
      const impersonationToken = jwt.sign({ 
        userId: targetUser.id,
        impersonatedBy: (req as any).user.userId,
        impersonatedAt: new Date().toISOString()
      }, process.env.JWT_SECRET || "default_secret", {
        expiresIn: "1h" // Token expires in 1 hour
      });
      
      res.json({
        token: impersonationToken,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          fullName: targetUser.fullName,
          email: targetUser.email
        }
      });
    } catch (error) {
      console.error("Generate impersonation token error:", error);
      res.status(500).json({ error: "Failed to generate impersonation token" });
    }
  });
  
  // Admin: Get all books with pagination and search
  app.get("/api/admin/books", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all books (admin) endpoint called");
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const sortBy = req.query.sortBy as string || 'uploadedAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const offset = (page - 1) * limit;
      
      const { books, total } = await storage.getAllBooksWithUploader(limit, offset, search, sortBy, sortOrder);
      
      res.json({
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Get all books (admin) error:", error);
      res.status(500).json({ error: "Failed to get books" });
    }
  });
  
  // Admin: Update book
  app.put("/api/admin/books/:id", authenticateToken, requireAdminOrModerator, (req, res, next) => {
    upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'bookFile', maxCount: 1 }])(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.message === 'Unexpected field') {
          return res.status(400).json({ error: `Unexpected file field. Only 'coverImage' and 'bookFile' are allowed.` });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  }, async (req, res) => {
    console.log("Update book (admin) endpoint called");
    console.log("Request files:", req.files);
    console.log("Request body:", req.body);
    try {
      const { id } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Prepare update data
      const updateData: any = {};
      
      console.log("Processing book update for ID:", id);
      console.log("Request body isActive:", req.body.isActive);
      console.log("Request body type:", typeof req.body.isActive);
      
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.author) updateData.author = req.body.author;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.genre !== undefined) updateData.genre = req.body.genre;
      if (req.body.publishedYear) updateData.publishedYear = parseInt(req.body.publishedYear);
      if (req.body.publishedAt) updateData.publishedAt = new Date(req.body.publishedAt);
      if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive === 'true' || req.body.isActive === true;
        console.log("Setting isActive to:", updateData.isActive);
      }
      
      // Handle cover image update
      if (files && files.coverImage && files.coverImage[0]) {
        // Delete old cover image if it exists
        if (book.coverImageUrl) {
          const oldCoverPath = path.join(process.cwd(), book.coverImageUrl);
          if (fs.existsSync(oldCoverPath)) {
            try {
              fs.unlinkSync(oldCoverPath);
            } catch (error) {
              console.error("Error deleting old cover image:", error);
              // Don't fail the update if old image deletion fails
            }
          }
        }
        
        // Save new cover image path
        updateData.coverImageUrl = '/uploads/' + files.coverImage[0].filename;
      }
      
      // Handle book file update
      if (files && files.bookFile && files.bookFile[0]) {
        const bookFile = files.bookFile[0];
        
        // Delete old book file if it exists
        if (book.filePath) {
          const oldBookPath = path.join(process.cwd(), book.filePath);
          if (fs.existsSync(oldBookPath)) {
            try {
              fs.unlinkSync(oldBookPath);
            } catch (error) {
              console.error("Error deleting old book file:", error);
              // Don't fail the update if old file deletion fails
            }
          }
        }
        
        // Save new book file path and metadata
        updateData.filePath = '/uploads/' + bookFile.filename;
        updateData.fileSize = bookFile.size;
        updateData.fileType = bookFile.mimetype;
      }
      
      // Validate required fields if provided
      if (updateData.title && !updateData.title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      if (updateData.author && !updateData.author.trim()) {
        return res.status(400).json({ error: "Author cannot be empty" });
      }
      if (updateData.publishedYear) {
        const currentYear = new Date().getFullYear();
        if (updateData.publishedYear < 1000 || updateData.publishedYear > currentYear) {
          return res.status(400).json({ error: `Year must be between 1000 and ${currentYear}` });
        }
      }
      
      const updatedBook = await storage.updateBookAdmin(id, updateData);
      
      console.log("Storage update result:", updatedBook);
      console.log("Final isActive value:", updatedBook?.isActive);
      
      if (!updatedBook) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(updatedBook);
    } catch (error) {
      console.error("Update book (admin) error:", error);
      res.status(500).json({ error: "Failed to update book" });
    }
  });
  
  // Admin: Delete book
  app.delete("/api/admin/books/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete book (admin) endpoint called");
    try {
      const { id } = req.params;
      
      // Get book details before deletion for file cleanup
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Delete the book and all related data from database
      const success = await storage.deleteBookAdmin(id);
      
      if (!success) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Delete physical files
      if (book.filePath) {
        const bookFilePath = path.join(process.cwd(), book.filePath);
        if (fs.existsSync(bookFilePath)) {
          try {
            fs.unlinkSync(bookFilePath);
          } catch (error) {
            console.error("Error deleting book file:", error);
            // Don't fail if file deletion fails
          }
        }
      }
      
      if (book.coverImageUrl) {
        const coverPath = path.join(process.cwd(), book.coverImageUrl);
        if (fs.existsSync(coverPath)) {
          try {
            fs.unlinkSync(coverPath);
          } catch (error) {
            console.error("Error deleting cover image:", error);
            // Don't fail if file deletion fails
          }
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete book (admin) error:", error);
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Rating system configuration endpoints
  app.get("/api/admin/rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.getRatingSystemConfig();
      res.json(config);
    } catch (error) {
      console.error("Error getting rating config:", error);
      res.status(500).json({ error: "Failed to get rating configuration" });
    }
  });

  app.put("/api/admin/rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const {
        algorithmType,
        priorMean,
        priorWeight,
        likesAlpha,
        likesMaxWeight,
        minTextWeight,
        timeDecayEnabled,
        timeDecayHalfLife,
      } = req.body;

      const config = await storage.updateRatingSystemConfig({
        algorithmType,
        priorMean,
        priorWeight,
        likesAlpha,
        likesMaxWeight,
        minTextWeight,
        timeDecayEnabled,
        timeDecayHalfLife,
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating rating config:", error);
      res.status(500).json({ error: "Failed to update rating configuration" });
    }
  });

  app.post("/api/admin/recalculate-ratings", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const result = await storage.recalculateAllBookRatings();
      res.json(result);
    } catch (error) {
      console.error("Error recalculating ratings:", error);
      res.status(500).json({ error: "Failed to recalculate ratings" });
    }
  });

  // User rating system configuration endpoints
  app.get("/api/admin/user-rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.getUserRatingConfig();
      res.json(config);
    } catch (error) {
      console.error("Error getting user rating config:", error);
      res.status(500).json({ error: "Failed to get user rating configuration" });
    }
  });

  app.put("/api/admin/user-rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.updateUserRatingConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error updating user rating config:", error);
      res.status(500).json({ error: "Failed to update user rating configuration" });
    }
  });

  app.post("/api/admin/recalculate-user-ratings", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const result = await storage.recalculateAllUserRatings();
      res.json(result);
    } catch (error) {
      console.error("Error recalculating user ratings:", error);
      res.status(500).json({ error: "Failed to recalculate user ratings" });
    }
  });
  
  // ========================================
  // MESSAGING SYSTEM ROUTES
  // ========================================
  
  // Send a private message
  app.post("/api/messages", authenticateToken, async (req, res) => {
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
          console.log('🟢 Created attachmentMetadata:', JSON.stringify(attachmentMetadata, null, 2));
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
      
      console.log('🟡 Calling createMessage with data:', JSON.stringify(messageData, null, 2));
      
      // Create message with attachments
      const message = await storage.createMessage(messageData);
      console.log('🟠 createMessage returned:', JSON.stringify(message, null, 2));
      
      // Log message structure for debugging
      console.log('🔵 Message structure keys:', Object.keys(message));
      console.log('🔵 Message sender data:', {
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        senderFullName: message.senderFullName
      });
      
      // Create enriched message object with sender information
      const enrichedMessage = {
        ...message,
        sender: {
          id: message.senderId,
          username: message.senderUsername,
          fullName: message.senderFullName,
          avatarUrl: message.senderAvatarUrl || null,
          rating: message.senderRating ? Number(message.senderRating) : undefined
        }
      };
      
      console.log('🟢 Enriched message for WebSocket:', {
        hasSender: !!enrichedMessage.sender,
        senderKeys: enrichedMessage.sender ? Object.keys(enrichedMessage.sender) : [],
        senderUsername: enrichedMessage.sender?.username,
        senderFullName: enrichedMessage.sender?.fullName
      });
      
      // Update file upload entity IDs with the message ID
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const uploadId of attachments) {
          await storage.updateFileUploadEntity(uploadId, 'message', message.id);
        }
      }
      
      // Update conversation's last message
      await storage.updateConversationLastMessage(conversation.id, message.id);
      
      // Broadcast new message via WebSocket
      const io = (app as any).io;
      if (io) {
        console.log('\x1b[35m%s\x1b[0m', '[WEBSOCKET] 📡 Emitting WebSocket events for new message');
        console.log('\x1b[35m%s\x1b[0m', `[WEBSOCKET] Sender: ${userId}, Recipient: ${recipientId}`);
        console.log('\x1b[35m%s\x1b[0m', `[WEBSOCKET] Conversation ID: ${conversation.id}`);
        
        // Send to conversation room
        const conversationRoom = `conversation:${conversation.id}`;
        console.log('\x1b[36m%s\x1b[0m', `[WEBSOCKET] Emitting 'message:new' to room: ${conversationRoom}`);
        
        // Use the same enriched message for consistency
        io.to(conversationRoom).emit('message:new', {
          message: enrichedMessage,
          conversationId: conversation.id
        });
        
        // Send notification to recipient's personal room
        const recipientRoom = `user:${recipientId}`;
        console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ Emitting 'notification:new' to room: ${recipientRoom}`);
        
        // ALSO send message:new to recipient's personal room for notifications
        console.log('\x1b[36m%s\x1b[0m', `[WEBSOCKET] 📩 ALSO emitting 'message:new' to recipient room: ${recipientRoom}`);
        
        io.to(recipientRoom).emit('message:new', {
          message: enrichedMessage,
          conversationId: conversation.id
        });
        const notificationData = {
          type: 'new_message',
          conversationId: conversation.id,
          senderId: userId
        };
        console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] Notification data: ${JSON.stringify(notificationData)}`);
        io.to(recipientRoom).emit('notification:new', notificationData);
        
        // Send unread count update to recipient
        await storage.sendUnreadCountUpdate(recipientId, io);
        
        // Check how many clients are in the recipient's room
        const sockets = await io.in(recipientRoom).fetchSockets();
        console.log('\x1b[33m%s\x1b[0m', `[WEBSOCKET] 👥 Number of clients in room '${recipientRoom}': ${sockets.length}`);
        if (sockets.length === 0) {
          console.log('\x1b[31m%s\x1b[0m', `[WEBSOCKET] ⚠️  WARNING: No clients connected to room '${recipientRoom}'!`);
        } else {
          console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ Event sent to ${sockets.length} client(s)`);
        }
      } else {
        console.log('\x1b[31m%s\x1b[0m', '[WEBSOCKET] ❌ ERROR: Socket.IO instance not found!');
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Get messages in a conversation
  app.get("/api/messages/conversation/:conversationId", authenticateToken, async (req, res) => {
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
      const io = (app as any).io;
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
  app.get("/api/messages/unread-count", authenticateToken, async (req, res) => {
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
  app.put("/api/messages/:messageId/read", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId } = req.params;
    
    try {
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Only recipient can mark as read
      if (message.recipientId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });
  
  // Get all conversations for a user
  app.get("/api/conversations", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    
    console.log("\n=== GET /api/conversations ===");
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
      console.log("=========================\n");
      
      // Add version header for debugging
      res.setHeader('X-API-Version', '2026-01-07-v2');
      res.json(conversations);
    } catch (error) {
      console.error("❌ Get conversations error:", error);
      res.status(500).json({ error: "Failed to retrieve conversations" });
    }
  });
  
  // Create a new conversation
  app.post("/api/conversations", authenticateToken, async (req, res) => {
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
  app.get("/api/conversations/:conversationId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { conversationId } = req.params;
    
    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify user is part of conversation
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Failed to retrieve conversation" });
    }
  });
  
  // Search users
  app.get("/api/users/search", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const users = await storage.searchUsers(q.trim());
      res.json(users);
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });
  
  // ========================================
  // GROUP MESSAGING ROUTES
  // ========================================
  
  // Create a group
  app.post("/api/groups", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { name, description, privacy, bookIds } = req.body;
    
    try {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Group name is required" });
      }
      
      // Create group
      const group = await storage.createGroup({
        name: name.trim(),
        description: description || null,
        creatorId: userId,
        privacy: privacy || 'public'
      });
      
      // Add creator as administrator
      await storage.addGroupMember(group.id, userId, 'administrator', userId);
      
      // Create default "General" channel
      await storage.createChannel({
        groupId: group.id,
        name: 'General',
        description: 'General discussion',
        creatorId: userId,
        displayOrder: 0
      });
      
      // Associate books if provided
      if (bookIds && Array.isArray(bookIds) && bookIds.length > 0) {
        for (const bookId of bookIds) {
          await storage.addBookToGroup(group.id, bookId);
        }
      }
      
      res.status(201).json(group);
    } catch (error) {
      console.error("Create group error:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });
  
  // Get user's groups
  app.get("/api/groups", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    
    try {
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error("Get groups error:", error);
      res.status(500).json({ error: "Failed to retrieve groups" });
    }
  });
  
  // Search public groups
  app.get("/api/groups/search", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const groups = await storage.searchGroups(q.trim());
      res.json(groups);
    } catch (error) {
      console.error("Search groups error:", error);
      res.status(500).json({ error: "Failed to search groups" });
    }
  });
  
  // Get group details
  app.get("/api/groups/:groupId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    
    try {
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Check if user is a member
      const isMember = await storage.isGroupMember(groupId, userId);
      if (!isMember && group.privacy === 'private') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get channels
      const channels = await storage.getGroupChannels(groupId);
      
      // Get members
      const members = await storage.getGroupMembers(groupId);
      
      // Get associated books
      const books = await storage.getGroupBooks(groupId);
      
      // Add member count
      const memberCount = members.length;
      
      res.json({ ...group, channels, members, books, memberCount });
    } catch (error) {
      console.error("Get group error:", error);
      res.status(500).json({ error: "Failed to retrieve group" });
    }
  });
  
  // Update group
  app.put("/api/groups/:groupId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    const { name, description, privacy, bookIds } = req.body;
    
    try {
      // Check if user is admin
      const role = await storage.getGroupMemberRole(groupId, userId);
      if (role !== 'administrator') {
        return res.status(403).json({ error: "Only administrators can update group settings" });
      }
      
      const group = await storage.updateGroup(groupId, {
        name,
        description,
        privacy
      });
      
      // Update book associations if provided
      if (bookIds !== undefined) {
        // Remove all existing associations
        await storage.removeAllGroupBooks(groupId);
        
        // Add new associations
        if (Array.isArray(bookIds) && bookIds.length > 0) {
          for (const bookId of bookIds) {
            await storage.addGroupBook(groupId, bookId);
          }
        }
      }
      
      res.json(group);
    } catch (error) {
      console.error("Update group error:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  });
  
  // Delete group
  app.delete("/api/groups/:groupId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    
    try {
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Only creator can delete
      if (group.creatorId !== userId) {
        return res.status(403).json({ error: "Only the group creator can delete the group" });
      }
      
      await storage.deleteGroup(groupId);
      res.status(204).send();
    } catch (error) {
      console.error("Delete group error:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  });
  
  // Add member to group
  // ========================================
  // GROUP MEMBERSHIP ROUTES
  // ========================================
  
  // Join a public group (self-service)
  app.post("/api/groups/:groupId/join", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    
    try {
      console.log(`User ${userId} attempting to join group ${groupId}`);
      
      // Check if group exists and is public
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      console.log(`Group found: ${group.name}, privacy: ${group.privacy}`);
      
      if (group.privacy === 'private') {
        return res.status(403).json({ error: "Cannot join private groups without invitation" });
      }
      
      // Check if already a member
      const isMember = await storage.isGroupMember(groupId, userId);
      if (isMember) {
        console.log(`User ${userId} is already a member of group ${groupId}`);
        return res.json({ success: true, message: "Already a member" });
      }
      
      // Add user as member
      await storage.addGroupMember(groupId, userId, 'member', null);
      console.log(`User ${userId} successfully joined group ${groupId}`);
      
      res.status(201).json({ success: true, message: "Joined group successfully" });
    } catch (error) {
      console.error("Join group error:", error);
      res.status(500).json({ error: "Failed to join group" });
    }
  });
  
  // Add member to group (by admin/moderator)
  app.post("/api/groups/:groupId/members", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    const { userId: newMemberId } = req.body;
    
    console.log('Add member request:', { groupId, requesterId: userId, newMemberId, body: req.body });
    
    try {
      // Validate input
      if (!newMemberId) {
        console.log('Validation failed: No userId provided');
        return res.status(400).json({ error: "Не указан ID пользователя" });
      }
      
      // Check if requester is admin or moderator
      const role = await storage.getGroupMemberRole(groupId, userId);
      console.log('Requester role:', role);
      if (role !== 'administrator' && role !== 'moderator') {
        console.log('Permission denied: role is', role);
        return res.status(403).json({ error: "Недостаточно прав для добавления участников" });
      }
      
      // Check if user is already a member
      const isMember = await storage.isGroupMember(groupId, newMemberId);
      console.log('Is already member:', isMember);
      if (isMember) {
        return res.status(400).json({ error: "Пользователь уже в группе" });
      }
      
      // Check if user exists
      const userExists = await storage.getUser(newMemberId);
      console.log('User exists:', !!userExists);
      if (!userExists) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      console.log('Adding member to group...');
      await storage.addGroupMember(groupId, newMemberId, 'member', userId);
      console.log('Member added successfully');
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Add group member error:", error);
      res.status(500).json({ error: "Не удалось добавить участника" });
    }
  });
  
  // Remove member from group
  app.delete("/api/groups/:groupId/members/:memberId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, memberId } = req.params;
    
    try {
      const requesterRole = await storage.getGroupMemberRole(groupId, userId);
      
      // Get the member to be removed to check their role
      const members = await storage.getGroupMembers(groupId);
      const memberToRemove = members.find(m => m.id === memberId);
      
      if (!memberToRemove) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      // Moderators can't remove admins
      if (requesterRole === 'moderator' && memberToRemove.role === 'administrator') {
        return res.status(403).json({ error: "Moderators cannot remove administrators" });
      }
      
      // Only admins and moderators can remove members
      if (requesterRole !== 'administrator' && requesterRole !== 'moderator') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      await storage.removeGroupMember(groupId, memberId);
      res.status(204).send();
    } catch (error) {
      console.error("Remove group member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });
  
  // Update member role
  app.put("/api/groups/:groupId/members/:memberId/role", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, memberId } = req.params;
    const { role } = req.body;
    
    try {
      // Only administrators can change roles
      const requesterRole = await storage.getGroupMemberRole(groupId, userId);
      if (requesterRole !== 'administrator') {
        return res.status(403).json({ error: "Only administrators can change member roles" });
      }
      
      if (!['member', 'moderator', 'administrator'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Get the member's userId from memberId
      const members = await storage.getGroupMembers(groupId);
      const targetMember = members.find(m => m.id === memberId);
      
      if (!targetMember) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const updatedMember = await storage.updateGroupMemberRole(groupId, targetMember.userId, role);
      
      if (!updatedMember) {
        return res.status(500).json({ error: "Failed to update role" });
      }
      
      res.json({ success: true, member: updatedMember });
    } catch (error) {
      console.error("Update member role error:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });
  
  // Get group members
  app.get("/api/groups/:groupId/members", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    
    try {
      // Check if user has access
      const isMember = await storage.isGroupMember(groupId, userId);
      const group = await storage.getGroup(groupId);
      
      if (!isMember && group?.privacy === 'private') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      let members = await storage.getGroupMembers(groupId);
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        members = members.filter(m => 
          m.username?.toLowerCase().includes(searchLower) ||
          m.fullName?.toLowerCase().includes(searchLower)
        );
      }
      
      // Calculate pagination
      const total = members.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      
      // Slice for current page
      const paginatedMembers = members.slice(offset, offset + limit);
      
      res.json({
        members: paginatedMembers,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      });
    } catch (error) {
      console.error("Get group members error:", error);
      res.status(500).json({ error: "Failed to retrieve members" });
    }
  });
  
  // Get user's role in group
  app.get("/api/groups/:groupId/my-role", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    
    try {
      const role = await storage.getGroupMemberRole(groupId, userId);
      if (!role) {
        return res.status(404).json({ error: "User is not a member of this group" });
      }
      
      res.json({ role });
    } catch (error) {
      console.error("Get user group role error:", error);
      res.status(500).json({ error: "Failed to retrieve role" });
    }
  });
  
  // ========================================
  // CHANNEL ROUTES
  // ========================================
  
  // Create channel
  app.post("/api/groups/:groupId/channels", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    const { name, description } = req.body;
    
    try {
      // Check if user is admin or moderator
      const role = await storage.getGroupMemberRole(groupId, userId);
      if (role !== 'administrator' && role !== 'moderator') {
        return res.status(403).json({ error: "Only administrators and moderators can create channels" });
      }
      
      // Get max display order
      const channels = await storage.getGroupChannels(groupId);
      const maxOrder = channels.reduce((max, ch) => Math.max(max, ch.displayOrder || 0), 0);
      
      const channel = await storage.createChannel({
        groupId,
        name,
        description,
        creatorId: userId,
        displayOrder: maxOrder + 1
      });
      
      res.status(201).json(channel);
    } catch (error) {
      console.error("Create channel error:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  });
  
  // Get group channels
  app.get("/api/groups/:groupId/channels", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId } = req.params;
    
    try {
      const isMember = await storage.isGroupMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const channels = await storage.getGroupChannels(groupId);
      res.json(channels);
    } catch (error) {
      console.error("Get channels error:", error);
      res.status(500).json({ error: "Failed to retrieve channels" });
    }
  });
  
  // Update channel
  app.put("/api/groups/:groupId/channels/:channelId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, channelId } = req.params;
    const { name, description } = req.body;
    
    try {
      const role = await storage.getGroupMemberRole(groupId, userId);
      if (role !== 'administrator' && role !== 'moderator') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const channel = await storage.updateChannel(channelId, { name, description });
      res.json(channel);
    } catch (error) {
      console.error("Update channel error:", error);
      res.status(500).json({ error: "Failed to update channel" });
    }
  });
  
  // Delete channel
  app.delete("/api/groups/:groupId/channels/:channelId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, channelId } = req.params;
    
    try {
      const role = await storage.getGroupMemberRole(groupId, userId);
      if (role !== 'administrator' && role !== 'moderator') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      await storage.deleteChannel(channelId);
      res.status(204).send();
    } catch (error) {
      console.error("Delete channel error:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });
  
  // Get channel messages
  app.get("/api/groups/:groupId/channels/:channelId/messages", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, channelId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    try {
      const isMember = await storage.isGroupMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const messages = await storage.getChannelMessages(channelId, limit, offset);
      res.json(messages);
    } catch (error) {
      console.error("Get channel messages error:", error);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });
  
  // Mark channel as read (update user's last read timestamp)
  app.put("/api/groups/:groupId/channels/:channelId/mark-read", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, channelId } = req.params;
    
    try {
      const isMember = await storage.isGroupMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Update or create read position record for this user and channel
      await storage.upsertChannelReadPosition(userId, channelId);
      
      console.log(`User ${userId} marked channel ${channelId} in group ${groupId} as read`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark channel as read error:", error);
      res.status(500).json({ error: "Failed to mark channel as read" });
    }
  });
  
  // Post message to channel
  app.post("/api/groups/:groupId/channels/:channelId/messages", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { groupId, channelId } = req.params;
    const { content, attachments, quotedMessageId, quotedText } = req.body;
    
    try {
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      // Check if user is a member of the group
      const isMember = await storage.isGroupMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Process attachments if provided
      let attachmentMetadata = null;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const uploadedAttachments = [];
        for (const uploadId of attachments) {
          const fileUpload = await storage.getFileUpload(uploadId);
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
        }
      }
      
      // Create message in channel with attachments and quote data
      const messageData: any = {
        senderId: userId,
        channelId,
        content: content.trim(),
        readStatus: false,
        attachmentMetadata
      };
      
      // Add quote data if provided
      if (quotedMessageId) {
        messageData.quotedMessageId = quotedMessageId;
        messageData.quotedText = quotedText || null;
      }
      
      const message = await storage.createMessage(messageData);
      
      // Get WebSocket instance
      const io = (app as any).io;
      
      // Update file upload entity IDs with the message ID
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const uploadId of attachments) {
          await storage.updateFileUploadEntity(uploadId, 'message', message.id);
        }
      }
      
      // Log action for public group messages
      try {
        const group = await storage.getGroup(groupId);
        if (group && group.privacy === 'public') {
          await logGroupMessageAction(
            userId,
            groupId,
            group.name,
            content.trim(),
            io
          );
        }
      } catch (actionLogError) {
        console.error('[Action Logging] Failed to log group message action:', actionLogError);
        // Don't fail the request if action logging fails
      }
      
      // Broadcast message via WebSocket
      if (io) {
        io.to(`channel_${channelId}`).emit('channel:message:new', {
          message,
          channelId,
          groupId
        });
        
        // Send unread count updates to all group members (except sender)
        const groupMembers = await storage.getGroupMembers(groupId);
        for (const member of groupMembers) {
          if (member.userId !== userId) {
            await storage.sendUnreadCountUpdate(member.userId, io);
          }
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Post channel message error:", error);
      res.status(500).json({ error: "Failed to post message" });
    }
  });
  
  // ========================================
  // MESSAGE REACTIONS ROUTES
  // ========================================
  
  // Add reaction to message
  app.post("/api/messages/:messageId/reactions", authenticateToken, async (req, res) => {
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
      const io = (app as any).io;
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
  app.delete("/api/messages/:messageId/reactions/:reactionId", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { messageId, reactionId } = req.params;
    
    try {
      // Get message to determine where to broadcast
      const message = await storage.getMessage(messageId);
      
      await storage.removeMessageReaction(reactionId, userId);
      
      // Broadcast reaction removal via WebSocket
      const io = (app as any).io;
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
  app.get("/api/messages/:messageId/reactions", authenticateToken, async (req, res) => {
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
  app.delete("/api/messages/:messageId", authenticateToken, async (req, res) => {
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
      const io = (app as any).io;
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
  
  // ========================================
  // NOTIFICATIONS ROUTES
  // ========================================
  
  // Get user notifications
  app.get("/api/notifications", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    
    try {
      const notifications = await storage.getUserNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to retrieve notifications" });
    }
  });
  
  // Mark notification as read
  app.put("/api/notifications/:notificationId/read", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    const { notificationId } = req.params;
    
    try {
      await storage.markNotificationAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });
  
  // Mark all notifications as read
  app.put("/api/notifications/read-all", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    
    try {
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
  
  // ========================================
  // FILE UPLOAD ROUTES
  // ========================================
  
  // Configure multer for attachment uploads
  const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'attachments', 'temp');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${uniqueSuffix}-${sanitizedFilename}`);
    }
  });
  
  const attachmentUpload = multer({
    storage: attachmentStorage,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Invalid file type');
        (error as any).code = 'INVALID_FILE_TYPE';
        cb(error);
      }
    }
  });
  
  // Upload attachment
  app.post("/api/uploads", authenticateToken, attachmentUpload.single('file'), async (req, res) => {
    const userId = (req as any).user.userId;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/attachments/temp/${req.file.filename}`;
      
      // Create file upload record
      const uploadRecord = await storage.createFileUpload({
        uploaderId: userId,
        fileUrl: fileUrl,
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        entityType: 'temp', // Will be updated when attached to message/comment
        entityId: null
      });
      
      // Generate thumbnail for images (except GIFs to preserve animation)
      let thumbnailUrl = null;
      if (req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/gif') {
        try {
          const sharp = require('sharp');
          const thumbnailPath = path.join(path.dirname(req.file.path), `thumb_${req.file.filename}`);
          await sharp(req.file.path)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbnailPath);
          thumbnailUrl = `/uploads/attachments/temp/thumb_${req.file.filename}`;
          
          // Update record with thumbnail
          await storage.updateFileUploadThumbnail(uploadRecord.id, thumbnailUrl);
        } catch (error) {
          console.error('Thumbnail generation error:', error);
        }
      }
      
      res.json({
        uploadId: uploadRecord.id,
        url: fileUrl,
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        thumbnailUrl
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
  
  // Download/view attachment
  app.get("/api/uploads/:uploadId", authenticateToken, async (req, res) => {
    const { uploadId } = req.params;
    const userId = (req as any).user.userId;
    
    try {
      const fileUpload = await storage.getFileUpload(uploadId);
      
      if (!fileUpload) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Check if file is deleted
      if (fileUpload.deletedAt) {
        return res.status(410).json({ error: "File has been deleted" });
      }
      
      // Verify access permissions
      const hasAccess = await storage.verifyFileAccess(uploadId, userId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Send file
      if (!fs.existsSync(fileUpload.storagePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      
      res.setHeader('Content-Type', fileUpload.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileUpload.filename}"`);
      res.sendFile(fileUpload.storagePath);
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });
  
  // Delete attachment
  app.delete("/api/uploads/:uploadId", authenticateToken, async (req, res) => {
    const { uploadId } = req.params;
    const userId = (req as any).user.userId;
    
    try {
      const fileUpload = await storage.getFileUpload(uploadId);
      
      if (!fileUpload) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only uploader or admin/moderator can delete
      const user = await storage.getUser(userId);
      const canDelete = fileUpload.uploaderId === userId || 
                       user?.accessLevel === 'admin' || 
                       user?.accessLevel === 'moder';
      
      if (!canDelete) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Soft delete
      await storage.softDeleteFileUpload(uploadId, userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("File delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });
  
  // Stream endpoints
  // Get global activity stream
  app.get("/api/stream/global", async (req, res) => {
    console.log("Get global stream endpoint called");
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const before = req.query.before as string;
      
      const activities = await storage.getGlobalActivities(limit, offset, before);
      res.json(activities);
    } catch (error) {
      console.error("Get global stream error:", error);
      res.status(500).json({ error: "Failed to get global stream" });
    }
  });
  
  // Get personal activity stream
  app.get("/api/stream/personal", authenticateToken, async (req, res) => {
    console.log("Get personal stream endpoint called");
    try {
      const userId = (req as any).user.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const before = req.query.before as string;
      
      const activities = await storage.getPersonalActivities(userId, limit, offset, before);
      res.json(activities);
    } catch (error) {
      console.error("Get personal stream error:", error);
      res.status(500).json({ error: "Failed to get personal stream" });
    }
  });
  
  // Get shelf activity stream
  app.get("/api/stream/shelves", authenticateToken, async (req, res) => {
    console.log("Get shelf stream endpoint called");
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
      console.error("Get shelf stream error:", error);
      res.status(500).json({ error: "Failed to get shelf stream" });
    }
  });
  
  // Get user shelves with books for filtering
  app.get("/api/stream/shelves/filters", authenticateToken, async (req, res) => {
    console.log("Get shelf filters endpoint called");
    try {
      const userId = (req as any).user.userId;
      const data = await storage.getUserShelvesWithBooks(userId);
      res.json(data);
    } catch (error) {
      console.error("Get shelf filters error:", error);
      res.status(500).json({ error: "Failed to get shelf filters" });
    }
  });
  
  // Get last actions stream (includes global activities + navigation actions)
  app.get("/api/stream/last-actions", async (req, res) => {
    console.log("Get last actions endpoint called");
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
      console.error("Get last actions error:", error);
      res.status(500).json({ error: "Failed to get last actions" });
    }
  });
  
  // Admin: Soft delete activity
  app.delete("/api/stream/activities/:entityId", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete activity endpoint called");
    try {
      const { entityId } = req.params;
      
      if (!entityId) {
        return res.status(400).json({ error: "Entity ID is required" });
      }
      
      // Try to find and delete the entity from different tables using storage methods
      // Check if it's a comment
      const comment = await storage.getCommentById(entityId);
      if (comment) {
        console.log("Deleting comment:", entityId);
        const deleted = await storage.deleteComment(entityId, null); // null = admin override
        if (deleted) {
          // Broadcast deletion via WebSocket
          try {
            if ((app as any).io) {
              const io = (app as any).io;
              console.log('[STREAM] Broadcasting comment deletion from stream:', entityId);
              io.to('stream:global').emit('stream:activity-deleted', { entityId });
            }
          } catch (streamError) {
            console.error('[STREAM] Failed to broadcast comment deletion:', streamError);
          }
          
          return res.json({ success: true, type: 'comment' });
        }
      }
      
      // Check if it's a review
      // Note: We need to check existence first because deleteReview might return true even if not found
      try {
        const reviewDeleted = await storage.deleteReview(entityId, null); // null = admin override
        if (reviewDeleted) {
          console.log("Deleted review:", entityId);
          
          // Broadcast deletion via WebSocket
          try {
            if ((app as any).io) {
              const io = (app as any).io;
              console.log('[STREAM] Broadcasting review deletion from stream:', entityId);
              io.to('stream:global').emit('stream:activity-deleted', { entityId });
            }
          } catch (streamError) {
            console.error('[STREAM] Failed to broadcast review deletion:', streamError);
          }
          
          return res.json({ success: true, type: 'review' });
        }
      } catch (reviewError) {
        // Review not found, continue
      }
      
      // Check if it's a news item - VERIFY EXISTENCE FIRST
      const newsItem = await storage.getNews(entityId);
      if (newsItem) {
        console.log("Deleting news:", entityId);
        await storage.deleteNews(entityId);
        
        // Broadcast deletion via WebSocket
        try {
          if ((app as any).io) {
            const io = (app as any).io;
            console.log('[STREAM] Broadcasting news deletion from stream:', entityId);
            io.to('stream:global').emit('stream:activity-deleted', { entityId });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast news deletion:', streamError);
        }
        
        return res.json({ success: true, type: 'news' });
      }
      
      // Check if it's a book - VERIFY EXISTENCE FIRST
      const book = await storage.getBook(entityId);
      if (book) {
        console.log("Deleting book:", entityId);
        const deleted = await storage.deleteBookAdmin(entityId);
        if (deleted) {
          console.log("Deleted book:", entityId);
          
          // Broadcast deletion via WebSocket
          try {
            if ((app as any).io) {
              const io = (app as any).io;
              console.log('[STREAM] Broadcasting book deletion from stream:', entityId);
              io.to('stream:global').emit('stream:activity-deleted', { entityId });
            }
          } catch (streamError) {
            console.error('[STREAM] Failed to broadcast book deletion:', streamError);
          }
          
          return res.json({ success: true, type: 'book' });
        }
      }
      
      // Check if it's a user action
      const userActionDeleted = await storage.deleteUserAction(entityId);
      if (userActionDeleted) {
        console.log("Deleted user action:", entityId);
        
        // Broadcast deletion via WebSocket to both global and last-actions rooms
        try {
          if ((app as any).io) {
            const io = (app as any).io;
            console.log('[STREAM] Broadcasting user action deletion from stream:', entityId);
            io.to('stream:global').emit('stream:activity-deleted', { entityId });
            io.to('stream:last-actions').emit('stream:activity-deleted', { entityId });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast user action deletion:', streamError);
        }
        
        return res.json({ success: true, type: 'user_action' });
      }
      
      // Entity not found in any table
      console.log("Entity not found:", entityId);
      return res.status(404).json({ error: "Entity not found" });
    } catch (error) {
      console.error("Delete activity error:", error);
      res.status(500).json({ error: "Failed to delete activity", details: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Admin: Update activity metadata
  // NOTE: Activities are virtual entities generated from real data (comments, reviews, news)
  // To update an activity, update the underlying entity directly
  app.put("/api/stream/activities/:entityId", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update activity endpoint called");
    try {
      const { entityId } = req.params;
      const { metadata } = req.body;
      
      if (!entityId) {
        return res.status(400).json({ error: "Entity ID is required" });
      }
      
      if (!metadata) {
        return res.status(400).json({ error: "Metadata is required" });
      }
      
      // Activities are virtual - they don't have separate metadata
      // To update activity metadata, you need to update the underlying entity (comment, review, or news)
      return res.status(501).json({ 
        error: "Not implemented", 
        message: "Activities are virtual entities. Update the underlying comment, review, or news item directly." 
      });
    } catch (error) {
      console.error("Update activity error:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  // ========== Profile Rating Endpoints ==========

  // Create or update a profile rating
  app.post("/api/profile/:profileId/rating", authenticateToken, async (req, res) => {
    console.log("Create/update profile rating endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { profileId } = req.params;
      const { rating } = req.body;
      
      // Validate rating
      if (rating === undefined || rating === null) {
        return res.status(400).json({ error: "Rating is required" });
      }
      
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 10" });
      }
      
      // Prevent self-rating
      if (userId === profileId) {
        return res.status(400).json({ error: "You cannot rate your own profile" });
      }
      
      const result = await storage.createProfileRating({
        userId,
        profileId,
        rating
      });
      
      // Log profile rating action and broadcast via WebSocket
      try {
        if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
          console.log('[Profile Rating] Creating user action for profile rating event');
          const action = await storage.createUserAction({
            userId: userId,
            actionType: 'profile_rating',
            targetType: 'user',
            targetId: profileId,
            metadata: { 
              rating: rating
            }
          });
          console.log('[Profile Rating] User action created:', action?.id);
          
          // Broadcast profile rating event via WebSocket
          if ((app as any).io && action) {
            const io = (app as any).io;
            console.log('[Profile Rating] Broadcasting profile rating event');
            
            // Get user info for broadcast
            const user = await storage.getUser(userId);
            const targetUser = await storage.getUser(profileId);
            
            const eventData = {
              id: action.id,
              type: 'user_action',
              action_type: action.actionType,
              entityId: action.id,
              userId: userId,
              user: {
                id: userId,
                username: user?.username || 'Unknown',
                avatar_url: user?.avatarUrl || null
              },
              target: {
                type: 'user',
                id: profileId,
                username: targetUser?.username || 'Unknown'
              },
              metadata: action.metadata,
              createdAt: action.createdAt,
              timestamp: action.createdAt.toISOString()
            };
            
            // Broadcast to last-actions room
            io.to('stream:last-actions').emit('stream:last-action', eventData);
            console.log('[Profile Rating] ✅ Profile rating event broadcasted');
          }
        }
      } catch (actionError) {
        console.error('[Profile Rating] Failed to log user action or broadcast event:', actionError);
        // Don't fail profile rating creation if action logging fails
      }
      
      res.json(result);
    } catch (error) {
      console.error("Create profile rating error:", error);
      res.status(500).json({ error: "Failed to create profile rating" });
    }
  });

  // Get all ratings for a profile
  app.get("/api/profile/:profileId/ratings", async (req, res) => {
    console.log("Get profile ratings endpoint called");
    try {
      const { profileId } = req.params;
      
      const ratings = await storage.getProfileRatings(profileId);
      
      res.json(ratings);
    } catch (error) {
      console.error("Get profile ratings error:", error);
      res.status(500).json({ error: "Failed to get profile ratings" });
    }
  });

  // Delete a profile rating
  app.delete("/api/profile/rating/:ratingId", authenticateToken, async (req, res) => {
    console.log("Delete profile rating endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { ratingId } = req.params;
      const user = (req as any).user;
      
      // Allow deletion by owner or admin/moderator
      const isAdminOrModer = user.accessLevel === 'admin' || user.accessLevel === 'moder';
      const userIdToPass = isAdminOrModer ? null : userId;
      
      const success = await storage.deleteProfileRating(ratingId, userIdToPass);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Rating not found" });
      }
    } catch (error) {
      console.error("Delete profile rating error:", error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        res.status(403).json({ error: "You can only delete your own ratings" });
      } else {
        res.status(500).json({ error: "Failed to delete profile rating" });
      }
    }
  });

  // ========== Profile Comment Endpoints ==========

  // Create or update a profile comment
  app.post("/api/profile/:profileId/comment", authenticateToken, async (req, res) => {
    console.log("Create/update profile comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { profileId } = req.params;
      const { content, attachments, parentCommentId, quotedText } = req.body;
      
      // Validate content
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Allow self-commenting (removed restriction)
      
      // Process attachments if provided
      let attachmentMetadata = null;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const uploadedAttachments = [];
        for (const uploadId of attachments) {
          const fileUpload = await storage.getFileUpload(uploadId);
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
        }
      }
      
      const comment = await storage.createProfileComment({
        userId,
        profileId,
        content,
        attachments: attachmentMetadata,
        parentCommentId: parentCommentId || undefined,
        quotedText: quotedText || undefined,
      });
      
      // Log profile comment action and broadcast via WebSocket
      try {
        // Get user info early for metadata
        const user = await storage.getUser(userId);
        
        if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
          console.log('[Profile Comment] Creating user action for profile comment event');
          console.log('[Profile Comment] Input data:', { userId, profileId, content, parentCommentId });
          
          const action = await storage.createUserAction({
            userId: userId,
            actionType: parentCommentId ? 'profile_comment_reply' : 'profile_comment',
            targetType: 'user',
            targetId: profileId,
            metadata: { 
              content: content,
              comment_preview: content.substring(0, 100),
              author_name: user?.username || user?.fullName || 'Unknown',
              is_reply: !!parentCommentId
            }
          });
          
          console.log('[Profile Comment] Created action:', {
            id: action?.id,
            actionType: action?.actionType,
            metadata: action?.metadata
          });
          
          // Broadcast profile comment event via WebSocket
          if ((app as any).io && action) {
            const io = (app as any).io;
            console.log('[Profile Comment] Broadcasting profile comment event');
            
            // Get target user info for broadcast
            const targetUser = await storage.getUser(profileId);
            
            const eventData = {
              id: action.id,
              type: 'user_action',
              action_type: action.actionType,
              entityId: action.id,
              userId: userId,
              user: {
                id: userId,
                username: user?.username || 'Unknown',
                avatar_url: user?.avatarUrl || null
              },
              target: {
                type: 'user',
                id: profileId,
                username: targetUser?.username || 'Unknown'
              },
              metadata: {
                ...action.metadata,
                // Ensure complete metadata for WebSocket broadcast
                content: content,
                content_preview: content.substring(0, 100),
                comment_preview: content.substring(0, 100),
                author_name: user?.username || user?.fullName || 'Unknown',
                author_avatar: user?.avatarUrl || null,
                is_reply: !!parentCommentId
              },
              createdAt: action.createdAt,
              timestamp: action.createdAt.toISOString()
            };
            
            // Broadcast to last-actions room
            io.to('stream:last-actions').emit('stream:last-action', eventData);
            console.log('[Profile Comment] ✅ Profile comment event broadcasted');
            console.log('[Profile Comment] Broadcast metadata:', {
              content: eventData.metadata?.content,
              content_preview: eventData.metadata?.content_preview,
              comment_preview: eventData.metadata?.comment_preview,
              author_name: eventData.metadata?.author_name
            });
          }
        }
      } catch (actionError) {
        console.error('[Profile Comment] Failed to log user action or broadcast event:', actionError);
        // Don't fail profile comment creation if action logging fails
      }
      
      res.json(comment);
    } catch (error) {
      console.error("Create profile comment error:", error);
      res.status(500).json({ error: "Failed to create profile comment" });
    }
  });

  // Get user activity feed
  app.get("/api/profile/:profileId/activities", optionalAuthenticateToken, async (req, res) => {
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

  // Get paginated comments for a profile
  app.get("/api/profile/:profileId/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get profile comments endpoint called");
    try {
      const { profileId } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = (req as any).user?.userId;
      
      // Use direct PostgreSQL implementation
      const result = await getProfileCommentsDirect(profileId, {
        limit,
        offset,
        currentUserId: userId
      });
      
      const totalPages = Math.ceil(result.total / limit);
      
      res.json({
        comments: result.comments,
        total: result.total,
        limit,
        offset,
        totalPages
      });
    } catch (error) {
      console.error("Get profile comments error:", error);
      res.status(500).json({ error: "Failed to get profile comments" });
    }
  });

  // Update a profile comment
  app.put("/api/profile/comment/:commentId", authenticateToken, async (req, res) => {
    console.log("Update profile comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { commentId } = req.params;
      const { content } = req.body;
      
      // Validate content
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Check ownership
      const comment = await db.select()
        .from(profileComments)
        .where(eq(profileComments.id, commentId))
        .limit(1);
      
      if (comment.length === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      if (comment[0].userId !== userId) {
        return res.status(403).json({ error: "You can only update your own comments" });
      }
      
      const updated = await storage.updateProfileComment(commentId, content);
      
      res.json(updated);
    } catch (error) {
      console.error("Update profile comment error:", error);
      res.status(500).json({ error: "Failed to update profile comment" });
    }
  });

  // Delete a profile comment
  app.delete("/api/profile/comment/:commentId", authenticateToken, async (req, res) => {
    console.log("Delete profile comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { commentId } = req.params;
      const user = (req as any).user;
      
      // Allow deletion by owner or admin/moderator
      const isAdminOrModer = user.accessLevel === 'admin' || user.accessLevel === 'moder';
      const userIdToPass = isAdminOrModer ? null : userId;
      
      const success = await storage.deleteProfileComment(commentId, userIdToPass);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Comment not found" });
      }
    } catch (error) {
      console.error("Delete profile comment error:", error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        res.status(403).json({ error: "You can only delete your own comments" });
      } else {
        res.status(500).json({ error: "Failed to delete profile comment" });
      }
    }
  });

  // ========== Profile Comment Reaction Endpoints ==========

  // Toggle reaction on a profile comment
  app.post("/api/profile/comment/:commentId/reaction", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { commentId } = req.params;
      const { emoji } = req.body;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Check if user already reacted with this emoji
      const existingReactions = await storage.getProfileCommentReactions(commentId, userId);
      const alreadyReacted = existingReactions.some(r => r.emoji === emoji && r.userReacted);
      
      let action: 'added' | 'removed';
      if (alreadyReacted) {
        await storage.removeProfileCommentReaction(userId, commentId, emoji);
        action = 'removed';
      } else {
        await storage.addProfileCommentReaction(userId, commentId, emoji);
        action = 'added';
        
        // Get updated reactions to include total count
        const updatedReactionsForCount = await storage.getProfileCommentReactions(commentId, userId);
        const totalReactionCount = updatedReactionsForCount.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            // Get the profile comment info
            const commentResult = await db.select({
              id: profileComments.id,
              userId: profileComments.userId,
              profileId: profileComments.profileId,
              content: profileComments.content
            })
            .from(profileComments)
            .where(eq(profileComments.id, commentId))
            .limit(1);
            
            if (commentResult.length > 0) {
              const comment = commentResult[0];
              const profileOwner = await storage.getUser(comment.profileId);
              const commentAuthor = await storage.getUser(comment.userId);
              
              const actionData = {
                userId: userId,
                actionType: 'profile_comment_reaction',
                targetType: 'user',
                targetId: comment.profileId,
                metadata: { 
                  emoji: emoji,
                  comment_id: commentId,
                  comment_preview: comment.content.substring(0, 50),
                  comment_author: commentAuthor?.username || 'Unknown',
                  profile_username: profileOwner?.username || 'Unknown',
                  total_reactions: totalReactionCount
                }
              };
              
              const userAction = await storage.createUserAction(actionData);
              
              if ((app as any).io && userAction) {
                const io = (app as any).io;
                const user = await storage.getUser(userId);
                
                const eventData = {
                  id: userAction.id,
                  type: 'user_action',
                  action_type: userAction.actionType,
                  entityId: userAction.id,
                  userId: userId,
                  user: {
                    id: userId,
                    username: user?.username || 'Unknown',
                    avatar_url: user?.avatarUrl || null
                  },
                  target: {
                    type: 'user',
                    id: comment.profileId,
                    username: profileOwner?.username || 'Unknown',
                    full_name: profileOwner?.fullName || null
                  },
                  metadata: userAction.metadata,
                  createdAt: userAction.createdAt,
                  timestamp: userAction.createdAt.toISOString()
                };
                
                io.to('stream:last-actions').emit('stream:last-action', eventData);
              }
            }
          }
        } catch (actionError) {
          console.error('[Profile Comment Reaction] Failed to log action:', actionError);
        }
      }
      
      // Get updated reactions
      const reactions = await storage.getProfileCommentReactions(commentId, userId);
      
      res.json({ action, reactions });
    } catch (error) {
      console.error("Toggle profile comment reaction error:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });

  // Get reactions for a profile comment
  app.get("/api/profile/comment/:commentId/reactions", async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.headers.authorization ? 
        (req as any).user?.userId : undefined;
      
      const reactions = await storage.getProfileCommentReactions(commentId, userId);
      
      res.json(reactions);
    } catch (error) {
      console.error("Get profile comment reactions error:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  });

  // Get replies for a profile comment (threaded/nested)
  app.get("/api/profile/comment/:commentId/replies", optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.userId;
      
      const replies = await storage.getCommentReplies(commentId, userId);
      
      res.json(replies);
    } catch (error) {
      console.error("Get comment replies error:", error);
      res.status(500).json({ error: "Failed to get replies" });
    }
  });
  
  // Track bookmark click (increment click count)
  app.post("/api/bookmarks/:bookmarkId/click", authenticateToken, async (req, res) => {
    try {
      const { bookmarkId } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify bookmark exists and belongs to user
      const bookmark = await db.select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.id, bookmarkId),
          eq(bookmarks.userId, userId)
        ));
      
      if (bookmark.length === 0) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      
      // Increment click count
      const result = await db.update(bookmarks)
        .set({ clickCount: sql`${bookmarks.clickCount} + 1` })
        .where(eq(bookmarks.id, bookmarkId))
        .returning();
      
      res.json({ success: true, clickCount: result[0].clickCount });
    } catch (error) {
      console.error("Error tracking bookmark click:", error);
      res.status(500).json({ error: "Failed to track bookmark click" });
    }
  });
  
  // Get collection statistics
  app.get("/api/bookmark-collections/:id/stats", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify collection exists and user has access
      const collection = await db.select({
        id: bookmarkCollections.id,
        viewCount: bookmarkCollections.viewCount,
        userId: bookmarkCollections.userId,
        isPublic: bookmarkCollections.isPublic
      })
      .from(bookmarkCollections)
      .where(and(
        eq(bookmarkCollections.id, id),
        or(
          eq(bookmarkCollections.userId, userId),
          eq(bookmarkCollections.isPublic, true)
        )
      ));
      
      if (collection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Get bookmark click statistics
      const bookmarkStats = await db.select({
        totalClicks: sql`COALESCE(SUM(${bookmarks.clickCount}), 0)`.mapWith(Number),
        bookmarkCount: sql`COUNT(*)`.mapWith(Number)
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .where(eq(bookmarkCollectionItems.collectionId, id));
      
      res.json({
        viewCount: collection[0].viewCount || 0,
        totalBookmarkClicks: bookmarkStats[0].totalClicks || 0,
        bookmarkCount: bookmarkStats[0].bookmarkCount || 0
      });
    } catch (error) {
      console.error("Error getting collection stats:", error);
      res.status(500).json({ error: "Failed to get collection statistics" });
    }
  });
  
  console.log("API routes registered successfully");

  return httpServer;
}
