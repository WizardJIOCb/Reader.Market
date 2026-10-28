import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';

export function createArticleCategoriesRouter() {
  const router = Router();

  // Public: Get all article categories
  router.get("/", async (req, res) => {
    console.log("Get article categories endpoint called");
    try {
      const categories = await storage.getArticleCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get article categories error:", error);
      res.status(500).json({ error: "Failed to fetch article categories" });
    }
  });

  // Public: Get article category by ID
  router.get("/:id", async (req, res) => {
    console.log("Get article category endpoint called for ID:", req.params.id);
    try {
      const category = await storage.getArticleCategoryById(req.params.id);
      
      if (!category) {
        return res.status(404).json({ error: "Article category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Get article category error:", error);
      res.status(500).json({ error: "Failed to fetch article category" });
    }
  });

  // Admin: Create article category
  router.post("/", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Create article category endpoint called");
    try {
      const newCategory = await storage.createArticleCategory(req.body);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Create article category error:", error);
      res.status(500).json({ error: "Failed to create article category" });
    }
  });

  // Admin: Update article category
  router.put("/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update article category endpoint called for ID:", req.params.id);
    try {
      const updatedCategory = await storage.updateArticleCategory(req.params.id, req.body);
      
      if (!updatedCategory) {
        return res.status(404).json({ error: "Article category not found" });
      }
      
      res.json(updatedCategory);
    } catch (error) {
      console.error("Update article category error:", error);
      res.status(500).json({ error: "Failed to update article category" });
    }
  });

  // Admin: Delete article category
  router.delete("/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete article category endpoint called for ID:", req.params.id);
    try {
      await storage.deleteArticleCategory(req.params.id);
      res.json({ message: "Article category deleted successfully" });
    } catch (error) {
      console.error("Delete article category error:", error);
      res.status(500).json({ error: "Failed to delete article category" });
    }
  });

  return router;
}