import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { profileRatings, users } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createRatingsRouter() {
  const router = Router();

  // Create or update a profile rating
  router.post("/profile/:profileId/rating", authenticateToken, async (req, res) => {
    console.log("Create/update profile rating endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { profileId } = req.params;
      const { rating } = req.body;
      
      // Validate rating
      if (rating === undefined || rating === null) {
        return res.status(400).json({ error: "Rating is required" });
      }
      
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 10" });
      }
      
      // Prevent self-rating
      if (userId === profileId) {
        return res.status(400).json({ error: "You cannot rate your own profile" });
      }
      
      const result = await storage.createProfileRating({
        userId,
        profileId,
        rating
      });
      
      // Log profile rating action and broadcast via WebSocket
      try {
        if (process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true') {
          console.log('[Profile Rating] Creating user action for profile rating event');
          const action = await storage.createUserAction({
            userId: userId,
            actionType: 'profile_rating',
            targetType: 'user',
            targetId: profileId,
            metadata: { 
              rating: rating
            }
          });
          console.log('[Profile Rating] User action created:', action?.id);
          
          // Broadcast profile rating event via WebSocket
          if ((req.app as any).io && action) {
            const io = (req.app as any).io;
            console.log('[Profile Rating] Broadcasting profile rating event');
            
            // Get user info for broadcast
            const user = await storage.getUser(userId);
            const targetUser = await storage.getUser(profileId);
            
            const eventData = {
              id: action.id,
              type: 'user_action',
              action_type: action.actionType,
              entityId: action.id,
              userId: userId,
              user: {
                id: userId,
                username: user?.username || 'Unknown',
                avatar_url: user?.avatarUrl || null
              },
              target: {
                type: 'user',
                id: profileId,
                username: targetUser?.username || 'Unknown'
              },
              metadata: action.metadata,
              createdAt: action.createdAt,
              timestamp: action.createdAt.toISOString()
            };
            
            // Broadcast to last-actions room
            io.to('stream:last-actions').emit('stream:last-action', eventData);
            console.log('[Profile Rating] ✓ Profile rating event broadcasted');
          }
        }
      } catch (actionError) {
        console.error('[Profile Rating] Failed to log user action or broadcast event:', actionError);
        // Don't fail profile rating creation if action logging fails
      }
      
      res.json(result);
    } catch (error) {
      console.error("Create profile rating error:", error);
      res.status(500).json({ error: "Failed to create profile rating" });
    }
  });

  // Get all ratings for a profile
  router.get("/profile/:profileId/ratings", optionalAuthenticateToken, async (req, res) => {
    console.log("Get profile ratings endpoint called");
    try {
      const { profileId } = req.params;
      
      const ratings = await storage.getProfileRatings(profileId);
      
      res.json(ratings);
    } catch (error) {
      console.error("Get profile ratings error:", error);
      res.status(500).json({ error: "Failed to get profile ratings" });
    }
  });

  // Delete a profile rating
  router.delete("/profile/rating/:ratingId", authenticateToken, async (req, res) => {
    console.log("Delete profile rating endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { ratingId } = req.params;
      const user = (req as any).user;
      
      // Allow deletion by owner or admin/moderator
      const isAdminOrModer = user.accessLevel === 'admin' || user.accessLevel === 'moder';
      const userIdToPass = isAdminOrModer ? null : userId;
      
      const success = await storage.deleteProfileRating(ratingId, userIdToPass);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Rating not found" });
      }
    } catch (error) {
      console.error("Delete profile rating error:", error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        res.status(403).json({ error: "You can only delete your own ratings" });
      } else {
        res.status(500).json({ error: "Failed to delete profile rating" });
      }
    }
  });



  return router;
}