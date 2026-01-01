import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Ollama } from "ollama";
import multer from "multer";
import fs from "fs";
import path from "path";

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
      cb(null, false);
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
  
  // Get popular books (sorted by rating)
  app.get("/api/books/popular", authenticateToken, async (req, res) => {
    console.log("Get popular books endpoint called");
    try {
      const books = await storage.getPopularBooks();
      res.json(books);
    } catch (error) {
      console.error("Get popular books error:", error);
      res.status(500).json({ error: "Failed to get popular books" });
    }
  });
  
  // Get books by genre
  app.get("/api/books/genre/:genre", authenticateToken, async (req, res) => {
    console.log("Get books by genre endpoint called");
    try {
      const { genre } = req.params;
      const books = await storage.getBooksByGenre(genre);
      res.json(books);
    } catch (error) {
      console.error("Get books by genre error:", error);
      res.status(500).json({ error: "Failed to get books by genre" });
    }
  });
  
  // Get recently reviewed books
  app.get("/api/books/recently-reviewed", authenticateToken, async (req, res) => {
    console.log("Get recently reviewed books endpoint called");
    try {
      const books = await storage.getRecentlyReviewedBooks();
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
  app.get("/api/books/new-releases", authenticateToken, async (req, res) => {
    console.log("Get new releases endpoint called");
    try {
      const books = await storage.getNewReleases();
      console.log("New releases fetched successfully, count:", books.length);
      res.json(books);
    } catch (error) {
      console.error("Get new releases error:", error);
      res.status(500).json({ error: "Failed to get new releases" });
    }
  });
  
  // Search books
  app.get("/api/books/search", authenticateToken, async (req, res) => {
    console.log("Search books endpoint called");
    try {
      const query = req.query.query ? String(req.query.query) : '';
      console.log("Search query:", query);
      
      let books = await storage.searchBooks(query);
      
      // For books without ratings, calculate them
      for (const book of books) {
        if (book.rating === null || book.rating === undefined) {
          await storage.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      books = await storage.searchBooks(query);
      
      res.json(books);
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });
  
  // Get a single book by ID
  app.get("/api/books/:id", authenticateToken, async (req, res) => {
    console.log("Get book by ID endpoint called");
    try {
      const { id } = req.params;
      console.log(`Getting book with ID: ${id}`);
      if (!id) {
        return res.status(400).json({ error: "Book ID is required" });
      }
      
      let book = await storage.getBook(id);
      console.log(`Retrieved book:`, book);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // If the book has no rating or the rating is null, calculate it
      if (book.rating === null || book.rating === undefined) {
        console.log(`Book ${id} has no rating, calculating...`);
        await storage.updateBookAverageRating(id);
        // Fetch the book again with the updated rating
        book = await storage.getBook(id);
        console.log(`Book after rating calculation:`, book);
      }
      
      console.log(`Returning book:`, book);
      res.json(book);
    } catch (error) {
      console.error("Get book by ID error:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });

  // Upload book endpoint
  app.post("/api/books/upload", authenticateToken, upload.fields([{ name: 'bookFile' }, { name: 'coverImage' }]), async (req, res) => {
    console.log("Upload book endpoint called");
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
        userId, // Add userId to track who uploaded the book
        uploadedAt: new Date(), // Set upload time to current time
        publishedAt: publishedAt ? new Date(publishedAt) : (year ? new Date(`${year}-01-01`) : null) // Set publication date
      };
      
      // If book file was uploaded, add file information
      if (req.files && (req.files as any).bookFile) {
        const bookFile = (req.files as any).bookFile[0];
        // Store only the relative path from the uploads directory
        bookData.filePath = bookFile.path.replace(/^.*[\\\/](uploads[\\\/].*)$/, '$1');
        bookData.fileSize = bookFile.size;
        bookData.fileType = bookFile.mimetype;
      }
      
      // If cover image was uploaded, add cover image information
      if (req.files && (req.files as any).coverImage) {
        const coverImage = (req.files as any).coverImage[0];
        // Store only the relative path from the uploads directory
        bookData.coverImageUrl = coverImage.path.replace(/^.*[\\\/](uploads[\\\/].*)$/, '$1');
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
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      
      const comment = await storage.createComment({
        userId,
        bookId,
        content
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });
  
  // Get comments for a book
  app.get("/api/books/:bookId/comments", authenticateToken, async (req, res) => {
    console.log("Get comments endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
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
  
  // Delete a comment
  app.delete("/api/comments/:id", authenticateToken, async (req, res) => {
    console.log("Delete comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      
      const success = await storage.deleteComment(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Comment not found or unauthorized" });
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
      const { rating, content } = req.body;
      
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
      
      const review = await storage.createReview({
        userId,
        bookId,
        rating,
        content
      });
      
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
        const reactions = await storage.getReactions(review.id, false);
        
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
  app.get("/api/books/:bookId/reviews", authenticateToken, async (req, res) => {
    console.log("Get reviews endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
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
  
  // Delete a review
  app.delete("/api/reviews/:id", authenticateToken, async (req, res) => {
    console.log("Delete review endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      
      const success = await storage.deleteReview(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Review not found or unauthorized" });
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
      
      res.json(reaction);
    } catch (error) {
      console.error("Create reaction error:", error);
      res.status(500).json({ error: "Failed to create reaction" });
    }
  });
  
  console.log("API routes registered successfully");
  
  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return httpServer;
}