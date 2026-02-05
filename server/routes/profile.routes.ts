import { Router } from "express";
import type { Storage } from "../storage/types";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";

export function createProfileRouter(storage: Storage) {
  const router = Router();

  // Get current user profile
  router.get("/", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error getting profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user profile by ID
  router.get("/:userId", optionalAuthenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error getting user profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update current user profile
  router.put("/", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { fullName, bio, avatarUrl, language } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        fullName,
        bio,
        avatarUrl,
        language
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update user language preference
  router.put("/language", authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { language } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { language });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating language preference:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export default createProfileRouter;