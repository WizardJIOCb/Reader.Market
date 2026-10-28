import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { comments, users, reactions } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createCommentsRouter() {
  const router = Router();

  // Create a comment for a book
  router.post("/api/books/:bookId/comments", authenticateToken, async (req, res) => {
    console.log("Create comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { bookId } = req.params;
      const { content, attachments, parentCommentId, quotedText } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
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
      
      const comment = await storage.createComment({
        userId,
        bookId,
        content,
        attachmentMetadata,
        parentCommentId: parentCommentId || null,
        quotedText: quotedText || null
      });
      
      // Automatically subscribe user to this book when they comment
      try {
        await storage.subscribeToEntity(userId, 'book', bookId);
        console.log(`[SUBSCRIPTION] User ${userId} automatically subscribed to book ${bookId}`);
      } catch (subscribeError) {
        console.error('[SUBSCRIPTION] Failed to subscribe user to book:', subscribeError);
        // Don't fail the comment creation if subscription fails
      }
      
      // Create activity feed entry and broadcast via WebSocket
      // TEMPORARY: Direct broadcast test to diagnose real-time issues
      try {
        console.log('[STREAM DEBUG] Starting activity broadcast for comment:', comment.id);
        console.log('[STREAM DEBUG] Socket.IO instance available:', !!(req.app as any).io);
        
        const user = await storage.getUser(userId);
        const book = await storage.getBook(bookId);
        
        console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
        console.log('[STREAM DEBUG] Book found:', !!book, book ? book.title : 'N/A');
        
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          
          // Broadcast to book-specific room
          const eventData = {
            id: comment.id,
            type: 'comment',
            entity_type: 'book',
            entity_id: bookId,
            content: comment.content,
            author: {
              id: user?.id,
              username: user?.username || 'Unknown',
              avatar_url: user?.avatarUrl || null
            },
            book: {
              id: book?.id,
              title: book?.title || 'Unknown'
            },
            created_at: comment.createdAt,
            timestamp: comment.createdAt.toISOString()
          };
          
          console.log('[STREAM DEBUG] Broadcasting to book-comments:', bookId);
          io.to(`book-comments:${bookId}`).emit('stream:comment', eventData);
          console.log('[STREAM DEBUG] ✓ Comment broadcast sent to book room');
          
          // Also broadcast to global stream
          io.to('stream:global').emit('stream:activity', eventData);
          console.log('[STREAM DEBUG] ✓ Comment broadcast sent to global stream');
        }
      } catch (broadcastError) {
        console.error('[STREAM DEBUG] Failed to broadcast comment:', broadcastError);
      }
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Get comments for a book
  router.get("/api/books/:bookId/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get comments endpoint called");
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId;
      const comments = await storage.getComments(bookId, userId);
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  // Get total comment count for a book (including replies)
  router.get("/api/books/:bookId/comments/count", optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const commentCount = await storage.getBookTotalCommentCount(bookId);
      res.json({ count: commentCount });
    } catch (error) {
      console.error("Get comment count error:", error);
      res.status(500).json({ error: "Failed to get comment count" });
    }
  });

  // Get replies for a book comment (threaded/nested)
  router.get("/api/comments/:commentId/replies", optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.userId;
      const replies = await storage.getBookCommentReplies(commentId, userId);
      res.json(replies);
    } catch (error) {
      console.error("Get comment replies error:", error);
      res.status(500).json({ error: "Failed to get replies" });
    }
  });

  // Toggle reaction on a book comment
  router.post("/api/comments/:commentId/reaction", authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }

      // Check if user already reacted with this emoji
      const existingReactions = await storage.getCommentReactions(commentId, userId);
      const alreadyReacted = existingReactions.some(r => r.emoji === emoji && r.userReacted);
      
      let action: 'added' | 'removed';
      if (alreadyReacted) {
        await storage.removeBookCommentReaction(userId, commentId, emoji);
        action = 'removed';
      } else {
        await storage.addBookCommentReaction(userId, commentId, emoji);
        action = 'added';
        
        // Get updated reactions to include total count
        const updatedReactions = await storage.getCommentReactions(commentId, userId);
        const totalReactionCount = updatedReactions.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          console.log('[Book Comment Reaction] ENABLE_LAST_ACTIONS_TRACKING:', process.env.ENABLE_LAST_ACTIONS_TRACKING);
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            console.log('[Book Comment Reaction] Logging reaction activity for comment:', commentId);
            const comment = await storage.getCommentById(commentId);
            console.log('[Book Comment Reaction] Comment found:', !!comment, comment?.bookId);
            if (comment) {
              const book = await storage.getBook(comment.bookId);
              const commentAuthor = await storage.getUser(comment.userId);
              console.log('[Book Comment Reaction] Book:', book?.title, 'Author:', commentAuthor?.username);
              
              const actionData = {
                userId: userId,
                actionType: 'book_comment_reaction',
                targetType: 'book',
                targetId: comment.bookId,
                metadata: { 
                  emoji: emoji,
                  comment_id: commentId,
                  comment_preview: comment.content.substring(0, 50),
                  comment_author: commentAuthor?.username || 'Unknown',
                  book_title: book?.title || 'Unknown',
                  total_reactions: totalReactionCount
                }
              };
              
              console.log('[Book Comment Reaction] Creating user action:', actionData);
              const userAction = await storage.createUserAction(actionData);
              console.log('[Book Comment Reaction] User action created:', userAction?.id);
              
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
                    id: comment.bookId,
                    title: book?.title || 'Unknown'
                  },
                  metadata: userAction.metadata,
                  createdAt: userAction.createdAt,
                  timestamp: userAction.createdAt.toISOString()
                };
                
                console.log('[Book Comment Reaction] Broadcasting to stream:last-actions');
                io.to('stream:last-actions').emit('stream:last-action', eventData);
                console.log('[Book Comment Reaction] ✓ Broadcast sent');
              }
            }
          }
        } catch (actionError) {
          console.error('[Book Comment Reaction] Failed to log action:', actionError);
        }
      }
      
      // Get updated reactions
      const reactions = await storage.getCommentReactions(commentId, userId);
      res.json({ action, reactions });
    } catch (error) {
      console.error("Toggle comment reaction error:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });

  // Get detailed reactions for a book comment
  router.get("/api/comments/:commentId/reactions", optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      
      // Get detailed reactions with user information
      const reactions = await storage.getReactions(commentId, 'comment');
      
      res.json(reactions);
    } catch (error) {
      console.error("Get comment reactions error:", error);
      res.status(500).json({ error: "Failed to get comment reactions" });
    }
  });

  // Like/unlike comment
  router.post("/api/comments/:id/like", authenticateToken, async (req, res) => {
    console.log("Toggle comment like endpoint called for comment ID:", req.params.id);
    try {
      const { id: commentId } = req.params;
      const userId = (req as any).user.userId;
      const emoji = req.body.emoji || '👍';
      
      console.log("Received comment like data - userId:", userId, "commentId:", commentId, "emoji:", emoji);
      
      // Verify that the comment exists
      const comment = await storage.getCommentById(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Toggle like on comment
      const reaction = await storage.toggleCommentLike({
        commentId,
        userId,
        emoji
      });
      
      console.log("Successfully toggled like for comment ID:", commentId);
      
      res.json(reaction);
    } catch (error) {
      console.error("Toggle comment like error:", error);
      res.status(500).json({ error: "Failed to toggle comment like" });
    }
  });

  // Delete a comment (user can delete their own)
  router.delete("/api/comments/:id", authenticateToken, async (req, res) => {
    console.log("Delete comment endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      
      const success = await storage.deleteComment(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Comment not found or unauthorized" });
      }
      
      // Broadcast deletion via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting comment deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✓ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  return router;
}