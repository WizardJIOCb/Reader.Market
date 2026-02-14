import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from "../storage";
import { db } from "../storage/db";
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { books as booksSchema, bookmarkCollections, bookmarkCollectionItems, bookmarks, fileUploads } from '@shared/schema';
import multer from 'multer';
import path from 'path';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';
import { BookFileManager } from '../utils/book-file-manager';
import { createBookActivity, createCommentActivity, createReviewActivity } from '../streamHelpers';

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
      // Always return a JSON response, even if there's no progress
      res.json(progress || null);
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
      
      res.json(progress || null);
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

  // Add reaction to a book
  router.post("/:id/reactions", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;
      
      // Validate emoji
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Create reaction
      const reactionData = {
        userId,
        emoji,
        bookId: id
      };
      
      // Create reaction and get updated reactions list
      const result = await storage.createReaction(reactionData);
      
      // Emit WebSocket event for reaction update
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Determine event type based on result
          const eventType = result.created ? 'book-reaction-added' : 'book-reaction-removed';
          
          // Broadcast to book-specific room
          io.to(`book-reactions:${id}`).emit(eventType, {
            bookId: id,
            emoji: emoji,
            userId: userId,
            reactions: result.reactions || [],
            action: result.created ? 'added' : 'removed'
          });
          
          console.log('[WEBSOCKET] Sent', eventType, 'event for book:', id);
        }
      } catch (wsError) {
        console.error('[WEBSOCKET] Failed to broadcast reaction update:', wsError);
        // Don't fail the operation if WebSocket broadcast fails
      }
      
      // Return the updated reactions directly in the response
      res.json({
        ...result,
        reactions: result.reactions || []
      });
    } catch (error) {
      console.error("Add book reaction error:", error);
      res.status(500).json({ error: "Failed to add reaction" });
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

  // Add a comment to a book
  router.post('/:bookId/comments', authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { content, parentCommentId, quotedText, attachments } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // If this is a reply, verify the parent comment exists
      if (parentCommentId) {
        const parentComment = await storage.getCommentById(parentCommentId);
        if (!parentComment || parentComment.bookId !== bookId) {
          return res.status(404).json({ error: "Parent comment not found or does not belong to this book" });
        }
      }
      
      // Create the comment
      const newComment = await storage.createComment({
        userId,
        bookId,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
        quotedText: quotedText || null
      });
      
      // If there are attachments, update their entityId to link them to this comment
      console.log('Attachments:', attachments);
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        try {
          console.log('Linking attachments to comment:', attachments, 'Comment ID:', newComment.id, 'Uploader ID:', userId);
          
          // First, verify the files exist and belong to the user
          const existingFiles = await db.select({
            id: fileUploads.id,
            uploaderId: fileUploads.uploaderId,
            entityType: fileUploads.entityType,
            entityId: fileUploads.entityId
          })
            .from(fileUploads)
            .where(
              and(
                inArray(fileUploads.id, attachments),
                eq(fileUploads.uploaderId, userId),
                sql`(${fileUploads.entityType} = 'temp' OR (${fileUploads.entityType} = 'comment' AND ${fileUploads.entityId} IS NULL))`
              )
            );
          
          console.log('Found existing files to link:', existingFiles.length, 'out of', attachments.length);
          console.log('Existing files details:', existingFiles);
          
          if (existingFiles.length > 0) {
            // Extract the IDs of files that need to be updated
            const fileIdsToUpdate = existingFiles.map(file => file.id);
            
            // Update file uploads to link them to the created comment
            const result = await db.update(fileUploads)
              .set({ entityId: newComment.id })
              .where(
                and(
                  inArray(fileUploads.id, fileIdsToUpdate),
                  eq(fileUploads.uploaderId, userId),
                  sql`(${fileUploads.entityType} = 'temp' OR (${fileUploads.entityType} = 'comment' AND ${fileUploads.entityId} IS NULL))`
                )
              ).execute();
            
            console.log('Attachment linking result - rows affected:', result);
            
            // Verify that the files were linked by querying them
            const linkedFiles = await db.select()
              .from(fileUploads)
              .where(
                and(
                  inArray(fileUploads.id, fileIdsToUpdate),
                  eq(fileUploads.entityId, newComment.id)
                )
              );
            
            console.log('Linked files count:', linkedFiles.length, 'expected:', fileIdsToUpdate.length);
            console.log('Linked files details:', linkedFiles);
          }
        } catch (attachmentError) {
          console.error('Error updating attachment entity IDs:', attachmentError);
          // Don't fail the comment creation if attachment linking fails
        }
      }
      
      // Fetch the comment again to include attachment information
      const commentWithAttachments = await storage.getCommentById(newComment.id);
      
      // If we have attachment IDs and the comment doesn't have attachments populated yet,
      // explicitly query for the file uploads
      if (attachments && attachments.length > 0 && (!commentWithAttachments.attachments || commentWithAttachments.attachments.length === 0)) {
        // Query file uploads directly
        const directAttachments = await db.select({
          id: fileUploads.id,
          fileUrl: fileUploads.fileUrl,
          filename: fileUploads.filename,
          fileSize: fileUploads.fileSize,
          mimeType: fileUploads.mimeType,
          thumbnailUrl: fileUploads.thumbnailUrl
        })
        .from(fileUploads)
        .where(and(
          eq(fileUploads.entityId, newComment.id),
          sql`(${fileUploads.entityType} = 'comment')`
        ));
        
        // Add attachments to the comment object
        commentWithAttachments.attachments = directAttachments.map(att => ({
          uploadId: att.id,
          url: att.fileUrl,
          filename: att.filename,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          thumbnailUrl: att.thumbnailUrl
        }));
      }
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        const user = await storage.getUser(userId);
        const io = (req.app as any).io;
        
        // Prepare comment data for broadcast to book-specific room
        const commentData = {
          ...commentWithAttachments,
          username: user?.username,
          fullName: user?.fullName,
          avatarUrl: user?.avatarUrl
        };
        
        // Emit to book-specific room
        if (io) {
          io.to(`book-comments:${bookId}`).emit('new-comment', commentData);
        }
        
        // Create activity entry and broadcast to global stream
        await createCommentActivity(
          commentWithAttachments.id,
          content,
          userId,
          user?.fullName || user?.username || 'Anonymous',
          undefined, // targetUserId
          undefined, // newsId
          undefined, // newsTitle
          bookId,
          book.title,
          parentCommentId,
          user?.avatarUrl || undefined,
          io
        );
        
        console.log('[STREAM] Comment activity created and broadcasted successfully:', commentWithAttachments.id);
      } catch (streamError) {
        console.error('[STREAM] Failed to create comment activity:', streamError);
        // Don't fail the request if stream activity creation fails
      }
      
      res.status(201).json(commentWithAttachments);
    } catch (error) {
      console.error("Add book comment error:", error);
      res.status(500).json({ error: "Failed to add comment to book" });
    }
  });

  // Get book comment replies (lazy load on demand)
  router.get("/comments/:commentId/replies", optionalAuthenticateToken, async (req, res) => {
    console.log("Get book comment replies endpoint called for comment ID:", req.params.commentId);
    try {
      const { commentId } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      const replies = await storage.getBookCommentReplies(commentId, currentUserId);
      
      res.json(replies);
    } catch (error) {
      console.error("Get book comment replies error:", error);
      res.status(500).json({ error: "Failed to fetch book comment replies" });
    }
  });

  // Get comments for a book
  router.get('/:bookId/comments', optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get comments for the book
      const comments = await storage.getComments(bookId, currentUserId);
      
      // Ensure all comments have their attachments properly populated
      // (double-check in case storage.getComments didn't populate them correctly)
      const commentsWithVerifiedAttachments = await Promise.all(comments.map(async (comment) => {
        if (!comment.attachments || comment.attachments.length === 0) {
          // If no attachments found, query directly from fileUploads
          const directAttachments = await db.select({
            id: fileUploads.id,
            fileUrl: fileUploads.fileUrl,
            filename: fileUploads.filename,
            fileSize: fileUploads.fileSize,
            mimeType: fileUploads.mimeType,
            thumbnailUrl: fileUploads.thumbnailUrl
          })
          .from(fileUploads)
          .where(and(
            eq(fileUploads.entityId, comment.id),
            eq(fileUploads.entityType, 'comment')
          ));
          
          // Add attachments to the comment object
          return {
            ...comment,
            attachments: directAttachments.map(att => ({
              uploadId: att.id,
              url: att.fileUrl,
              filename: att.filename,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              thumbnailUrl: att.thumbnailUrl
            }))
          };
        }
        return comment;
      }));
      
      res.json({
        comments: commentsWithVerifiedAttachments,
        pagination: {
          limit: commentsWithVerifiedAttachments.length, // Total number returned
          offset: 0,
          total: commentsWithVerifiedAttachments.length,
          has_more: false // No pagination implemented in storage.getComments
        }
      });
    } catch (error) {
      console.error("Get book comments error:", error);
      res.status(500).json({ error: "Failed to get comments for book" });
    }
  });

  // Get user review for a book
  router.get('/:bookId/user-review/:userId', optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId, userId } = req.params;
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get user's review for this book
      const userReview = await storage.getUserReview(userId, bookId);
      
      res.json(userReview || null);
    } catch (error) {
      console.error("Get user review error:", error);
      res.status(500).json({ error: "Failed to get user review" });
    }
  });
  
  // Create a new review for a book
  router.post('/:bookId/reviews', authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { content, rating, parentReviewId, quotedText, attachments } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Review content is required" });
      }
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // If this is a reply, verify the parent review exists
      if (parentReviewId) {
        const parentReview = await storage.getReviewById(parentReviewId);
        if (!parentReview || parentReview.bookId !== bookId) {
          return res.status(404).json({ error: "Parent review not found or does not belong to this book" });
        }
      }
      
      // Create the review
      const newReview = await storage.createReview({
        userId,
        bookId,
        content: content.trim(),
        rating: rating || null, // Rating is optional
        parentReviewId: parentReviewId || null,
        quotedText: quotedText || null
      });
      
      // If there are attachments, update their entityId to link them to this review
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        try {
          console.log('Linking attachments to review:', attachments, 'Review ID:', newReview.id, 'Uploader ID:', userId);
          
          // First, verify the files exist and belong to the user
          const existingFiles = await db.select({
            id: fileUploads.id,
            uploaderId: fileUploads.uploaderId,
            entityType: fileUploads.entityType,
            entityId: fileUploads.entityId
          })
            .from(fileUploads)
            .where(
              and(
                inArray(fileUploads.id, attachments),
                eq(fileUploads.uploaderId, userId),
                sql`(${fileUploads.entityType} = 'temp' OR (${fileUploads.entityType} = 'review' AND ${fileUploads.entityId} IS NULL))`
              )
            );
          
          console.log('Found existing files to link:', existingFiles.length, 'out of', attachments.length);
          
          if (existingFiles.length > 0) {
            // Extract the IDs of files that need to be updated
            const fileIdsToUpdate = existingFiles.map(file => file.id);
            
            // Update file uploads to link them to the created review
            const result = await db.update(fileUploads)
              .set({ entityId: newReview.id })
              .where(
                and(
                  inArray(fileUploads.id, fileIdsToUpdate),
                  eq(fileUploads.uploaderId, userId),
                  sql`(${fileUploads.entityType} = 'temp' OR (${fileUploads.entityType} = 'review' AND ${fileUploads.entityId} IS NULL))`
                )
              ).execute();
            
            console.log('Review attachment linking result - rows affected:', result);
          }
        } catch (attachmentError) {
          console.error('Error updating review attachment entity IDs:', attachmentError);
          // Don't fail the review creation if attachment linking fails
        }
      }
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        const user = await storage.getUser(userId);
        const io = (req.app as any).io;
        
        // Prepare review data for broadcast to book-specific room
        const reviewData = {
          ...newReview,
          username: user?.username,
          fullName: user?.fullName,
          avatarUrl: user?.avatarUrl
        };
        
        // Emit to book-specific room
        if (io) {
          io.to(`book-reviews:${bookId}`).emit('new-review', reviewData);
        }
        
        // Create activity entry and broadcast to global stream
        await createReviewActivity(
          newReview.id,
          content,
          rating || 0,
          userId,
          user?.username || user?.fullName || 'Anonymous',
          bookId,
          book.title,
          io
        );
        
        console.log('[STREAM] Review activity created and broadcasted successfully:', newReview.id);
      } catch (streamError) {
        console.error('[STREAM] Failed to create review activity:', streamError);
        // Don't fail the request if stream activity creation fails
      }
      
      res.status(201).json(newReview);
    } catch (error) {
      console.error("Create book review error:", error);
      res.status(500).json({ error: "Failed to create review for book" });
    }
  });
  
  // Get all reviews for a book
  router.get('/:bookId/reviews', optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get all reviews for the book
      const reviews = await storage.getReviews(bookId, currentUserId);
      
      res.json(reviews);
    } catch (error) {
      console.error("Get book reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews for book" });
    }
  });
  
  // Get comment count for a book
  router.get('/:bookId/comments/count', optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      
      // Verify that the book exists
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get comment count for the book
      try {
        // Get all comments and count them
        const comments = await storage.getComments(bookId);
        res.json({ count: comments.length });
      } catch (storageError) {
        console.error("Error getting comment count:", storageError);
        // Fallback: return 0 if there's an error
        res.json({ count: 0 });
      }
    } catch (error) {
      console.error("Get book comment count error:", error);
      res.status(500).json({ error: "Failed to get comment count for book" });
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

  // Import and use translation routes
  // We'll import the translation routes directly into the books router
  // to make the path /api/books/:bookId/translations work correctly
  
  // Get all translations for a book
  router.get('/:bookId/translations', async (req, res) => {
    try {
      const { bookId } = req.params;
      
      // Import the logic from bookTranslations
      const { db } = await import('../storage/db');
      const { bookTranslations } = await import('@shared/schema');
      
      const translations = await db
        .select({
          id: bookTranslations.id,
          language: bookTranslations.language,
          translationType: bookTranslations.translationType,
          translationService: bookTranslations.translationService,
          fileType: bookTranslations.fileType,
          fileSize: bookTranslations.fileSize,
          status: bookTranslations.status,
          progress: bookTranslations.progress,
          statusDetails: bookTranslations.statusDetails,
          errorMessage: bookTranslations.errorMessage,
          createdAt: bookTranslations.createdAt,
          completedAt: bookTranslations.completedAt,
          partialFilePath: bookTranslations.partialFilePath,
          lastCompletedChunk: bookTranslations.lastCompletedChunk,
          totalChunks: bookTranslations.totalChunks,
          totalCharacters: bookTranslations.totalCharacters,
          translatedCharacters: bookTranslations.translatedCharacters,
        })
        .from(bookTranslations)
        .where(eq(bookTranslations.bookId, bookId));
      
      res.json(translations);
    } catch (error) {
      console.error('Error fetching translations:', error);
      res.status(500).json({ error: 'Failed to fetch translations' });
    }
  });

  // Upload a new book with file
  router.post("/upload", authenticateToken, (req, res, next) => {
    // Configure multer for book uploads
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        // Save cover images and video covers to the covers directory, other files to books directory
        if (file.fieldname === 'coverImage' || file.fieldname === 'videoCover') {
          cb(null, 'uploads/covers/');
        } else {
          cb(null, 'uploads/books/');
        }
      },
      filename: function (req, file, cb) {
        // Generate unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
      }
    });
    
    const upload = multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
      },
      fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        // Allow book files, images, and videos
        const allowedTypes = [
          'image/jpeg',
          'image/png', 
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/webm',
          'video/ogg',
          'video/avi',
          'video/mov',
          'video/wmv',
          'video/mpeg',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/epub+zip', // .epub
          'text/plain',
          'application/fb2',
          'application/x-fictionbook+xml',
          'text/xml',
          'application/octet-stream' // Generic binary (might be FB2)
        ];
        
        // Also check file extension for FB2 files and video files
        const fileName = file.originalname.toLowerCase();
        const isFB2File = fileName.endsWith('.fb2');
        const isVideoFile = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.mpeg'].some(ext => fileName.endsWith(ext));
        
        if (allowedTypes.includes(file.mimetype) || isFB2File || isVideoFile) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      }
    });

    const uploadMiddleware = upload.fields([
      { name: 'coverImage', maxCount: 1 }, 
      { name: 'videoCover', maxCount: 1 },
      { name: 'bookFile', maxCount: 1 }
    ]);
    
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 100MB limit' });
        }
        if (err.message === 'Unexpected field') {
          return res.status(400).json({ error: `Unexpected file field. Only 'coverImage' and 'bookFile' are allowed.` });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const bookData = req.body;
      
      // Validate required fields
      if (!bookData.title || !bookData.author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      
      // Prepare book data with file paths if files were uploaded
      const currentUser = await storage.getUser((req as any).user.userId);
      const isAdmin = currentUser?.accessLevel === 'admin' || currentUser?.accessLevel === 'moder';
      
      const newBookData: any = {
        title: bookData.title,
        author: bookData.author,
        description: bookData.description || null,
        genre: bookData.genre || null,
        publishedYear: bookData.publishedYear ? parseInt(bookData.publishedYear) : null,
        publishedAt: bookData.publishedAt ? new Date(bookData.publishedAt) : null,
        isActive: isAdmin, // Books uploaded by admins/mods should be active by default, regular users' books are inactive
        userId: (req as any).user.userId // Set the uploader ID
      };
      
      // Handle cover image upload
      if (files && files.coverImage && files.coverImage[0]) {
        newBookData.coverImageUrl = '/uploads/covers/' + files.coverImage[0].filename;
      }
      
      // Handle video cover upload
      let tempVideoCoverPath = null;
      if (files && files.videoCover && files.videoCover[0]) {
        tempVideoCoverPath = 'uploads/covers/' + files.videoCover[0].filename;
        // Temporary URL - will be updated after book creation
        newBookData.videoCoverUrl = '/uploads/covers/' + files.videoCover[0].filename;
      }
      
      // Handle book file upload
      if (files && files.bookFile && files.bookFile[0]) {
        const bookFile = files.bookFile[0];
        newBookData.filePath = '/uploads/books/' + bookFile.filename;
        newBookData.fileSize = bookFile.size;
        
        // Determine proper MIME type based on file extension if multer detected generic type
        const fileExtension = path.extname(bookFile.originalname).toLowerCase();
        if (bookFile.mimetype === 'application/octet-stream') {
          // Map file extensions to proper MIME types
          switch (fileExtension) {
            case '.fb2':
            case '.fb2.zip':
              newBookData.fileType = 'application/fb2';
              break;
            case '.epub':
              newBookData.fileType = 'application/epub+zip';
              break;
            case '.pdf':
              newBookData.fileType = 'application/pdf';
              break;
            case '.doc':
              newBookData.fileType = 'application/msword';
              break;
            case '.docx':
              newBookData.fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              break;
            case '.txt':
              newBookData.fileType = 'text/plain';
              break;
            case '.xml':
              newBookData.fileType = 'text/xml';
              break;
            default:
              newBookData.fileType = bookFile.mimetype;
          }
        } else {
          newBookData.fileType = bookFile.mimetype;
        }
      }
      
      // Validate that at least a file path is provided
      if (!newBookData.filePath) {
        return res.status(400).json({ error: "Book file is required" });
      }

      const book = await storage.createBook(newBookData);
      
      // If there's a video cover, rename it to the proper format using the book ID
      if (tempVideoCoverPath) {
        try {
          const originalFilename = path.basename(tempVideoCoverPath);
          const newVideoCoverPath = BookFileManager.moveCoverImageFromTemp(book.id, tempVideoCoverPath, originalFilename);
          
          // Update the book's videoCoverUrl in the database
          await db.update(booksSchema).set({ videoCoverUrl: newVideoCoverPath }).where(eq(booksSchema.id, book.id));
          
          // Update the book object to return the correct URL
          book.videoCoverUrl = newVideoCoverPath;
        } catch (error) {
          console.error('Error renaming video cover file:', error);
          // Don't fail the entire operation if file rename fails
        }
      }
      
      // Add book to user's "Загруженные" shelf
      try {
        const userId = (req as any).user.userId;
        
        // Find or create the "Загруженные" shelf for this user
        let uploadedShelf = null;
        const userShelves = await storage.getShelves(userId);
        uploadedShelf = userShelves.find((shelf: any) => shelf.name === 'Загруженные');
        
        if (!uploadedShelf) {
          // Create the "Загруженные" shelf if it doesn't exist
          uploadedShelf = await storage.createShelf(userId, {
            name: 'Загруженные',
            description: 'Загруженные книги',
            color: 'bg-blue-100 dark:bg-blue-900/20'
          });
          console.log('[SHELF] Created new "Загруженные" shelf for user:', userId);
        } else {
          console.log('[SHELF] Found existing "Загруженные" shelf for user:', userId);
        }
        
        // Add the book to the "Загруженные" shelf
        await storage.addBookToShelf(uploadedShelf.id, book.id);
        console.log('[SHELF] Added book to "Загруженные" shelf:', book.id);
      } catch (shelfError) {
        console.error('[SHELF] Error adding book to "Загруженные" shelf:', shelfError);
        // Don't fail the entire operation if shelf operation fails
      }

      // Create activity feed entry and broadcast via WebSocket
      try {
        const user = await storage.getUser((req as any).user.userId);
        const io = (req.app as any).io;
        
        await createBookActivity(
          book.id,
          book.title,
          book.author,
          (req as any).user.userId,
          user?.username || user?.fullName || 'Anonymous',
          book.coverImageUrl || undefined,
          book.videoCoverUrl || undefined,
          user?.avatarUrl || undefined,
          user?.profileRating ? parseFloat(user.profileRating.toString()) : undefined,
          io
        );
        
        console.log('[STREAM] Book activity created and broadcasted successfully:', book.id);
      } catch (streamError) {
        console.error('[STREAM] Failed to create book activity:', streamError);
        // Don't fail the request if stream activity creation fails
      }

      res.status(201).json(book);
    } catch (error) {
      console.error("Upload book error:", error);
      res.status(500).json({ error: "Failed to upload book" });
    }
  });

  return router;
}