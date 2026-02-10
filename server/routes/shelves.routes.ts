import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { storage } from "../storage";
import type { Server as SocketIOServer } from 'socket.io';

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
      
      // Broadcast shelf update via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Prepare shelf update data
          const shelfUpdateData = {
            userId: userId,
            shelfId: shelf.id,
            operation: 'create_shelf',
            shelf: shelf,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to user's personal shelf room
          io.to(`user:shelves:${userId}`).emit('shelf:update', shelfUpdateData);
          console.log(`[SHELF] Broadcasted shelf creation to user ${userId} for shelf ${shelf.id}`);
        }
      } catch (broadcastError) {
        console.error('[SHELF] Failed to broadcast shelf creation:', broadcastError);
        // Don't fail the request if broadcast fails
      }
      
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
      
      // Broadcast shelf update via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Prepare shelf update data
          const shelfUpdateData = {
            userId: userId,
            shelfId: id,
            operation: 'update_shelf',
            shelf: updatedShelf,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to user's personal shelf room
          io.to(`user:shelves:${userId}`).emit('shelf:update', shelfUpdateData);
          console.log(`[SHELF] Broadcasted shelf update to user ${userId} for shelf ${id}`);
        }
      } catch (broadcastError) {
        console.error('[SHELF] Failed to broadcast shelf update:', broadcastError);
        // Don't fail the request if broadcast fails
      }
      
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
      
      // Broadcast shelf update via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Prepare shelf update data
          const shelfUpdateData = {
            userId: userId,
            shelfId: id,
            operation: 'delete_shelf',
            shelf: existingShelf,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to user's personal shelf room
          io.to(`user:shelves:${userId}`).emit('shelf:update', shelfUpdateData);
          console.log(`[SHELF] Broadcasted shelf deletion to user ${userId} for shelf ${id}`);
        }
      } catch (broadcastError) {
        console.error('[SHELF] Failed to broadcast shelf deletion:', broadcastError);
        // Don't fail the request if broadcast fails
      }
      
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
      
      // Broadcast shelf update via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Get updated shelf data to broadcast - get all user shelves with books and find the specific one
          const allShelvesWithBooks = await storage.getShelvesWithBooks(userId);
          const updatedShelf = allShelvesWithBooks.find(shelf => shelf.id === shelfId);
          
          // Prepare shelf update data
          const shelfUpdateData = {
            userId: userId,
            shelfId: shelfId,
            bookId: bookId,
            operation: 'add_book',
            shelf: updatedShelf,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to user's personal shelf room
          io.to(`user:shelves:${userId}`).emit('shelf:update', shelfUpdateData);
          console.log(`[SHELF] Broadcasted shelf update to user ${userId} for shelf ${shelfId}`);
        }
      } catch (broadcastError) {
        console.error('[SHELF] Failed to broadcast shelf update:', broadcastError);
        // Don't fail the request if broadcast fails
      }
      
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
      
      // Broadcast shelf update via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Get updated shelf data to broadcast - get all user shelves with books and find the specific one
          const allShelvesWithBooks = await storage.getShelvesWithBooks(userId);
          const updatedShelf = allShelvesWithBooks.find(shelf => shelf.id === shelfId);
          
          // Prepare shelf update data
          const shelfUpdateData = {
            userId: userId,
            shelfId: shelfId,
            bookId: bookId,
            operation: 'remove_book',
            shelf: updatedShelf,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to user's personal shelf room
          io.to(`user:shelves:${userId}`).emit('shelf:update', shelfUpdateData);
          console.log(`[SHELF] Broadcasted shelf update to user ${userId} for shelf ${shelfId}`);
        }
      } catch (broadcastError) {
        console.error('[SHELF] Failed to broadcast shelf update:', broadcastError);
        // Don't fail the request if broadcast fails
      }
      
      res.json({ success: true, message: "Book removed from shelf" });
    } catch (error) {
      console.error("Remove book from shelf error:", error);
      res.status(500).json({ error: "Failed to remove book from shelf" });
    }
  });

  // Check if a book is on user's shelves
  router.get("/book/:bookId/on-shelf", authenticateToken, async (req, res) => {
    console.log("Check if book is on shelf endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const bookShelves = await storage.getBookShelves(bookId, userId);
      
      res.json({ 
        isOnShelf: bookShelves.length > 0,
        shelves: bookShelves.map((bs: any) => bs.shelf)
      });
    } catch (error) {
      console.error("Check if book is on shelf error:", error);
      res.status(500).json({ error: "Failed to check if book is on shelf" });
    }
  });

  return router;
}