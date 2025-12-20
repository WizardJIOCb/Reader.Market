import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Ollama } from "ollama";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Ollama client
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// Configure multer for file uploads
const storageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads');
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
    fileSize: 50 * 1024 * 1024, // 50MB limit
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
      'image/webp'
    ];
    
    // Check if it's an FB2 file by extension
    const fileName = file.originalname.toLowerCase();
    const isFB2File = fileName.endsWith('.fb2');
    
    if (allowedBookTypes.includes(file.mimetype) || allowedImageTypes.includes(file.mimetype) || isFB2File) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
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

  jwt.verify(token, process.env.JWT_SECRET || "default_secret", async (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    
    // Verify that the user actually exists in the database
    try {
      const userData = await storage.getUser((user as any).userId);
      if (!userData) {
        return res.status(401).json({ error: "User not found. Please log in again." });
      }
      (req as any).user = user;
      next();
    } catch (dbError) {
      console.error("Database error during authentication:", dbError);
      return res.status(500).json({ error: "Authentication failed" });
    }
  });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  console.log("Registering API routes...");
  
  // put application routes here
  // prefix all routes with /api
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    console.log("Health check endpoint called");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  
  // Get books by IDs
  app.post("/api/books/by-ids", authenticateToken, async (req, res) => {
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
  
  // Get a single book by ID
  app.get("/api/books/:id", authenticateToken, async (req, res) => {
    console.log("Get book by ID endpoint called");
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(book);
    } catch (error) {
      console.error("Get book by ID error:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });
  
  // Search books
  app.get("/api/books/search", authenticateToken, async (req, res) => {
    console.log("Search books endpoint called");
    try {
      // For now, return all books
      // In a real implementation, this would filter based on query parameters
      const books = await storage.searchBooks('');
      res.json(books);
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });

  // Upload book endpoint
  app.post("/api/books/upload", authenticateToken, upload.fields([{ name: 'bookFile' }, { name: 'coverImage' }]), async (req, res) => {
    console.log("Upload book endpoint called");
    try {
      const userId = (req as any).user.userId;
      
      // Extract book metadata from form data
      const { title, author, description, genre, year } = req.body;
      
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
        userId // Add userId to track who uploaded the book
      };
      
      // If book file was uploaded, add file information
      if (req.files && (req.files as any).bookFile) {
        const bookFile = (req.files as any).bookFile[0];
        // Store only the relative path from the uploads directory
        bookData.filePath = bookFile.path.replace(/^.*[\\\/]uploads[\\\/]/, 'uploads/');
        bookData.fileSize = bookFile.size;
        bookData.fileType = bookFile.mimetype;
      }
      
      // If cover image was uploaded, add cover image information
      if (req.files && (req.files as any).coverImage) {
        const coverImage = (req.files as any).coverImage[0];
        // Store only the relative path from the uploads directory
        bookData.coverImageUrl = coverImage.path.replace(/^.*[\\\/]uploads[\\\/]/, 'uploads/');
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
      
      // In a real implementation, you'd verify the shelf belongs to the user
      await storage.addBookToShelf(shelfId, bookId);
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
      
      // In a real implementation, you'd verify the shelf belongs to the user
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
  
  console.log("API routes registered successfully");
  
  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return httpServer;
}