import { Router, type Express } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from '../storage';
import { db } from '../storage/db';
import { userActions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export function createPageViewRouter() {
  const router = Router();

// Page view tracking endpoints
router.get("/home", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "home" });
});

router.get("/stream", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "stream" });
});

router.get("/search", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "search" });
});

router.get("/shelves", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "shelves" });
});

router.get("/messages", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "messages" });
});

router.get("/about", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "about" });
});

router.get("/users", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "users" });
});

router.get("/collections", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "collections" });
});

router.get("/collection/:id", authenticateToken, logUserAction, (req, res) => {
  const { id } = req.params;
  res.json({ page: "collection", collectionId: id });
});

router.get("/git-to-gpt", authenticateToken, logUserAction, (req, res) => {
  res.json({ page: "git-to-gpt" });
});

  return router;
}