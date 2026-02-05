import { Router, type Express } from 'express';

export function createHealthRouter() {
  const router = Router();

  // Health check endpoint
  router.get("/", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return router;
}