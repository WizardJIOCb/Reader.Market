import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { users } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createSettingsRouter() {
  const router = Router();

  // Get reader settings for a book
  router.get("/api/books/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      
      const progress = await storage.getReadingProgress(userId, bookId);
      
      if (!progress || !progress.settings) {
        return res.status(404).json({ error: "No reader settings found" });
      }
      
      // Return only reader settings, excluding _progress
      const settingsObj = (progress.settings && typeof progress.settings === 'object') ? progress.settings : {};
      const { _progress, ...readerSettings } = settingsObj as any;
      res.json(readerSettings);
    } catch (error) {
      console.error("Error getting reader settings:", error);
      res.status(500).json({ error: "Failed to get reader settings" });
    }
  });

  // Update reader settings for a book
  router.put("/api/books/:bookId/reader-settings", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const settings = req.body;
      
      // Get existing progress to preserve _progress data
      const existing = await storage.getReadingProgress(userId, bookId);
      const prev = (existing?.settings && typeof existing.settings === 'object') ? existing.settings : {};
      const prevProgress = (prev as any)._progress;
      
      // Merge new settings with preserved _progress
      const next = { ...prev, ...settings, _progress: prevProgress };
      
      const progress = await storage.updateReadingProgress(userId, bookId, {
        settings: next,
        lastReadAt: existing?.lastReadAt ?? new Date(),
      });
      
      // Return only reader settings, excluding _progress
      const settingsObj = (progress.settings && typeof progress.settings === 'object') ? progress.settings : {};
      const { _progress, ...readerSettings } = settingsObj as any;
      res.json(readerSettings);
    } catch (error) {
      console.error("Error updating reader settings:", error);
      res.status(500).json({ error: "Failed to update reader settings" });
    }
  });

  // Update user language preference
  router.put("/api/profile/language", authenticateToken, async (req, res) => {
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

  return router;
}