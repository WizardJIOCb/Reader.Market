import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { eq, and, sql } from 'drizzle-orm';
import { bookmarkCollections, bookmarkCollectionItems, bookmarks, collectionBooks, users } from '@shared/schema';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cover image upload configuration
const coverImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'covers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `collection-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const coverImageUpload = multer({
  storage: coverImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

export function createBookmarkCollectionsRouter() {
  const router = Router();

  // Get all bookmark collections for the current user
  router.get("/", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      
      // For now, return a simple placeholder response until storage methods are properly implemented
      res.json([]);
    } catch (error) {
      console.error("Get bookmark collections error:", error);
      res.status(500).json({ error: "Failed to get bookmark collections" });
    }
  });

  // Get a specific bookmark collection
  router.get("/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      
      // For now, return a simple placeholder response until storage methods are properly implemented
      res.json({});
    } catch (error) {
      console.error("Get bookmark collection error:", error);
      res.status(500).json({ error: "Failed to get bookmark collection" });
    }
  });

  // Create a new bookmark collection
  router.post("/", authenticateToken, (req, res, next) => {
    coverImageUpload.single('coverImage')(req, res, (err) => {
      if (err) {
        console.error("Cover image upload error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
        }
        return res.status(400).json({ error: 'Cover image upload failed: ' + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { name, description, color, isPublic, bookId } = req.body;
      
      // For now, return a simple placeholder response until storage methods are properly implemented
      res.status(201).json({ id: 'placeholder-id', name: name || 'Default Name' });
    } catch (error) {
      console.error("Create bookmark collection error:", error);
      res.status(500).json({ error: "Failed to create bookmark collection" });
    }
  });

  // Update a bookmark collection
  router.put("/:id", authenticateToken, (req, res, next) => {
    coverImageUpload.single('coverImage')(req, res, (err) => {
      if (err) {
        console.error("Cover image upload error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
        }
        return res.status(400).json({ error: 'Cover image upload failed: ' + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const { id } = req.params;
      
      // For now, return a simple placeholder response until storage methods are properly implemented
      res.json({ id, name: 'Updated Name' });
    } catch (error) {
      console.error("Update bookmark collection error:", error);
      res.status(500).json({ error: "Failed to update bookmark collection" });
    }
  });

  // Delete a bookmark collection
  router.delete(":id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // For now, return success until storage methods are properly implemented
      res.status(204).send();
    } catch (error) {
      console.error("Delete bookmark collection error:", error);
      res.status(500).json({ error: "Failed to delete bookmark collection" });
    }
  });
  
  // Get all collections for a specific book
  router.get("/book/:bookId", authenticateToken, async (req, res) => {
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
      // Removed debug logs to avoid TypeScript errors
      
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

  return router;
}
