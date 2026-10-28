import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from "../storage";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "avatars");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
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
  router.post(":userId/view", optionalAuthenticateToken, async (req, res) => {
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
      
      // Get user activities - this would need to be implemented in the storage layer
      // For now, returning an empty array as placeholder
      const activities: any[] = [];
      
      res.json({
        activities,
        pagination: {
          limit,
          offset,
          total: activities.length,
          has_more: activities.length === limit
        }
      });
    } catch (error) {
      console.error('Get profile activities error:', error);
      res.status(500).json({ error: "Failed to get profile activities" });
    }
  });

  return router;
}