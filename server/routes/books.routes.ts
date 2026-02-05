import { Router, Request, Response } from "express";
import type { Storage } from "../storage/types";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";

export function createBooksRouter(storage: Storage) {
  const router = Router();

  // Get book by ID
  router.get("/:id", optionalAuthenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      
      const book = await storage.getBook(id, userId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(book);
    } catch (error) {
      console.error("Error getting book:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search books
  router.get("/search", optionalAuthenticateToken, async (req, res) => {
    try {
      const { q, query, sortBy, sortDirection } = req.query;
      const searchQuery = (q || query) as string;
      const sort = sortBy as string;
      const direction = (sortDirection === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
      
      if (!searchQuery) {
        return res.status(400).json({ error: "Query parameter is required" });
      }
      
      const books = await storage.searchBooks(searchQuery, sort, direction);
      res.json(books);
    } catch (error) {
      console.error("Error searching books:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get popular books
  router.get("/popular", optionalAuthenticateToken, async (req, res) => {
    try {
      const { sortBy } = req.query;
      const sort = sortBy as string;
      
      const books = await storage.getPopularBooks(sort);
      res.json(books);
    } catch (error) {
      console.error("Error getting popular books:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get books by genre
  router.get("/genre/:genre", optionalAuthenticateToken, async (req, res) => {
    try {
      const { genre } = req.params;
      const { sortBy } = req.query;
      const sort = sortBy as string;
      
      const books = await storage.getBooksByGenre(genre, sort);
      res.json(books);
    } catch (error) {
      console.error("Error getting books by genre:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get recently reviewed books
  router.get("/recently-reviewed", optionalAuthenticateToken, async (req, res) => {
    try {
      const { sortBy } = req.query;
      const sort = sortBy as string;
      
      const books = await storage.getRecentlyReviewedBooks(sort);
      res.json(books);
    } catch (error) {
      console.error("Error getting recently reviewed books:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get currently reading books for current user
  router.get("/currently-reading", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      
      const books = await storage.getCurrentUserBooks(userId);
      res.json(books);
    } catch (error) {
      console.error("Error getting currently reading books:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get new releases
  router.get("/new-releases", optionalAuthenticateToken, async (req, res) => {
    try {
      const { sortBy } = req.query;
      const sort = sortBy as string;
      
      const books = await storage.getNewReleases(sort);
      res.json(books);
    } catch (error) {
      console.error("Error getting new releases:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get books by IDs (batch request)
  router.post("/by-ids", optionalAuthenticateToken, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }
      
      // Process each ID to get the book
      const books = [];
      for (const id of ids) {
        const userId = (req as any).user?.userId;
        const book = await storage.getBook(id, userId);
        if (book) {
          books.push(book);
        }
      }
      
      res.json(books);
    } catch (error) {
      console.error("Error getting books by IDs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export default createBooksRouter;