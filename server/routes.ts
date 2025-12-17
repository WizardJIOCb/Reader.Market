import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Ollama } from "ollama";

// Initialize Ollama client
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// Helper function to generate JWT token
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "default_secret", {
    expiresIn: "7d",
  });
};

// Middleware to authenticate requests
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "default_secret", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    (req as any).user = user;
    next();
  });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // User registration
  app.post("/api/auth/register", async (req, res) => {
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
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      
      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      
      // Generate token
      const token = generateToken(user.id);
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  
  // Get current user profile
  app.get("/api/profile", authenticateToken, async (req, res) => {
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
  
  // Update user profile
  app.put("/api/profile", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { fullName, bio, avatarUrl, email } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        fullName,
        bio,
        avatarUrl,
        email
      });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  
  // Change password
  app.put("/api/profile/password", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new passwords are required" });
      }
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword
      });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
  
  // Search books
  app.get("/api/books/search", async (req, res) => {
    try {
      const { q } = req.query;
      const books = await storage.searchBooks(q as string);
      res.json(books);
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });
  
  // Get book by ID
  app.get("/api/books/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      console.error("Get book error:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });
  
  // Create book (admin only)
  app.post("/api/books", authenticateToken, async (req, res) => {
    try {
      // In a real app, you would check if user is admin
      const bookData = req.body;
      const book = await storage.createBook(bookData);
      res.status(201).json(book);
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({ error: "Failed to create book" });
    }
  });
  
  // Get user's shelves
  app.get("/api/shelves", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const shelves = await storage.getShelves(userId);
      res.json(shelves);
    } catch (error) {
      console.error("Get shelves error:", error);
      res.status(500).json({ error: "Failed to get shelves" });
    }
  });
  
  // Create shelf
  app.post("/api/shelves", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const shelfData = req.body;
      const shelf = await storage.createShelf(userId, shelfData);
      res.status(201).json(shelf);
    } catch (error) {
      console.error("Create shelf error:", error);
      res.status(500).json({ error: "Failed to create shelf" });
    }
  });
  
  // Update shelf
  app.put("/api/shelves/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const shelfData = req.body;
      const shelf = await storage.updateShelf(id, shelfData);
      res.json(shelf);
    } catch (error) {
      console.error("Update shelf error:", error);
      res.status(500).json({ error: "Failed to update shelf" });
    }
  });
  
  // Delete shelf
  app.delete("/api/shelves/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteShelf(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete shelf error:", error);
      res.status(500).json({ error: "Failed to delete shelf" });
    }
  });
  
  // Add book to shelf
  app.post("/api/shelves/:shelfId/books/:bookId", authenticateToken, async (req, res) => {
    try {
      const { shelfId, bookId } = req.params;
      await storage.addBookToShelf(shelfId, bookId);
      res.status(204).send();
    } catch (error) {
      console.error("Add book to shelf error:", error);
      res.status(500).json({ error: "Failed to add book to shelf" });
    }
  });
  
  // Remove book from shelf
  app.delete("/api/shelves/:shelfId/books/:bookId", authenticateToken, async (req, res) => {
    try {
      const { shelfId, bookId } = req.params;
      await storage.removeBookFromShelf(shelfId, bookId);
      res.status(204).send();
    } catch (error) {
      console.error("Remove book from shelf error:", error);
      res.status(500).json({ error: "Failed to remove book from shelf" });
    }
  });
  
  // Update reading progress
  app.post("/api/progress/:bookId", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const progressData = req.body;
      
      const progress = await storage.updateReadingProgress(userId, bookId, progressData);
      res.json(progress);
    } catch (error) {
      console.error("Update reading progress error:", error);
      res.status(500).json({ error: "Failed to update reading progress" });
    }
  });
  
  // Get reading progress
  app.get("/api/progress/:bookId", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      if (!progress) {
        return res.status(404).json({ error: "Progress not found" });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Get reading progress error:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });
  
  // Update reading statistics
  app.post("/api/statistics/:bookId", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const statsData = req.body;
      
      const stats = await storage.updateReadingStatistics(userId, bookId, statsData);
      res.json(stats);
    } catch (error) {
      console.error("Update reading statistics error:", error);
      res.status(500).json({ error: "Failed to update reading statistics" });
    }
  });
  
  // Get reading statistics
  app.get("/api/statistics/:bookId", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      
      const stats = await storage.getReadingStatistics(userId, bookId);
      if (!stats) {
        return res.status(404).json({ error: "Statistics not found" });
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Get reading statistics error:", error);
      res.status(500).json({ error: "Failed to get reading statistics" });
    }
  });
  
  // Get user statistics
  app.get("/api/user-statistics", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      
      const stats = await storage.getUserStatistics(userId);
      res.json(stats || {});
    } catch (error) {
      console.error("Get user statistics error:", error);
      res.status(500).json({ error: "Failed to get user statistics" });
    }
  });
  
  // Update user statistics
  app.post("/api/user-statistics", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const statsData = req.body;
      
      const stats = await storage.updateUserStatistics(userId, statsData);
      res.json(stats);
    } catch (error) {
      console.error("Update user statistics error:", error);
      res.status(500).json({ error: "Failed to update user statistics" });
    }
  });

  // Create bookmark
  app.post("/api/bookmarks", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const bookmarkData = { ...req.body, userId };
      
      const bookmark = await storage.createBookmark(bookmarkData);
      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Create bookmark error:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });
  
  // Get bookmarks for a book
  app.get("/api/bookmarks/:bookId", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      
      const bookmarks = await storage.getBookmarks(userId, bookId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({ error: "Failed to get bookmarks" });
    }
  });
  
  // Delete bookmark
  app.delete("/api/bookmarks/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBookmark(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete bookmark error:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });
  
  // Generate book summary with Ollama
  app.post("/api/ai/summarize/book/:bookId", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Call Ollama to generate summary
      const response = await ollama.generate({
        model: process.env.OLLAMA_MODEL || "llama2",
        prompt: `Please provide a concise summary of the following book content:\n\n${content}`,
        stream: false
      });
      
      res.json({ summary: response.response });
    } catch (error) {
      console.error("Generate book summary error:", error);
      res.status(500).json({ error: "Failed to generate book summary" });
    }
  });
  
  // Generate chapter summary with Ollama
  app.post("/api/ai/summarize/chapter/:bookId/:chapterId", authenticateToken, async (req, res) => {
    try {
      const { bookId, chapterId } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Call Ollama to generate summary
      const response = await ollama.generate({
        model: process.env.OLLAMA_MODEL || "llama2",
        prompt: `Please provide a concise summary of the following chapter content:\n\n${content}`,
        stream: false
      });
      
      res.json({ summary: response.response });
    } catch (error) {
      console.error("Generate chapter summary error:", error);
      res.status(500).json({ error: "Failed to generate chapter summary" });
    }
  });
  
  // Generate key takeaways with Ollama
  app.post("/api/ai/takeaways/:bookId/:chapterId", authenticateToken, async (req, res) => {
    try {
      const { bookId, chapterId } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Call Ollama to generate key takeaways
      const response = await ollama.generate({
        model: process.env.OLLAMA_MODEL || "llama2",
        prompt: `Please list 3-5 key takeaways from the following content:\n\n${content}`,
        stream: false
      });
      
      res.json({ takeaways: response.response });
    } catch (error) {
      console.error("Generate key takeaways error:", error);
      res.status(500).json({ error: "Failed to generate key takeaways" });
    }
  });

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return httpServer;
}