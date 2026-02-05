import { Router } from "express";
import type { Storage } from "../storage/types";
import { authenticateToken } from "../middleware/auth";

export function createAdminRouter(storage: Storage) {
  const router = Router();

  // Middleware to check if user is admin or moderator
  const requireAdminOrModerator = async (req: any, res: any, next: any) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user || (user.accessLevel !== 'admin' && user.accessLevel !== 'moder')) {
        return res.status(403).json({ error: "Admin or moderator access required" });
      }
      next();
    } catch (error) {
      console.error("Error checking admin access:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  // Admin dashboard stats
  router.get("/dashboard-stats", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // For now, return empty stats - would need implementation in storage layer
      res.json({});
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all users
  router.get("/users", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // For now, return empty array - would need implementation in storage layer
      res.json([]);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update user access level
  router.put("/users/:userId/access-level", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // For now, return success - would need implementation in storage layer
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user access level:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export default createAdminRouter;