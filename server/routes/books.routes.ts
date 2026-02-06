import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from "../storage";
import { db } from "../storage/db";
import { eq, and } from 'drizzle-orm';
import { books as booksSchema, bookmarkCollections, bookmarkCollectionItems, bookmarks } from '@shared/schema';

export function createBooksRouter() {
  const router = Router();

  // Get books by IDs - open to all users
  router.post("/by-ids", optionalAuthenticateToken, async (req, res) => {
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
      res.status(500).json({ error: "Failed to get books by IDs" });
    }
  });

  // Get popular books (sorted by rating)
  router.get("/popular", optionalAuthenticateToken, async (req, res) => {
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
  router.get("/genre/:genre", optionalAuthenticateToken, async (req, res) => {
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
  router.get("/recently-reviewed", optionalAuthenticateToken, async (req, res) => {
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
  router.get("/currently-reading", authenticateToken, async (req, res) => {
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
  router.get("/new-releases", optionalAuthenticateToken, async (req, res) => {
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
  router.get("/search", optionalAuthenticateToken, async (req, res) => {
    console.log("Search books endpoint called");
    try {
      const query = req.query.query ? String(req.query.query) : '';
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const sortDirection = req.query.sortDirection === 'asc' ? 'asc' : 'desc'; // Default to 'desc'

      // Allow empty queries to return all books
      // if (!query) {
      //   return res.status(400).json({ error: "Query parameter is required" });
      // }

      const books = await storage.searchBooks(query, sortBy, sortDirection);
      res.json(books);
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });

  // Track book view when user visits book detail page
  router.post("/:id/track-view", optionalAuthenticateToken, async (req, res) => {
    console.log("Track book view endpoint called");
    try {
      const { id } = req.params;
      const { viewType } = req.body;
      const userId = (req as any).user?.userId;

      await storage.incrementBookViewCount(id, 'detail_view');
      res.status(204).send();
    } catch (error) {
      console.error("Track book view error:", error);
      res.status(500).json({ error: "Failed to track book view" });
    }
  });

  // Get book statistics
  router.get("/:id/stats", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const stats = await storage.getBookViewStats(id);

      res.json(stats);
    } catch (error) {
      console.error("Get book stats error:", error);
      res.status(500).json({ error: "Failed to get book stats" });
    }
  });

  // Get reader settings for a book
  router.get("/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;

      // Placeholder response - implement with actual storage method
      res.json({});
    } catch (error) {
      console.error("Get reader settings error:", error);
      res.status(500).json({ error: "Failed to get reader settings" });
    }
  });

  // Update reader settings for a book
  router.put("/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { theme, fontSize, fontFamily, lineHeight, margin, ...otherSettings } = req.body;

      // Placeholder response - implement with actual storage method
      res.json({});
    } catch (error) {
      console.error("Update reader settings error:", error);
      res.status(500).json({ error: "Failed to update reader settings" });
    }
  });

  // Get reading progress for a book
  router.get("/:bookId/reading-progress", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      res.json(progress);
    } catch (error) {
      console.error("Get reading progress error:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });

  // Get reading progress for a specific user and book (public endpoint for comments)
  router.get("/:bookId/reading-progress/:userId", optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId, userId } = req.params;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      
      res.json(progress);
    } catch (error) {
      console.error("Get specific reading progress error:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });

  // Update reading progress for a book (upsert)
  router.put("/:bookId/reading-progress", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { currentPage, totalPages, percentage, chapterIndex, pageInChapter, totalPagesInChapter, locator } = req.body;
      
      const progressData = {
        currentPage,
        totalPages,
        percentage,
        chapterIndex,
        pageInChapter,
        totalPagesInChapter,
        locator
      };

      const progress = await storage.updateReadingProgress(userId, bookId, progressData);

      res.json(progress);
    } catch (error) {
      console.error("Update reading progress error:", error);
      res.status(500).json({ error: "Failed to update reading progress" });
    }
  });

  // Get reactions for a book
  router.get("/:id/reactions", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      const reactions = await storage.getReactions(id, 'book');
      res.json(reactions);
    } catch (error) {
      console.error("Get book reactions error:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  });

  // Get detailed reactions for a book (with user information)
  router.get("/:id/reactions/detail", optionalAuthenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      const reactions = await storage.getReactions(id, 'book');
      res.json(reactions);
    } catch (error) {
      console.error("Get detailed book reactions error:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  });

  // Get all bookmarks for a book
  router.get("/:bookId/bookmarks", authenticateToken, async (req, res) => {
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
  router.post("/:bookId/bookmarks", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { title, chapterIndex, percentage, selectedText, pageInChapter, collectionId } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Bookmark title is required" });
      }
      
      // Get book title for default collection name
      const book = await db.select({ title: booksSchema.title }).from(booksSchema).where(eq(booksSchema.id, bookId));
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

  // Get articles by book
  router.get("/:bookId/articles", optionalAuthenticateToken, async (req, res) => {
    console.log("Get articles by book endpoint called for book ID:", req.params.bookId);
    try {
      const { bookId } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      const result = await storage.getArticlesByBook({
        bookId: bookId,
        userId: currentUserId,
        page: 1,
        limit: 12,
        sortBy: 'publishedAt',
        sortOrder: 'desc'
      });
      res.json(result);
    } catch (error) {
      console.error("Get articles by book error:", error);
      res.status(500).json({ error: "Failed to get articles by book" });
    }
  });

  // Get a single book by ID - this must be LAST to avoid catching other routes
  router.get("/:id", optionalAuthenticateToken, logUserAction, async (req, res) => {
    console.log("Get book by ID endpoint called");
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      console.log(`Getting book with ID: ${id}`);

      const book = await storage.getBook(id, userId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }

      res.json(book);
    } catch (error) {
      console.error("Get book by ID error:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });

  return router;
}