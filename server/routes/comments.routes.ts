import { Router } from "express";
import type { Storage } from "../storage/types";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth";

export function createCommentsRouter(storage: Storage) {
  const router = Router();

  // Create a comment for a book
  router.post("/books/:bookId", authenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.userId;
      const { content, parentCommentId, quotedText } = req.body;
      
      const commentData = {
        userId,
        bookId,
        content,
        parentCommentId,
        quotedText
      };
      
      // For now, return success - would need implementation in storage layer
      res.json({ success: true, comment: commentData });
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get comments for a book
  router.get("/books/:bookId", optionalAuthenticateToken, async (req, res) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user?.userId;
      
      // For now, return empty array - would need implementation in storage layer
      res.json([]);
    } catch (error) {
      console.error("Error getting comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export default createCommentsRouter;