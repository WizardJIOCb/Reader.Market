import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';

export function createArticlesRouter() {
  const router = Router();

  // Public: List articles
  router.get("/", optionalAuthenticateToken, async (req, res) => {
    console.log("List articles endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const sectionParam = req.query.section as string || undefined;
      let section: string | string[] | undefined;
      if (sectionParam && sectionParam.includes(',')) {
        // Multiple sections passed as comma-separated list
        section = sectionParam.split(',');
      } else {
        section = sectionParam || undefined;
      }
      const format = req.query.format as string || undefined;
      const search = req.query.search as string || undefined;
      const isReadLater = req.query.isReadLater === 'true'; // Add isReadLater parameter
      const sortBy = (req.query.sortBy as string) || 'publishedAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';
      const userId = (req as any).user?.userId;
      
      // If section is an array, we need to handle it specially
      let result;
      if (isReadLater && userId) {
        // Special handling for favorites - list articles marked as read later
        result = await storage.listFavoriteArticles({
          page,
          limit,
          userId,
          searchQuery: search,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any
        });
      } else if (Array.isArray(section)) {
        // Filter by multiple sections
        result = await storage.listArticlesByMultipleSections({
          page,
          limit,
          sections: section,
          format,
          searchQuery: search,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any,
          userId
        });
      } else {
        result = await storage.listArticles({
          page,
          limit,
          section,
          format,
          searchQuery: search,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any,
          userId
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("List articles error:", error);
      res.status(500).json({ error: "Failed to list articles" });
    }
  });

  // Public: Get article statistics by category
  router.get("/stats-by-category", async (req, res) => {
    console.log("Get article stats by category endpoint called");
    try {
      res.status(501).json({ error: "Get article stats by category API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get article stats by category error:", error);
      res.status(500).json({ error: "Failed to fetch article stats by category" });
    }
  });

  // Public: Get article by ID or slug
  router.get("/:identifier", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article endpoint called for identifier:", req.params.identifier);
    try {
      const { identifier } = req.params;
      const currentUserId = (req as any).user?.userId;

      const article = await storage.getArticle(identifier, currentUserId);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Register article view
      await storage.registerArticleView(article.id, currentUserId);

      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Public: Register article view
  router.post("/:id/views", async (req, res) => {
    console.log("Register article view endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Register article view API not yet implemented in modular form" });
    } catch (error) {
      console.error("Register article view error:", error);
      res.status(500).json({ error: "Failed to register article view" });
    }
  });

  // Authenticated: Create article
  router.post("/", authenticateToken, async (req, res) => {
    console.log("Create article endpoint called");
    try {
      res.status(501).json({ error: "Create article API not yet implemented in modular form" });
    } catch (error) {
      console.error("Create article error:", error);
      res.status(500).json({ error: "Failed to create article" });
    }
  });

  // Authenticated: Update article
  router.put("/:id", authenticateToken, async (req, res) => {
    console.log("Update article endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Update article API not yet implemented in modular form" });
    } catch (error) {
      console.error("Update article error:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Authenticated: Delete article
  router.delete("/:id", authenticateToken, async (req, res) => {
    console.log("Delete article endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Delete article API not yet implemented in modular form" });
    } catch (error) {
      console.error("Delete article error:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Authenticated: Publish article
  router.post("/:id/publish", authenticateToken, async (req, res) => {
    console.log("Publish article endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Publish article API not yet implemented in modular form" });
    } catch (error) {
      console.error("Publish article error:", error);
      res.status(500).json({ error: "Failed to publish article" });
    }
  });

  // Authenticated: Add to read later
  router.post("/:id/read-later", authenticateToken, async (req, res) => {
    console.log("Add to read later endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Add to read later API not yet implemented in modular form" });
    } catch (error) {
      console.error("Add to read later error:", error);
      res.status(500).json({ error: "Failed to add article to read later" });
    }
  });

  // Authenticated: Remove from read later
  router.delete("/:id/read-later", authenticateToken, async (req, res) => {
    console.log("Remove from read later endpoint called for ID:", req.params.id);
    try {
      res.status(501).json({ error: "Remove from read later API not yet implemented in modular form" });
    } catch (error) {
      console.error("Remove from read later error:", error);
      res.status(500).json({ error: "Failed to remove article from read later" });
    }
  });

  // Get article comments
  router.get("/:id/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article comments endpoint called for article ID:", req.params.id);
    try {
      res.status(501).json({ error: "Get article comments API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get article comments error:", error);
      res.status(500).json({ error: "Failed to fetch article comments" });
    }
  });

  // Post article comment
  router.post("/:id/comments", authenticateToken, async (req, res) => {
    console.log("Post article comment endpoint called for article ID:", req.params.id);
    try {
      res.status(501).json({ error: "Post article comment API not yet implemented in modular form" });
    } catch (error) {
      console.error("Post article comment error:", error);
      res.status(500).json({ error: "Failed to create article comment" });
    }
  });

  // Like/unlike article
  router.post("/:id/like", authenticateToken, async (req, res) => {
    console.log("Toggle article like endpoint called for article ID:", req.params.id);
    try {
      res.status(501).json({ error: "Toggle article like API not yet implemented in modular form" });
    } catch (error) {
      console.error("Toggle article like error:", error);
      res.status(500).json({ error: "Failed to toggle article like" });
    }
  });

  // Get article reactions
  router.get("/:id/reactions", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article reactions endpoint called for article ID:", req.params.id);
    try {
      res.status(501).json({ error: "Get article reactions API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get article reactions error:", error);
      res.status(500).json({ error: "Failed to fetch article reactions" });
    }
  });

  // Get article reactions detail
  router.get("/:id/reactions/detail", optionalAuthenticateToken, async (req, res) => {
    try {
      res.status(501).json({ error: "Get article reactions detail API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get article reactions detail error:", error);
      res.status(500).json({ error: "Failed to fetch article reactions detail" });
    }
  });

  // Authenticated: Get user's read later articles
  router.get("/read-later", authenticateToken, async (req, res) => {
    console.log("Get read later articles endpoint called");
    try {
      res.status(501).json({ error: "Get read later articles API not yet implemented in modular form" });
    } catch (error) {
      console.error("Get read later articles error:", error);
      res.status(500).json({ error: "Failed to fetch read later articles" });
    }
  });

  return router;
}