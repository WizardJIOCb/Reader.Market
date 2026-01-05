import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Use a relative path approach that works after bundling
export function serveStatic(app: Express) {
  // In the bundled application, the public directory is in the dist folder
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));
  
  // Serve uploaded files
  const uploadsPath = path.resolve(process.cwd(), "uploads");
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }

  // fall through to index.html if the file doesn't exist
  // but only for non-API routes
  app.use("*", (req, res) => {
    // Skip catch-all for API routes and uploaded files
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}