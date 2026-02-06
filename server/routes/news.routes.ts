import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';

export function createNewsRouter() {
  const router = Router();

  // Public: List news
  router.get("/", async (req, res) => {
    console.log("List news endpoint called");
    try {
      const newsItems = await storage.getPublishedNews();
      res.json(newsItems);
    } catch (error) {
      console.error("List news error:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // Public: Get news by ID
  router.get("/:id", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const newsItem = await storage.getNews(id);
      
      if (!newsItem) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      // Increment view count (works for both authenticated and unauthenticated users)
      await storage.incrementNewsViewCount(id);
      
      res.json(newsItem);
    } catch (error) {
      console.error("Get news error:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // Public: Get news comments
  router.get("/:id/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news comments endpoint called for news ID:", req.params.id);
    try {
      res.status(501).json({ error: "Get news comments API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get news comments error:", error);
      res.status(500).json({ error: "Failed to fetch news comments" });
    }
  });

  // Authenticated: Post news comment
  router.post("/:id/comments", authenticateToken, async (req, res) => {
    console.log("Post news comment endpoint called for news ID:", req.params.id);
    try {
      res.status(501).json({ error: "Post news comment API not yet implemented in modular form" });
    } catch (error) {
      console.error("Post news comment error:", error);
      res.status(500).json({ error: "Failed to create news comment" });
    }
  });

  // Public: Get news reactions
  router.get("/:id/reactions", optionalAuthenticateToken, async (req, res) => {
    console.log("Get news reactions endpoint called for news ID:", req.params.id);
    try {
      res.status(501).json({ error: "Get news reactions API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get news reactions error:", error);
      res.status(500).json({ error: "Failed to fetch news reactions" });
    }
  });

  // Authenticated: Post news reaction
  router.post("/:id/reactions", authenticateToken, async (req, res) => {
    console.log("Post news reaction endpoint called for news ID:", req.params.id);
    try {
      res.status(501).json({ error: "Post news reaction API not yet implemented in modular form" });
    } catch (error) {
      console.error("Post news reaction error:", error);
      res.status(500).json({ error: "Failed to create news reaction" });
    }
  });

  // Authenticated: Get news comment reactions
  router.get("/comments/:commentId/reactions", authenticateToken, async (req, res) => {
    console.log("Get news comment reactions endpoint called for comment ID:", req.params.commentId);
    try {
      res.status(501).json({ error: "Get news comment reactions API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get news comment reactions error:", error);
      res.status(500).json({ error: "Failed to fetch news comment reactions" });
    }
  });

  // Authenticated: Post news comment reaction
  router.post("/comments/:commentId/reactions", authenticateToken, async (req, res) => {
    console.log("Post news comment reaction endpoint called for comment ID:", req.params.commentId);
    try {
      res.status(501).json({ error: "Post news comment reaction API not yet implemented in modular form" });
    } catch (error) {
      console.error("Post news comment reaction error:", error);
      res.status(500).json({ error: "Failed to create news comment reaction" });
    }
  });

  // Admin: Create news
  router.post("/", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Create news endpoint called");
    try {
      res.status(501).json({ error: "Create news API not yet implemented in modular form" });
    } catch (error) {
      console.error("Create news error:", error);
      res.status(500).json({ error: "Failed to create news" });
    }
  });

  // Admin: Update news
  router.put("/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update news endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Update news API not yet implemented in modular form" });
    } catch (error) {
      console.error("Update news error:", error);
      res.status(500).json({ error: "Failed to update news" });
    }
  });

  // Admin: Delete news
  router.delete("/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete news endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Delete news API not yet implemented in modular form" });
    } catch (error) {
      console.error("Delete news error:", error);
      res.status(500).json({ error: "Failed to delete news" });
    }
  });

  // Admin: List all news
  router.get("/admin", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin list news endpoint called");
    try {
      res.status(501).json({ error: "Admin list news API not yet implemented in modular form" });
    } catch (error) {
      console.error("Admin list news error:", error);
      res.status(500).json({ error: "Failed to fetch admin news list" });
    }
  });

  return router;
}