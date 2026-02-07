import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from "../storage";
import { db } from "../storage/db";
import { comments, users, reviews, profileComments, fileUploads, reactions } from '@shared/schema';
import { eq, desc, count, sql, and, isNull, inArray, or } from 'drizzle-orm';
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";

// Use relative path for uploads directory
const avatarUploadPath = path.join(process.cwd(), "uploads", "avatars");

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = avatarUploadPath;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

export function createProfileRouter() {
  const router = Router();

  // Get current user profile
  router.get("/", authenticateToken, logUserAction, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Get user profile by ID
  router.get("/:userId", optionalAuthenticateToken, logUserAction, async (req, res) => {
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        // Try to find by username
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch profile rating from user record (already calculated with Bayesian algorithm)
      let profileRating = user.profileRating ? Number(user.profileRating) : null;
      let ratingCount = 0;
      try {
        const ratings = await storage.getProfileRatings(user.id);
        ratingCount = ratings.length;
      } catch (error) {
        console.error("Error fetching profile ratings:", error);
      }
      
      // Return user profile without sensitive information
      const { password: __, ...userWithoutPassword } = user;
      res.json({
        ...userWithoutPassword,
        profileRating,
        ratingCount
      });
    } catch (error) {
      console.error("Get specific user profile error:", error);
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  // Update profile
  router.put("/", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { fullName, bio, avatarUrl } = req.body;
      
      // Only allow updating specific profile fields
      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Update language
  router.put("/language", authenticateToken, async (req, res) => {
    console.log("========================================");
    console.log("Update language preference endpoint called");
    console.log("Method:", req.method);
    console.log("Path:", req.path);
    console.log("Body:", req.body);
    console.log("========================================");
    try {
      const userId = (req as any).user.userId;
      const { language } = req.body;
      
      // Validate language code
      const supportedLanguages = ['en', 'ru'];
      if (!language || !supportedLanguages.includes(language)) {
        return res.status(400).json({ error: "Invalid language code. Supported languages: en, ru" });
      }
      
      // Update user language preference
      const updatedUser = await storage.updateUser(userId, { language });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json({ success: true, language: updatedUser.language, user: userWithoutPassword });
    } catch (error) {
      console.error("Update language preference error:", error);
      res.status(500).json({ error: "Failed to update language preference" });
    }
  });

  // Update password
  router.put("/password", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      
      // Get user with current password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user has a password (might be OAuth-only user)
      if (!user.password) {
        return res.status(400).json({ error: "Cannot change password for OAuth-only accounts" });
      }
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Upload avatar
  router.post("/avatar", authenticateToken, (req, res, next) => {
    console.log("Avatar upload middleware - starting multer");
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'File upload failed: ' + err.message });
      }
      console.log("Multer processing complete, file:", req.file);
      next();
    });
  }, async (req, res) => {
    console.log("Upload avatar endpoint called");
    console.log("Request headers:", req.headers);
    console.log("Request file:", req.file);
    
    try {
      const userId = (req as any).user.userId;
      
      if (!req.file) {
        console.error("No file uploaded in request");
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      console.log("File uploaded successfully:", req.file.filename);
      
      // Get current user to check for old avatar
      const user = await storage.getUser(userId);
      if (!user) {
        console.error("User not found:", userId);
        return res.status(404).json({ error: "User not found" });
      }
      
      // Delete old avatar file if it exists
      if (user.avatarUrl) {
        const oldAvatarPath = path.join(process.cwd(), user.avatarUrl);
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
            console.log("Old avatar deleted:", oldAvatarPath);
          } catch (err) {
            console.error("Error deleting old avatar:", err);
            // Continue even if old file deletion fails
          }
        }
      }
      
      // Generate relative URL path for the avatar
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      console.log("Updating user with avatar URL:", avatarUrl);
      
      // Update user with new avatar URL
      const updatedUser = await storage.updateUser(userId, { avatarUrl });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      console.log("Avatar upload successful, returning user data");
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Upload avatar error:", error);
      
      // Clean up uploaded file if database update fails
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error cleaning up uploaded file:", err);
        }
      }
      
      return res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Delete avatar
  router.delete("/avatar", authenticateToken, async (req, res) => {
    console.log("Delete avatar endpoint called");
    try {
      const userId = (req as any).user.userId;
      
      // Get current user to check for avatar
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Delete avatar file if it exists
      if (user.avatarUrl) {
        const avatarPath = path.join(process.cwd(), user.avatarUrl);
        if (fs.existsSync(avatarPath)) {
          try {
            fs.unlinkSync(avatarPath);
            console.log("Avatar deleted:", avatarPath);
          } catch (err) {
            console.error("Error deleting avatar file:", err);
            // Continue even if file deletion fails
          }
        }
      }
      
      // Update user to remove avatar URL
      const updatedUser = await storage.updateUser(userId, { avatarUrl: null });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Delete avatar error:", error);
      res.status(500).json({ error: "Failed to delete avatar" });
    }
  });

  // Get user statistics (open to all users)
  router.get("/:userId/statistics", optionalAuthenticateToken, async (req, res) => {
    console.log("Get user statistics endpoint called");
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const stats = await storage.getUserStatistics(user.id);
      
      // Return default stats if user doesn't have statistics yet
      res.json(stats || {
        totalBooksRead: 0,
        totalWordsRead: 0,
        totalLettersRead: 0
      });
    } catch (error) {
      console.error("Get user statistics error:", error);
      res.status(500).json({ error: "Failed to get user statistics" });
    }
  });

  // Increment profile view count
  router.post("/:userId/view", optionalAuthenticateToken, async (req, res) => {
    try {
      const { userId: targetUserId } = req.params;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Increment view count (count all views including self-views)
      const updatedUser = await storage.incrementProfileViewCount(user.id);
      
      res.json({ 
        success: true, 
        viewCount: updatedUser.profileViewCount || 0 
      });
    } catch (error) {
      console.error('[Profile View API] Error:', error);
      res.status(500).json({ error: "Failed to increment profile view count" });
    }
  });

  // Get user profile comments
  router.get('/:userId/comments', optionalAuthenticateToken, async (req, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(targetUserId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(targetUserId);
      } else {
        user = await storage.getUserByUsername(targetUserId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get profile comments made ON this user's profile
      const commentsResult = await db
        .select({
          id: profileComments.id,
          userId: profileComments.userId,
          profileId: profileComments.profileId,
          content: profileComments.content,
          parentCommentId: profileComments.parentCommentId,
          quotedText: profileComments.quotedText,
          createdAt: profileComments.createdAt,
          updatedAt: profileComments.updatedAt,
          attachmentUrls: profileComments.attachmentUrls,
          attachmentMetadata: profileComments.attachmentMetadata,
          // Include user information
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        })
        .from(profileComments)
        .innerJoin(users, eq(profileComments.userId, users.id))
        .where(
          and(
            eq(profileComments.profileId, targetUserId), // Get comments made on this profile
            isNull(profileComments.parentCommentId) // Only get root comments, replies will be handled separately
          )
        )
        .orderBy(desc(profileComments.createdAt))
        .limit(limit)
        .offset(offset);
      
      // For each comment, get its attachments and reactions
      const commentsWithAttachmentsAndReactions = await Promise.all(commentsResult.map(async (comment) => {
        // Get file uploads associated with this comment
        const commentAttachments = await db
          .select({
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
            sql`(${fileUploads.entityType} = 'comment')`
          ));
        
        // Get reactions for this comment
        const commentReactions = await db
          .select({
            id: reactions.id,
            userId: reactions.userId,
            emoji: reactions.emoji,
            createdAt: reactions.createdAt,
            // Join with users table to get user info
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          })
          .from(reactions)
          .leftJoin(users, eq(reactions.userId, users.id))
          .where(eq(reactions.profileCommentId, comment.id));
        
        // Group reactions by emoji to get counts
        const reactionsWithCounts = commentReactions.reduce((acc: Array<{emoji: string, count: number, userReacted: boolean}>, reaction) => {
          const existing = acc.find(r => r.emoji === reaction.emoji);
          if (existing) {
            existing.count = (existing.count || 0) + 1;
            // We'll set userReacted later based on current user
          } else {
            acc.push({
              emoji: reaction.emoji,
              count: 1,
              userReacted: false // Will be set later based on current user
            });
          }
          return acc;
        }, [] as Array<{emoji: string, count: number, userReacted: boolean}>);
        
        // Mark user's reactions as 'userReacted' if authenticated
        const currentUserId = (req as any).user?.userId;
        if (currentUserId) {
          reactionsWithCounts.forEach(reaction => {
            const userReaction = commentReactions.find(r => r.emoji === reaction.emoji && r.userId === currentUserId);
            if (userReaction) {
              reaction.userReacted = true;
            }
          });
        }
        
        return {
          ...comment,
          attachments: commentAttachments.map(att => ({
            uploadId: att.id,
            url: att.fileUrl,
            filename: att.filename,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            thumbnailUrl: att.thumbnailUrl
          })),
          reactions: reactionsWithCounts
        };
      }));
      
      // Also get total count for pagination
      const countResult = await db
        .select({ count: count(profileComments.id) })
        .from(profileComments)
        .where(
          and(
            eq(profileComments.profileId, targetUserId)
          )
        );
      
      const total = countResult[0]?.count || 0;
      
      // Build hierarchical structure from flat list
      const commentsMap: Record<string, any> = {};
      // Add replies property to each comment
      commentsWithAttachmentsAndReactions.forEach(comment => {
        (comment as any)['replies'] = [];
        commentsMap[comment.id] = comment;
      });
      
      // Get replies for each root comment
      for (const comment of commentsWithAttachmentsAndReactions) {
        const replies = await db
          .select({
            id: profileComments.id,
            userId: profileComments.userId,
            profileId: profileComments.profileId,
            content: profileComments.content,
            parentCommentId: profileComments.parentCommentId,
            quotedText: profileComments.quotedText,
            createdAt: profileComments.createdAt,
            updatedAt: profileComments.updatedAt,
            attachmentUrls: profileComments.attachmentUrls,
            attachmentMetadata: profileComments.attachmentMetadata,
            // Include user information
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          })
          .from(profileComments)
          .innerJoin(users, eq(profileComments.userId, users.id))
          .where(eq(profileComments.parentCommentId, comment.id))
          .orderBy(profileComments.createdAt);
        
        // Get attachments and reactions for each reply
        const repliesWithAttachmentsAndReactions = await Promise.all(replies.map(async (reply) => {
          // Get file uploads associated with this reply
          const replyAttachments = await db
            .select({
              id: fileUploads.id,
              fileUrl: fileUploads.fileUrl,
              filename: fileUploads.filename,
              fileSize: fileUploads.fileSize,
              mimeType: fileUploads.mimeType,
              thumbnailUrl: fileUploads.thumbnailUrl
            })
            .from(fileUploads)
            .where(and(
              eq(fileUploads.entityId, reply.id),
              eq(fileUploads.entityType, 'comment')
            ));
          
          // Get reactions for this reply
          const replyReactions = await db
            .select({
              id: reactions.id,
              userId: reactions.userId,
              emoji: reactions.emoji,
              createdAt: reactions.createdAt,
              // Join with users table to get user info
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            })
            .from(reactions)
            .leftJoin(users, eq(reactions.userId, users.id))
            .where(eq(reactions.profileCommentId, reply.id));
          
          // Group reactions by emoji to get counts
          const replyReactionsWithCounts = replyReactions.reduce((acc: Array<{emoji: string, count: number, userReacted: boolean}>, reaction) => {
            const existing = acc.find(r => r.emoji === reaction.emoji);
            if (existing) {
              existing.count = (existing.count || 0) + 1;
              // We'll set userReacted later based on current user
            } else {
              acc.push({
                emoji: reaction.emoji,
                count: 1,
                userReacted: false // Will be set later based on current user
              });
            }
            return acc;
          }, [] as Array<{emoji: string, count: number, userReacted: boolean}>);
          
          // Mark user's reactions as 'userReacted' if authenticated
          const currentUserId = (req as any).user?.userId;
          if (currentUserId) {
            replyReactionsWithCounts.forEach(reaction => {
              const userReaction = replyReactions.find(r => r.emoji === reaction.emoji && r.userId === currentUserId);
              if (userReaction) {
                reaction.userReacted = true;
              }
            });
          }
          
          return {
            ...reply,
            attachments: replyAttachments.map(att => ({
              uploadId: att.id,
              url: att.fileUrl,
              filename: att.filename,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              thumbnailUrl: att.thumbnailUrl
            })),
            reactions: replyReactionsWithCounts
          };
        }));
        
        (commentsMap[comment.id] as any)['replies'] = repliesWithAttachmentsAndReactions;
      }
      
      const rootComments = commentsWithAttachmentsAndReactions;
      
      res.json({
        comments: rootComments,
        total: total
      });
    } catch (error) {
      console.error('Get user profile comments error:', error);
      res.status(500).json({ error: "Failed to get user profile comments" });
    }
  });

  // Get user profile activities
  router.get('/:profileId/activities', optionalAuthenticateToken, async (req, res) => {
    try {
      const { profileId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (!profileId) {
        return res.status(400).json({ error: "Profile ID is required" });
      }
      
      // Check if the param is a UUID or a username
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(profileId);
      
      let user;
      if (isUuid) {
        user = await storage.getUser(profileId);
      } else {
        user = await storage.getUserByUsername(profileId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get user activities - combine comments and reviews
      const [commentsResult, reviewsResult] = await Promise.all([
        // Get user's comments
        db
          .select({
            id: comments.id,
            type: sql`'comment'`.as('type'),
            content: comments.content,
            bookId: comments.bookId,
            parentCommentId: comments.parentCommentId,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            // Include user information
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          })
          .from(comments)
          .innerJoin(users, eq(comments.userId, users.id))
          .where(eq(comments.userId, user.id))
          .orderBy(desc(comments.createdAt))
          .limit(limit * 2), // Get more to merge and sort later
        
        // Get user's reviews
        db
          .select({
            id: reviews.id,
            type: sql`'review'`.as('type'),
            content: reviews.content, // Using content field for reviews
            bookId: reviews.bookId,
            createdAt: reviews.createdAt,
            updatedAt: reviews.updatedAt,
            // Include user information
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          })
          .from(reviews)
          .innerJoin(users, eq(reviews.userId, users.id))
          .where(eq(reviews.userId, user.id))
          .orderBy(desc(reviews.createdAt))
          .limit(limit * 2)
      ]);
      
      // Combine and sort activities by date
      let allActivities = [
        ...commentsResult.map(activity => ({
          ...activity,
          type: activity.type,
          content: activity.content,
          metadata: {
            username: activity.username,
            fullName: activity.fullName,
            avatarUrl: activity.avatarUrl
          }
        })),
        ...reviewsResult.map(activity => ({
          ...activity,
          type: activity.type,
          content: activity.content,
          metadata: {
            username: activity.username,
            fullName: activity.fullName,
            avatarUrl: activity.avatarUrl
          }
        }))
      ];
      
      // Sort by creation date descending
      allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply pagination
      const total = allActivities.length;
      allActivities = allActivities.slice(offset, offset + limit);
      
      res.json({
        activities: allActivities,
        pagination: {
          limit,
          offset,
          total,
          has_more: (offset + limit) < total
        }
      });
    } catch (error) {
      console.error('Get profile activities error:', error);
      res.status(500).json({ error: "Failed to get profile activities" });
    }
  });

  // Add comment to user's profile
  router.post('/:userId/comment', authenticateToken, async (req, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const { content, parentCommentId, attachments } = req.body;
      const currentUserId = (req as any).user.userId;
        
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Comment content is required" });
      }
        
      // Verify target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
        
      // If this is a reply, verify the parent comment exists in profileComments
      if (parentCommentId) {
        const parentComment = await db
          .select()
          .from(profileComments)
          .where(eq(profileComments.id, parentCommentId))
          .limit(1);
            
        if (parentComment.length === 0) {
          return res.status(404).json({ error: "Parent comment not found" });
        }
      }
        
      // Create the profile comment
      const newComment = await db
        .insert(profileComments)
        .values({
          userId: currentUserId, // The person making the comment
          profileId: targetUserId, // The profile being commented on
          content: content.trim(),
          parentCommentId: parentCommentId || null, // Set parent if this is a reply
        })
        .returning();
        
      // If there are attachments, update their entityId to link them to this comment
      console.log('DEBUG: Checking for attachments in profile comment request:', { attachments, commentId: newComment[0].id, currentUserId });
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        try {
          console.log('Linking attachments to profile comment:', attachments, 'Comment ID:', newComment[0].id, 'Uploader ID:', currentUserId);
            
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
                eq(fileUploads.uploaderId, currentUserId),
                or(
                  eq(fileUploads.entityType, 'temp'),
                  and(
                    eq(fileUploads.entityType, 'comment'),
                    isNull(fileUploads.entityId)
                  )
                )
              )
            );
            
          console.log('Found existing files to link:', existingFiles.length, 'out of', attachments.length);
            
          if (existingFiles.length > 0) {
            // Extract the IDs of files that need to be updated
            const fileIdsToUpdate = existingFiles.map(file => file.id);
              
            // Update file uploads to link them to the created comment
            const result = await db.update(fileUploads)
              .set({ entityId: newComment[0].id })
              .where(
                and(
                  inArray(fileUploads.id, fileIdsToUpdate),
                  eq(fileUploads.uploaderId, currentUserId),
                  eq(fileUploads.entityType, 'comment')
                )
              ).execute();
              
            console.log('Profile comment attachment linking result - rows affected:', result);
              
            // Verify that the files were linked by querying them
            const linkedFiles = await db.select()
              .from(fileUploads)
              .where(
                and(
                  inArray(fileUploads.id, fileIdsToUpdate),
                  eq(fileUploads.entityId, newComment[0].id)
                )
              );
              
            console.log('Linked profile comment files count:', linkedFiles.length, 'expected:', fileIdsToUpdate.length);
              
            // Move files from temp to permanent location and update linkedFiles array
            for (const file of linkedFiles) {
              if (file.fileUrl && file.fileUrl.includes('/uploads/attachments/temp/')) {
                try {
                  const tempPath = path.join(process.cwd(), file.fileUrl);
                  const fileName = path.basename(file.fileUrl);
                    
                  // Create permanent directory if it doesn't exist
                  const permDir = path.join(process.cwd(), 'uploads', 'attachments', 'profile-comments');
                  if (!fs.existsSync(permDir)) {
                    fs.mkdirSync(permDir, { recursive: true });
                  }
                    
                  const permPath = path.join(permDir, fileName);
                    
                  // Move the file from temp to permanent location
                  fs.renameSync(tempPath, permPath);
                    
                  // Update the database record with the new permanent path
                  await db.update(fileUploads)
                    .set({ 
                      fileUrl: `/uploads/attachments/profile-comments/${fileName}`,
                      storagePath: permPath
                    })
                    .where(eq(fileUploads.id, file.id));
                    
                  // Update the linkedFiles array with the new URL so the response has the correct path
                  const updatedFile = linkedFiles.find(f => f.id === file.id);
                  if (updatedFile) {
                    updatedFile.fileUrl = `/uploads/attachments/profile-comments/${fileName}`;
                  }
                    
                  console.log(`Moved file from temp to permanent: ${file.fileUrl} -> /uploads/attachments/profile-comments/${fileName}`);
                } catch (moveError) {
                  console.error('Error moving file from temp to permanent location:', moveError);
                }
              }
            }
          }
        } catch (attachmentError) {
          console.error('Error updating profile comment attachment entity IDs:', attachmentError);
          // Don't fail the comment creation if attachment linking fails
        }
      }
        
      // Fetch the comment again to include attachment information
      const commentWithAttachments = await db
        .select({
          id: profileComments.id,
          userId: profileComments.userId,
          profileId: profileComments.profileId,
          content: profileComments.content,
          parentCommentId: profileComments.parentCommentId,
          quotedText: profileComments.quotedText,
          createdAt: profileComments.createdAt,
          updatedAt: profileComments.updatedAt,
          attachmentUrls: profileComments.attachmentUrls,
          attachmentMetadata: profileComments.attachmentMetadata,
        })
        .from(profileComments)
        .where(eq(profileComments.id, newComment[0].id))
        .limit(1);
        
      // Get file uploads associated with this comment
      const commentAttachments = await db
        .select({
          id: fileUploads.id,
          fileUrl: fileUploads.fileUrl,
          filename: fileUploads.filename,
          fileSize: fileUploads.fileSize,
          mimeType: fileUploads.mimeType,
          thumbnailUrl: fileUploads.thumbnailUrl
        })
        .from(fileUploads)
        .where(and(
          eq(fileUploads.entityId, newComment[0].id),
          eq(fileUploads.entityType, 'comment')
        ));
        
      const commentWithAttachmentsData = {
        ...commentWithAttachments[0],
        attachments: commentAttachments.map(att => ({
          uploadId: att.id,
          url: att.fileUrl,
          filename: att.filename,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          thumbnailUrl: att.thumbnailUrl
        }))
      };
        
      // Get user information for the response
      const user = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        })
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1);
        
      // Combine comment data with user info
      const responseComment = {
        ...commentWithAttachmentsData,
        author: user[0]?.fullName || user[0]?.username || 'Anonymous',
        username: user[0]?.username,
        fullName: user[0]?.fullName,
        avatarUrl: user[0]?.avatarUrl
      };
        
      // Return the created comment with attachments
      res.status(201).json(responseComment);
    } catch (error) {
      console.error('Add profile comment error:', error);
      res.status(500).json({ error: "Failed to add profile comment" });
    }
  });
    
  // Toggle reaction on a profile comment
  router.post('/comment/:commentId/reaction', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;
        
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
        
      // Verify the profile comment exists
      const profileComment = await db
        .select()
        .from(profileComments)
        .where(eq(profileComments.id, commentId))
        .limit(1);
          
      if (profileComment.length === 0) {
        return res.status(404).json({ error: "Profile comment not found" });
      }
        
      // Check if user already reacted with this emoji
      const existingReaction = await db
        .select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.profileCommentId, commentId),
            eq(reactions.emoji, emoji)
          )
        );
        
      let action: 'added' | 'removed';
        
      if (existingReaction.length > 0) {
        // Remove reaction
        await db
          .delete(reactions)
          .where(
            and(
              eq(reactions.userId, userId),
              eq(reactions.profileCommentId, commentId),
              eq(reactions.emoji, emoji)
            )
          );
          
        action = 'removed';
      } else {
        // Add reaction
        await db
          .insert(reactions)
          .values({
            userId,
            profileCommentId: commentId,
            emoji
          });
          
        action = 'added';
      }
        
      // Get updated reactions for this profile comment
      const updatedReactions = await db
        .select({
          id: reactions.id,
          userId: reactions.userId,
          emoji: reactions.emoji,
          createdAt: reactions.createdAt,
          // Join with users table to get user info
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        })
        .from(reactions)
        .leftJoin(users, eq(reactions.userId, users.id))
        .where(eq(reactions.profileCommentId, commentId));
        
      // Group reactions by emoji to get counts
      const reactionsWithCounts = updatedReactions.reduce((acc: Array<{emoji: string, count: number, userReacted: boolean}>, reaction) => {
        const existing = acc.find(r => r.emoji === reaction.emoji);
        if (existing) {
          existing.count = (existing.count || 0) + 1;
          if (userId === reaction.userId) {
            existing.userReacted = true;
          }
        } else {
          acc.push({
            emoji: reaction.emoji,
            count: 1,
            userReacted: userId === reaction.userId
          });
        }
        return acc;
      }, [] as Array<{emoji: string, count: number, userReacted: boolean}>);
        
      // Broadcast the updated reactions via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
            
          // Emit to profile-specific room
          io.to(`profile-comments:${profileComment[0].profileId}`).emit('profile-comment-reactions-update', {
            commentId,
            reactions: reactionsWithCounts
          });
            
          console.log('[STREAM] Profile comment reactions broadcast sent');
        }
      } catch (broadcastError) {
        console.error('[STREAM] Failed to broadcast profile comment reactions:', broadcastError);
      }
        
      res.status(200).json({ action, emoji, reactions: reactionsWithCounts });
    } catch (error) {
      console.error('Toggle profile comment reaction error:', error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });
    
  return router;
}