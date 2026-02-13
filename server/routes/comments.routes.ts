import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { comments, users, reactions } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

console.log('*** COMMENTS ROUTES FILE LOADED ***');

export function createCommentsRouter() {
  console.log('*** COMMENTS ROUTER LOADED ***');
  const router = Router();
  
  // Test route to verify router is working
  router.get('/test', (req, res) => {
    console.log('*** TEST ROUTE HIT ***');
    res.json({ message: 'Test route working' });
  });
  
  // Test POST route without authentication to verify basic functionality
  router.post('/test-post', (req, res) => {
    console.log('*** TEST POST ROUTE HIT ***');
    res.json({ message: 'Test post route working', data: req.body });
  });
  
  // Toggle reaction on a comment (works for both book and article comments)
  router.post("/:commentId/reaction", authenticateToken, async (req, res) => {
    console.log('*** REACTION ENDPOINT HIT ***');
    console.log('*** REACTION ENDPOINT - FULL PATH:', req.path, 'ORIGINAL URL:', req.originalUrl, '***');
    console.log('[Reaction Endpoint] Processing reaction request for commentId:', req.params.commentId);
    
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;

      console.log('[Reaction Endpoint] Received data - userId:', userId, 'emoji:', emoji);
      
      if (!emoji) {
        console.log('[Reaction Endpoint] Missing emoji in request');
        return res.status(400).json({ error: "Emoji is required" });
      }

      // First, get the comment to determine if it's for a book or article
      let comment;
      try {
        comment = await storage.getCommentById(commentId);
        console.log('[Reaction Endpoint] Retrieved comment:', !!comment, 'commentId:', commentId);
      } catch (error) {
        console.error("Error retrieving comment:", error);
        return res.status(500).json({ error: "Failed to retrieve comment" });
      }
      
      if (!comment) {
        console.log('[Reaction Endpoint] Comment not found:', commentId);
        return res.status(404).json({ error: "Comment not found" });
      }

      // Check if user already reacted with this emoji
      let existingReactions;
      try {
        existingReactions = await storage.getCommentReactions(commentId, userId);
        console.log('[Reaction Endpoint] Existing reactions:', existingReactions);
      } catch (error) {
        console.error("Error retrieving existing reactions:", error);
        return res.status(500).json({ error: "Failed to retrieve existing reactions" });
      }
      const alreadyReacted = existingReactions.some(r => r.emoji === emoji && r.userReacted);
      console.log('[Reaction Endpoint] Already reacted:', alreadyReacted);
    
      let action: 'added' | 'removed';
      try {
        if (alreadyReacted) {
          // Remove reaction - the method will handle both book and article comments
          console.log('[Reaction Endpoint] Removing reaction');
          const success = await storage.removeBookCommentReaction(userId, commentId, emoji);
          action = 'removed';
        } else {
          // Add reaction - the method will handle both book and article comments
          console.log('[Reaction Endpoint] Adding reaction');
          await storage.addBookCommentReaction(userId, commentId, emoji);
          action = 'added';
        }
        
        // Get updated reactions after add or remove
        const updatedReactions = await storage.getCommentReactions(commentId, userId);
        const totalReactionCount = updatedReactions.reduce((sum, r) => sum + r.count, 0);
        
        // Log reaction activity (only when added)
        try {
          console.log('[Comment Reaction] ENABLE_LAST_ACTIONS_TRACKING:', process.env.ENABLE_LAST_ACTIONS_TRACKING);
          if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
            console.log('[Comment Reaction] Logging reaction activity for comment:', commentId);
            console.log('[Comment Reaction] Comment found:', !!comment, comment?.bookId, comment?.articleId);
            
              if (comment) {
                let targetTitle = 'Unknown';
                let targetType = 'unknown';
                let targetId = comment.bookId || comment.articleId || 'unknown';
              
                if (comment.bookId) {
                  const book = await storage.getBook(comment.bookId);
                  targetType = 'book';
                  targetId = comment.bookId;
                  targetTitle = book?.title || 'Unknown';
                } else if (comment.articleId) {
                  // Check if getArticleById exists in the storage
                  if (typeof storage.getArticleById === 'function') {
                    const article = await storage.getArticleById(comment.articleId);
                    targetType = 'article';
                    targetId = comment.articleId;
                    targetTitle = article?.title || 'Unknown';
                  } else {
                    // Fallback to using articleId from comment directly
                    targetType = 'article';
                    targetId = comment.articleId;
                    targetTitle = 'Article';
                  }
                }
              
                const commentAuthor = await storage.getUser(comment.userId);
                console.log('[Comment Reaction] Target:', targetType, targetTitle, 'Author:', commentAuthor?.username);
              
                const actionData = {
                  userId: userId,
                  actionType: 'comment_reaction',
                  targetType: targetType,
                  targetId: targetId,
                  metadata: { 
                    emoji: emoji,
                    comment_id: commentId,
                    comment_preview: comment.content.substring(0, 50),
                    comment_author: commentAuthor?.username || 'Unknown',
                    target_title: targetTitle,
                    total_reactions: totalReactionCount
                  }
                };
              
                console.log('[Comment Reaction] Creating user action:', actionData);
                const userAction = await storage.createUserAction(actionData);
                console.log('[Comment Reaction] User action created:', userAction?.id);
              
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
                      type: targetType,
                      id: targetId,
                      title: targetTitle
                    },
                    metadata: userAction.metadata,
                    createdAt: userAction.createdAt,
                    timestamp: userAction.createdAt.toISOString()
                  };
                
                  console.log('[Comment Reaction] Broadcasting to stream:last-actions');
                  io.to('stream:last-actions').emit('stream:last-action', eventData);
                  console.log('[Comment Reaction] ✓ Broadcast sent');
                }
              }
            }
          } catch (activityError) {
            console.error('[Comment Reaction] Failed to log activity:', activityError);
            // Don't fail the reaction if activity logging fails
          }
        
        // Get updated reactions
        let reactions;
        try {
          reactions = await storage.getCommentReactions(commentId, userId);
          console.log("[Reaction Endpoint] Final reactions:", reactions);
        } catch (error) {
          console.error("Error retrieving final reactions:", error);
          return res.status(500).json({ error: "Failed to retrieve reactions" });
        }
        
        const responsePayload = { action, reactions };
        console.log("[Reaction Endpoint] About to send response:", responsePayload);
        
        // Broadcast reaction update via WebSocket for real-time UI updates
        try {
          if ((req.app as any).io) {
            const io = (req.app as any).io;
            
            // Group reactions by emoji for the stream
            const groupedReactions: Record<string, any[]> = {};
            reactions.forEach((reaction: any) => {
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
              commentId: commentId,
              entityId: commentId,
              entityType: 'comment',
              bookId: comment?.bookId || null,
              articleId: comment?.articleId || null,
              reactions: streamReactions,
              action
            });
            
            console.log('[Comment Reaction] Broadcasted stream:reaction-update');
          }
        } catch (wsError) {
          console.error('[Comment Reaction] Failed to broadcast reaction update:', wsError);
          // Don't fail the request if WebSocket broadcast fails
        }
        
        // Set headers explicitly
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        
        // Send the response
        res.status(200).json(responsePayload);
        
        console.log("[Reaction Endpoint] Response sent successfully");
      } catch (reactionError) {
        console.error("Error processing comment reaction:", reactionError);
        return res.status(500).json({ error: "Failed to process reaction" });
      }
    } catch (error) {
      console.error("[Reaction Endpoint] Outer error in toggle comment reaction:", error);
      // Ensure we send JSON even in outer catch block
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });

  // Get detailed reactions for a book comment
  router.get("/:commentId/reactions", optionalAuthenticateToken, async (req, res) => {
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
  
  // Get replies to a comment
  router.get('/:commentId/replies', optionalAuthenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      console.log('DEBUG: Get comment replies route called for commentId:', commentId);
      const currentUserId = (req as any).user?.userId;
        
      // Get replies for the comment
      console.log('DEBUG: Calling storage.getBookCommentReplies for commentId:', commentId);
      const replies = await storage.getBookCommentReplies(commentId, currentUserId);
      console.log('DEBUG: Replies returned from storage:', replies.length);
        
      res.json(replies);
    } catch (error) {
      console.error("Get comment replies error:", error);
      res.status(500).json({ error: "Failed to get comment replies" });
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