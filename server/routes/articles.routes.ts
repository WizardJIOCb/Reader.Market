import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { createArticlesService } from '../storage/modules/articles.storage';
import { createCommentsStorage } from '../storage/modules/comments.storage';
import { db } from '../storage/db';

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

      // Check if the method exists in storage, otherwise use a direct import approach
      // Since the storage combines all modules via spread operator, the methods should be available directly
      /*if (typeof (storage as any).getArticleByIdentifier === 'function') {
        const article = await (storage as any).getArticleByIdentifier(identifier, currentUserId);
        
        if (!article) {
          return res.status(404).json({ error: "Article not found" });
        }

        // Register article view
        await (storage as any).registerArticleView(article.id, currentUserId);

        // Return article wrapped in an 'article' object with default likes value
        res.json({
          article: {
            ...article,
            likes: article.likes || 0  // Ensure likes property exists
          }
        });
      } else {
        // If method doesn't exist, return error
        console.error("getArticleByIdentifier method not found in storage");
        res.status(500).json({ error: "Articles service not available" });
      }*/
      
      // Use directly imported articles service
      const articlesService = createArticlesService(db);
      const article = await articlesService.getArticleByIdentifier(identifier, currentUserId);
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Register article view
      await articlesService.registerArticleView(article.id, currentUserId);

      // Return article wrapped in an 'article' object with default likes value
      res.json({
        article: {
          ...article,
          likes: article.likes || 0  // Ensure likes property exists
        }
      });
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Public: Register article view
  router.post("/:id/views", async (req, res) => {
    console.log("Register article view endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      
      const articlesService = createArticlesService(db);
      await articlesService.registerArticleView(id, currentUserId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Register article view error:", error);
      res.status(500).json({ error: "Failed to register article view" });
    }
  });

  // Authenticated: Create article
  router.post("/", authenticateToken, async (req, res) => {
    console.log("Create article endpoint called");
    try {
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to create articles
      const article = await articlesService.createArticle({
        ...req.body,
        authorUserId: currentUserId
      });
      
      res.json(article);
    } catch (error) {
      console.error("Create article error:", error);
      res.status(500).json({ error: "Failed to create article" });
    }
  });

  // Authenticated: Update article
  router.put("/:id", authenticateToken, async (req, res) => {
    console.log("Update article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to update articles
      const article = await articlesService.updateArticle(id, req.body);
      
      res.json(article);
    } catch (error) {
      console.error("Update article error:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Authenticated: Delete article
  router.delete("/:id", authenticateToken, async (req, res) => {
    console.log("Delete article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to delete articles
      await articlesService.deleteArticle(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete article error:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Authenticated: Publish article
  router.post("/:id/publish", authenticateToken, async (req, res) => {
    console.log("Publish article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to publish articles
      const article = await articlesService.publishArticle(id);
      
      res.json(article);
    } catch (error) {
      console.error("Publish article error:", error);
      res.status(500).json({ error: "Failed to publish article" });
    }
  });

  // Authenticated: Add to read later
  router.post("/:id/read-later", authenticateToken, async (req, res) => {
    console.log("Add to read later endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to add to read later
      await articlesService.addArticleToReadLater(id, currentUserId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Add to read later error:", error);
      res.status(500).json({ error: "Failed to add article to read later" });
    }
  });

  // Authenticated: Remove from read later
  router.delete("/:id/read-later", authenticateToken, async (req, res) => {
    console.log("Remove from read later endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to remove from read later
      await articlesService.removeArticleFromReadLater(id, currentUserId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Remove from read later error:", error);
      res.status(500).json({ error: "Failed to remove article from read later" });
    }
  });

  // Get article comments
  router.get("/:id/comments", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article comments endpoint called for article ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const commentsService = createCommentsStorage(db);
      
      const comments = await commentsService.getArticleComments(id, currentUserId);
      
      res.json({ comments });
    } catch (error) {
      console.error("Get article comments error:", error);
      res.status(500).json({ error: "Failed to fetch article comments" });
    }
  });

  // Get article comment replies
  router.get("/comments/:commentId/replies", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article comment replies endpoint called for comment ID:", req.params.commentId);
    try {
      const { commentId } = req.params;
      const currentUserId = (req as any).user?.userId;
      const commentsService = createCommentsStorage(db);
      
      const replies = await commentsService.getArticleCommentReplies(commentId, currentUserId);
      
      res.json(replies);
    } catch (error) {
      console.error("Get article comment replies error:", error);
      res.status(500).json({ error: "Failed to fetch article comment replies" });
    }
  });

  // Post article comment
  router.post("/:id/comments", authenticateToken, async (req, res) => {
    console.log("Post article comment endpoint called for article ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const commentsService = createCommentsStorage(db);
      const articlesService = createArticlesService(db);
      
      // Create comment with articleId
      const comment = await commentsService.createComment({
        userId: currentUserId,
        articleId: id,
        content: req.body.content,
        parentCommentId: req.body.parentCommentId,
        quotedText: req.body.quotedText
      });
      
      // Update the article's comment count
      await articlesService.incrementArticleCommentCount(id);
      
      // If this is a reply to another comment, we should increment the parent's reply count
      // This will be handled by the reply count calculation in getArticleComments
      
      res.json(comment);
    } catch (error) {
      console.error("Post article comment error:", error);
      res.status(500).json({ error: "Failed to create article comment" });
    }
  });

  // Like/unlike article - temporarily return success since the method doesn't exist yet
  router.post("/:id/like", authenticateToken, async (req, res) => {
    console.log("Toggle article like endpoint called for article ID:", req.params.id);
    try {
      // Placeholder implementation since the method doesn't exist yet
      res.json({ likes: 0, reactions: [] });
    } catch (error) {
      console.error("Toggle article like error:", error);
      res.status(500).json({ error: "Failed to toggle article like" });
    }
  });

  // Get article reactions - using the existing placeholder method
  router.get("/:id/reactions", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article reactions endpoint called for article ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Using the existing placeholder method
      const reactions = await articlesService.getArticleReactions(id, currentUserId);
      
      res.json(reactions);
    } catch (error) {
      console.error("Get article reactions error:", error);
      res.status(500).json({ error: "Failed to fetch article reactions" });
    }
  });

  // Get article reactions detail - using the existing placeholder method
  router.get("/:id/reactions/detail", optionalAuthenticateToken, async (req, res) => {
    console.log("Get article reactions detail endpoint called for article ID:", req.params.id);
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId;
      const articlesService = createArticlesService(db);
      
      // Using the existing placeholder method
      const reactionsDetail = await articlesService.getArticleReactionsDetail(id, currentUserId);
      
      res.json(reactionsDetail);
    } catch (error) {
      console.error("Get article reactions detail error:", error);
      res.status(500).json({ error: "Failed to fetch article reactions detail" });
    }
  });

  // Authenticated: Get user's read later articles
  router.get("/read-later", authenticateToken, async (req, res) => {
    console.log("Get read later articles endpoint called");
    try {
      const currentUserId = (req as any).user?.userId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      const articlesService = createArticlesService(db);
      
      // Assuming there's a method to get user's read later articles
      const articles = await articlesService.getUserReadLaterArticles(currentUserId, limit, offset);
      const totalCount = await articlesService.getUserReadLaterArticlesCount(currentUserId);
      
      res.json({
        articles,
        totalPages: Math.ceil(totalCount / limit),
        total: totalCount,
        page,
        limit
      });
    } catch (error) {
      console.error("Get read later articles error:", error);
      res.status(500).json({ error: "Failed to fetch read later articles" });
    }
  });

  // Toggle reaction on an article comment
  router.post("/comments/:commentId/reaction", authenticateToken, async (req, res) => {
    console.log("Toggle article comment reaction endpoint called for comment ID:", req.params.commentId);
    try {
      const { commentId } = req.params;
      const userId = (req as any).user.userId;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }

      // Use the comments storage service to handle the reaction
      const commentsService = createCommentsStorage(db);
      
      // Check if user already reacted with this emoji
      const existingReactions = await commentsService.getCommentReactions(commentId, userId);
      const alreadyReacted = existingReactions.some((r: any) => r.emoji === emoji && r.userReacted);
      
      let action: 'added' | 'removed';
      if (alreadyReacted) {
        await commentsService.removeCommentReaction(userId, commentId, emoji);
        action = 'removed';
      } else {
        await commentsService.addCommentReaction(userId, commentId, emoji);
        action = 'added';
      }
      
      // Get updated reactions
      const reactions = await commentsService.getCommentReactions(commentId, userId);
      res.json({ action, reactions });
    } catch (error) {
      console.error("Toggle article comment reaction error:", error);
      res.status(500).json({ error: "Failed to toggle article comment reaction" });
    }
  });

  return router;
}
