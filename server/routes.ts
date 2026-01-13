import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { sql } from "drizzle-orm/sql";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Ollama } from "ollama";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createCommentActivity, createReviewActivity, createBookActivity, createNewsActivity } from "./streamHelpers";
import { logUserAction, logGroupMessageAction } from "./actionLoggingMiddleware";

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
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "default_secret", {
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
      socket.join(`channel:${channelId}`);
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
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`${isAuthenticated ? 'User ' + userId : 'Unauthenticated user'} disconnected from WebSocket`);
    });
  });
  
  // Store io instance globally so we can use it in route handlers
  (app as any).io = io;
  
  // put application routes here
  // prefix all routes with /api
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    console.log("Health check endpoint called");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  
  // User registration
  app.post("/api/auth/register", async (req, res) => {
    console.log("Registration endpoint called");
    try {
      const { username, password, email, fullName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({ 
        username, 
        password: hashedPassword,
        email,
        fullName
      });
      
      // Generate token
      const token = generateToken(user.id);
      
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
      
      // Generate token
      console.log("Generating token for user ID:", user.id);
      const token = generateToken(user.id);
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
      
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user profile without sensitive information
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get specific user profile error:", error);
      res.status(500).json({ error: "Failed to get user profile" });
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
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const stats = await storage.getUserStatistics(userId);
      
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
      const { content } = req.body;
      const userId = (req as any).user.userId;
      
      console.log("Received comment data - userId:", userId, "newsId:", id, "content:", content);
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      const comment = await storage.createNewsComment({
        userId,
        newsId: id,
        content
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
              news_id: id,
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
      
      console.log("Created reaction with ID:", reaction.id);
      
      // Get all reactions for this news item and aggregate them
      const allReactions = await storage.getReactionsForNews(id);
      
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
      const { title, content, published } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      
      const newsData = {
        title,
        content,
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
      const { title, content, published } = req.body;
      
      const existingNews = await storage.getNews(id);
      if (!existingNews) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      const newsData = {
        title: title !== undefined ? title : existingNews.title,
        content: content !== undefined ? content : existingNews.content,
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
      // Get all news items (published and unpublished)
      const allNews = await storage.getAllNews();
      
      res.json(allNews);
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
      const { accessLevel } = req.body;
      
      if (!accessLevel || !['admin', 'moder', 'user'].includes(accessLevel)) {
        return res.status(400).json({ error: "Valid access level is required (admin, moder, or user)" });
      }
      
      const updatedUser = await storage.updateAccessLevel(userId, accessLevel);
      
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
      const allComments = await storage.getAllComments();
      
      res.json(allComments);
    } catch (error) {
      console.error("Get pending comments error:", error);
      res.status(500).json({ error: "Failed to get pending comments" });
    }
  });
  
  // Admin: Get pending reviews
  app.get("/api/admin/reviews/pending", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get pending reviews endpoint called");
    try {
      const allReviews = await storage.getAllReviews();
      
      res.json(allReviews);
    } catch (error) {
      console.error("Get pending reviews error:", error);
      res.status(500).json({ error: "Failed to get pending reviews" });
    }
  });
  
  // Admin: Get recent activity
  app.get("/api/admin/recent-activity", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get recent activity endpoint called");
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activity = await storage.getRecentActivity(limit);
      
      // Get book titles for each activity item
      const activityWithBooks = await Promise.all(activity.map(async (item) => {
        const book = await storage.getBook(item.bookId);
        return {
          ...item,
          bookTitle: book ? book.title : 'Unknown Book',
          bookAuthor: book ? book.author : 'Unknown Author'
        };
      }));
      
      res.json(activityWithBooks);
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
  
  // Get shelves for a specific user (for profile viewing) - open to all users
  app.get("/api/users/:userId/shelves", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user shelves endpoint called");
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
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User ID not found" });
      }
      
      const shelves = await storage.getShelves(userId);
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
      
      const books = await storage.getBooksByIds(bookIds);
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
      const { content, attachments } = req.body;
      
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
        attachmentMetadata
      });
      
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
            metadata: {
              content_preview: content.substring(0, 200),
              author_id: userId,
              author_name: user.username || user.fullName || 'Anonymous',
              author_avatar: user.avatarUrl || null,
              book_id: bookId,
              book_title: book.title,
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
      const userId = (req as any).user?.userId; // Optional userId
      let comments = await storage.getComments(bookId);
      
      // Get comment IDs
      const commentIds = comments.map(comment => comment.id);
      
      if (commentIds.length > 0) {
        // Get reactions for all comments
        const reactions = await storage.getReactionsForItems(commentIds, true);
        
        // Group and aggregate reactions by commentId and emoji
        const reactionsMap: Record<string, any[]> = {};
        
        // Group reactions by commentId and emoji
        const groupedReactions: Record<string, any[]> = {};
        reactions.forEach(reaction => {
          const key = `${reaction.commentId}::${reaction.emoji}`;
          if (!groupedReactions[key]) {
            groupedReactions[key] = [];
          }
          groupedReactions[key].push(reaction);
        });
        
        // Aggregate reactions
        Object.entries(groupedReactions).forEach(([key, reactionList]) => {
          const parts = key.split('::');
          const commentId = parts[0];
          const emoji = parts[1];
          if (!reactionsMap[commentId]) {
            reactionsMap[commentId] = [];
          }
          
          // Check if current user reacted with this emoji
          const userReacted = reactionList.some(reaction => reaction.userId === userId);
          
          reactionsMap[commentId].push({
            emoji,
            count: reactionList.length,
            userReacted
          });
        });
        
        // Add reactions to comments
        comments = comments.map(comment => ({
          ...comment,
          reactions: reactionsMap[comment.id] || []
        }));
      }
      
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to get comments" });
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
      const { rating, content, attachments } = req.body;
      
      console.log(`Creating review for book ${bookId} by user ${userId} with rating ${rating}`);
      
      if (rating === undefined || rating === null || content === undefined || content === null || content.trim() === '') {
        return res.status(400).json({ error: "Rating and content are required" });
      }
      
      // Validate rating is between 1 and 10
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 10" });
      }
      
      // Check if user already reviewed this book
      const existingReview = await storage.getUserReview(userId, bookId);
      if (existingReview) {
        return res.status(400).json({ error: "You have already reviewed this book" });
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
        attachmentMetadata
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

  // Get reviews for a book
  app.get("/api/books/:bookId/reviews", optionalAuthenticateToken, async (req, res) => {
    console.log("Get reviews endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId; // Optional userId
      let reviews = await storage.getReviews(bookId);
      
      // Get review IDs
      const reviewIds = reviews.map(review => review.id);
      
      if (reviewIds.length > 0) {
        // Get reactions for all reviews
        const reactions = await storage.getReactionsForItems(reviewIds, false);
        
        // Group and aggregate reactions by reviewId and emoji
        const reactionsMap: Record<string, any[]> = {};
        
        // Group reactions by reviewId and emoji
        const groupedReactions: Record<string, any[]> = {};
        reactions.forEach(reaction => {
          const key = `${reaction.reviewId}::${reaction.emoji}`;
          if (!groupedReactions[key]) {
            groupedReactions[key] = [];
          }
          groupedReactions[key].push(reaction);
        });
        
        // Aggregate reactions
        Object.entries(groupedReactions).forEach(([key, reactionList]) => {
          const parts = key.split('::');
          const reviewId = parts[0];
          const emoji = parts[1];
          if (!reactionsMap[reviewId]) {
            reactionsMap[reviewId] = [];
          }
          
          // Check if current user reacted with this emoji
          const userReacted = reactionList.some(reaction => reaction.userId === userId);
          
          reactionsMap[reviewId].push({
            emoji,
            count: reactionList.length,
            userReacted
          });
        });
        
        // Add reactions to reviews
        reviews = reviews.map(review => ({
          ...review,
          reactions: reactionsMap[review.id] || []
        }));
      }
      
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
      
      res.json({
        newsChange: newsFromLastMonth,
        commentsChange: commentsFromToday,
        reviewsChange: reviewsFromToday
      });
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
            u.created_at as "createdAt",
            u.updated_at as "lastLogin",
            COUNT(DISTINCT s.id) as "shelvesCount",
            COUNT(DISTINCT sb.book_id) as "booksOnShelvesCount",
            COUNT(DISTINCT c.id) as "commentsCount",
            COUNT(DISTINCT r.id) as "reviewsCount"
          FROM users u
          LEFT JOIN shelves s ON u.id = s.user_id
          LEFT JOIN shelf_books sb ON s.id = sb.shelf_id
          LEFT JOIN comments c ON u.id = c.user_id
          LEFT JOIN reviews r ON u.id = r.user_id
          WHERE 
            LOWER(u.username) LIKE LOWER(${searchPattern}) OR
            LOWER(u.full_name) LIKE LOWER(${searchPattern}) OR
            LOWER(u.email) LIKE LOWER(${searchPattern})
          GROUP BY u.id
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
  
  // Admin: Change user access level
  app.put("/api/admin/users/:userId/access-level", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Change user access level endpoint called");
    try {
      const { userId } = req.params;
      const { accessLevel } = req.body;
      
      // Validate access level
      if (!['user', 'moder', 'admin'].includes(accessLevel)) {
        return res.status(400).json({ error: "Invalid access level" });
      }
      
      const updatedUser = await storage.updateAccessLevel(userId, accessLevel);
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Change user access level error:", error);
      res.status(500).json({ error: "Failed to change user access level" });
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
      
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.author) updateData.author = req.body.author;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.genre !== undefined) updateData.genre = req.body.genre;
      if (req.body.publishedYear) updateData.publishedYear = parseInt(req.body.publishedYear);
      if (req.body.publishedAt) updateData.publishedAt = new Date(req.body.publishedAt);
      
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
        io.to(conversationRoom).emit('message:new', {
          message,
          conversationId: conversation.id
        });
        
        // Send notification to recipient's personal room
        const recipientRoom = `user:${recipientId}`;
        console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] ✅ Emitting 'notification:new' to room: ${recipientRoom}`);
        const notificationData = {
          type: 'new_message',
          conversationId: conversation.id,
          senderId: userId
        };
        console.log('\x1b[32m%s\x1b[0m', `[WEBSOCKET] Notification data: ${JSON.stringify(notificationData)}`);
        io.to(recipientRoom).emit('notification:new', notificationData);
        
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
        io.to(`channel:${channelId}`).emit('channel:message:new', {
          message,
          channelId,
          groupId
        });
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
      
      // Check if user is the sender (can delete own messages)
      let canDelete = message.senderId === userId;
      
      // If message is in a channel (group chat), check if user is admin/moderator
      if (!canDelete && message.channelId) {
        // Get the channel to find the group
        const channel = await storage.getChannel(message.channelId);
        if (channel) {
          const role = await storage.getGroupMemberRole(channel.groupId, userId);
          canDelete = role === 'administrator' || role === 'moderator';
        }
      }
      
      if (!canDelete) {
        return res.status(403).json({ error: "Insufficient permissions to delete this message" });
      }
      
      // Delete the message
      const deleted = await storage.deleteMessage(messageId, userId);
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
  
  console.log("API routes registered successfully");

  return httpServer;
}
