import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { reviews, users, reactions } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createReviewsRouter() {
  const router = Router();

  // Create a review for a book
  router.post("/api/books/:bookId/reviews", authenticateToken, async (req, res) => {
    console.log("Create review endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const { rating, content, attachments, parentReviewId, quotedText } = req.body;
      
      console.log(`Creating review for book ${bookId} by user ${userId} with rating ${rating}`);
      
      // Content is always required
      if (content === undefined || content === null || content.trim() === '') {
        return res.status(400).json({ error: "Content is required" });
      }
      
      // Rating is only required for root reviews, not for replies
      if (!parentReviewId) {
        if (rating === undefined || rating === null) {
          return res.status(400).json({ error: "Rating is required for reviews" });
        }
        // Validate rating is between 1 and 10
        if (typeof rating !== 'number' || rating < 1 || rating > 10) {
          return res.status(400).json({ error: "Rating must be a number between 1 and 10" });
        }
      }
      
      // Only check for existing review if this is not a reply
      if (!parentReviewId) {
        const existingReview = await storage.getUserReview(userId, bookId);
        if (existingReview) {
          return res.status(400).json({ error: "You have already reviewed this book" });
        }
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
        attachmentMetadata,
        parentReviewId: parentReviewId || null,
        quotedText: quotedText || null
      });
      
      // Create activity feed entry and broadcast via WebSocket
      try {
        console.log('[STREAM DEBUG] Starting activity broadcast for review:', review.id);
        console.log('[STREAM DEBUG] Socket.IO instance available:', !!(req.app as any).io);
        
        const user = await storage.getUser(userId);
        const book = await storage.getBook(bookId);
        
        console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
        console.log('[STREAM DEBUG] Book found:', !!book, book ? book.title : 'N/A');
        
        if (user && book && (req.app as any).io) {
          console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
          
          const io = (req.app as any).io;
          
          // Check room status
          const globalRoom = io.sockets.adapter.rooms.get('stream:global');
          console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
          
          // Broadcast to book-specific room
          const eventData = {
            id: review.id,
            type: 'review',
            entity_type: 'book',
            entity_id: bookId,
            rating: review.rating,
            content: review.content,
            author: {
              id: user?.id,
              username: user?.username || 'Unknown',
              avatar_url: user?.avatarUrl || null
            },
            book: {
              id: book?.id,
              title: book?.title || 'Unknown'
            },
            created_at: review.createdAt,
            timestamp: review.createdAt.toISOString()
          };
          
          console.log('[STREAM DEBUG] Broadcasting to book-reviews:', bookId);
          io.to(`book-reviews:${bookId}`).emit('stream:review', eventData);
          console.log('[STREAM DEBUG] ✓ Review broadcast sent to book room');
          
          // Also broadcast to global stream
          io.to('stream:global').emit('stream:activity', eventData);
          console.log('[STREAM DEBUG] ✓ Review broadcast sent to global stream');
        }
      } catch (broadcastError) {
        console.error('[STREAM DEBUG] Failed to broadcast review:', broadcastError);
      }
      
      res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Get reviews for a book
  router.get("/api/books/:bookId/reviews", optionalAuthenticateToken, async (req, res) => {
    console.log("Get reviews endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId; // Optional userId
      
      // getReviews now returns only root reviews with reactions and reply counts
      const reviews = await storage.getReviews(bookId, userId);
      
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Delete a review (user can delete their own)
  router.delete("/api/reviews/:id", authenticateToken, async (req, res) => {
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
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting review deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✓ Deletion broadcast sent');
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

  // Get replies for a review
  router.get("/api/reviews/:reviewId/replies", optionalAuthenticateToken, async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = (req as any).user?.userId;
      
      const replies = await storage.getReviewReplies(reviewId, userId);
      res.json(replies);
    } catch (error) {
      console.error("Get review replies error:", error);
      res.status(500).json({ error: "Failed to get review replies" });
    }
  });

  // Toggle reaction on a review
  router.post("/:reviewId/reaction", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { reviewId } = req.params;
      const { emoji } = req.body;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Check if user already reacted with this emoji
      const existingReactions = await storage.getReviewReactions(reviewId, userId);
      const existingReaction = existingReactions.find(r => r.emoji === emoji && r.userReacted);
      
      if (existingReaction) {
        // Remove the reaction
        await storage.removeReviewReaction(userId, reviewId, emoji);
      } else {
        // Add the reaction
        await storage.addReviewReaction(userId, reviewId, emoji);
        
        // Get updated reactions to include total count
        const updatedReactionsForCount = await storage.getReviewReactions(reviewId, userId);
        const totalReactionCount = updatedReactionsForCount.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          console.log('[Book Review Reaction] ENABLE_LAST_ACTIONS_TRACKING:', process.env.ENABLE_LAST_ACTIONS_TRACKING);
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            console.log('[Book Review Reaction] Logging reaction activity for review:', reviewId);
            const review = await storage.getReviewById(reviewId);
            console.log('[Book Review Reaction] Review found:', !!review, review?.bookId);
            if (review) {
              const book = await storage.getBook(review.bookId);
              const reviewAuthor = await storage.getUser(review.userId);
              console.log('[Book Review Reaction] Book:', book?.title, 'Author:', reviewAuthor?.username);
              
              const actionData = {
                userId: userId,
                actionType: 'book_review_reaction',
                targetType: 'book',
                targetId: review.bookId,
                metadata: { 
                  emoji: emoji,
                  review_id: reviewId,
                  review_preview: review.content.substring(0, 50),
                  review_author: reviewAuthor?.username || 'Unknown',
                  book_title: book?.title || 'Unknown',
                  total_reactions: totalReactionCount
                }
              };
              
              console.log('[Book Review Reaction] Creating user action:', actionData);
              const userAction = await storage.createUserAction(actionData);
              console.log('[Book Review Reaction] User action created:', userAction?.id);
              
              if ((req.app as any).io && userAction) {
                const io = (req.app as any).io;
                const user = await storage.getUser(userId);
                
                const eventData = {
                  id: userAction.id,
                  type: 'user_action',
                  action_type: userAction.actionType,
                  entityId: userAction.id,
                  userId: userId,
                  user: {
                    id: userId,
                    username: user?.username || 'Unknown',
                    avatar_url: user?.avatarUrl || null
                  },
                  target: {
                    type: 'book',
                    id: review.bookId,
                    title: book?.title || 'Unknown'
                  },
                  metadata: userAction.metadata,
                  createdAt: userAction.createdAt,
                  timestamp: userAction.createdAt.toISOString()
                };
                
                console.log('[Book Review Reaction] Broadcasting to stream:last-actions');
                io.to('stream:last-actions').emit('stream:last-action', eventData);
                console.log('[Book Review Reaction] ✓ Broadcast sent');
              }
            }
          }
        } catch (actionError) {
          console.error('[Book Review Reaction] Failed to log action:', actionError);
        }
      }
      
      // Return updated reactions
      const updatedReactions = await storage.getReviewReactions(reviewId, userId);
      
      // Get review to find bookId for WebSocket broadcast
      const review = await storage.getReviewById(reviewId);
      const reviewBookId = review?.bookId || null;
      
      // Broadcast reaction update via WebSocket for real-time UI updates
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Group reactions by emoji for the stream
          const groupedReactions: Record<string, any[]> = {};
          updatedReactions.forEach((reaction: any) => {
            const emoji = reaction.emoji;
            if (!groupedReactions[emoji]) {
              groupedReactions[emoji] = [];
            }
            groupedReactions[emoji].push(reaction);
          });
          
          // Create aggregated reactions array for stream
          const streamReactions: any[] = [];
          Object.entries(groupedReactions).forEach(([emoji, reactionList]: [string, any[]]) => {
            streamReactions.push({
              emoji,
              count: reactionList.length,
              userReacted: reactionList.some((r: any) => r.userId === userId)
            });
          });
          
          // Emit reaction update to stream rooms
          io.to('stream:global').emit('stream:reaction-update', {
            entityId: reviewId,
            entityType: 'review',
            bookId: reviewBookId,
            reactions: streamReactions,
            action: existingReaction ? 'removed' : 'added'
          });
          
          console.log('[Review Reaction] Broadcasted stream:reaction-update');
        }
      } catch (wsError) {
        console.error('[Review Reaction] Failed to broadcast reaction update:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }
      
      res.json({ reactions: updatedReactions });
    } catch (error) {
      console.error("Toggle review reaction error:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });

  // Get detailed reactions for a review
  router.get("/:reviewId/reactions", optionalAuthenticateToken, async (req, res) => {
    try {
      const { reviewId } = req.params;
      
      // Get detailed reactions with user information
      const reactions = await storage.getReactions(reviewId, 'review');
      
      res.json(reactions);
    } catch (error) {
      console.error("Get review reactions error:", error);
      res.status(500).json({ error: "Failed to get review reactions" });
    }
  });

  return router;
}