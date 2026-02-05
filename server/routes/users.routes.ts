import { Router } from "express";
import type { Storage } from "../storage/types";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";

export function createUsersRouter(storage: Storage) {
  const router = Router();

  // Get user by ID
  router.get("/:userId", optionalAuthenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search users
  router.get("/search", authenticateToken, async (req, res) => {
    try {
      const { q, query } = req.query;
      const searchQuery = (q || query) as string;
      
      if (!searchQuery) {
        return res.status(400).json({ error: "Query parameter is required" });
      }
      
      // For now, we'll return an empty array since we don't have a searchUsers method
      // This would need to be implemented in the storage layer
      res.json([]);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export default createUsersRouter;