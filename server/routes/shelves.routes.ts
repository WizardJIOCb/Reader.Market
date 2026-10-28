import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { storage } from "../storage";

export function createShelvesRouter() {
  const router = Router();

  // Get all shelves for the current user
  router.get("/", authenticateToken, async (req, res) => {
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
  router.get("/with-books", authenticateToken, async (req, res) => {
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

  // Get shelves for a specific user (alternative endpoint) - open to all users
  router.get("/user/:userId", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user shelves endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Verify user exists
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const shelves = await storage.getShelves(targetUserId);
      res.json(shelves);
    } catch (error) {
      console.error("Get user shelves error:", error);
      res.status(500).json({ error: "Failed to get user shelves" });
    }
  });

  // Create a new shelf
  router.post("/", authenticateToken, async (req, res) => {
    console.log("Create shelf endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { name, description, color } = req.body;
      
      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Shelf name is required" });
      }
      
      const shelf = await storage.createShelf(userId, {
        name: name.trim(),
        description: description ? description.trim() : null,
        color: color || null
      });
      
      res.status(201).json(shelf);
    } catch (error) {
      console.error("Create shelf error:", error);
      res.status(500).json({ error: "Failed to create shelf" });
    }
  });

  // Update a shelf
  router.put("/:id", authenticateToken, async (req, res) => {
    console.log("Update shelf endpoint called");
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const { name, description, color } = req.body;
      
      // Verify shelf exists and belongs to user
      const existingShelf = await storage.getShelf(id);
      if (!existingShelf) {
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      if (existingShelf.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (color !== undefined) updateData.color = color;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      const updatedShelf = await storage.updateShelf(id, updateData);
      res.json(updatedShelf);
    } catch (error) {
      console.error("Update shelf error:", error);
      res.status(500).json({ error: "Failed to update shelf" });
    }
  });

  // Delete a shelf
  router.delete("/:id", authenticateToken, async (req, res) => {
    console.log("Delete shelf endpoint called");
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify shelf exists and belongs to user
      const existingShelf = await storage.getShelf(id);
      if (!existingShelf) {
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      if (existingShelf.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteShelf(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete shelf error:", error);
      res.status(500).json({ error: "Failed to delete shelf" });
    }
  });

  // Add a book to a shelf
  router.post("/:id/books/:bookId", authenticateToken, async (req, res) => {
    console.log("Add book to shelf endpoint called");
    try {
      const { id: shelfId, bookId } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify shelf exists and belongs to user
      const shelf = await storage.getShelf(shelfId);
      if (!shelf) {
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      if (shelf.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      await storage.addBookToShelf(shelfId, bookId);
      res.json({ success: true, message: "Book added to shelf" });
    } catch (error) {
      console.error("Add book to shelf error:", error);
      res.status(500).json({ error: "Failed to add book to shelf" });
    }
  });

  // Remove a book from a shelf
  router.delete("/:id/books/:bookId", authenticateToken, async (req, res) => {
    console.log("Remove book from shelf endpoint called");
    try {
      const { id: shelfId, bookId } = req.params;
      const userId = (req as any).user.userId;
      
      // Verify shelf exists and belongs to user
      const shelf = await storage.getShelf(shelfId);
      if (!shelf) {
        return res.status(404).json({ error: "Shelf not found" });
      }
      
      if (shelf.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.removeBookFromShelf(shelfId, bookId);
      res.json({ success: true, message: "Book removed from shelf" });
    } catch (error) {
      console.error("Remove book from shelf error:", error);
      res.status(500).json({ error: "Failed to remove book from shelf" });
    }
  });

  return router;
}