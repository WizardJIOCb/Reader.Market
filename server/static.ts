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
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}