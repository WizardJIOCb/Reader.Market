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
    
    // Also serve files for routes like /read/{bookId}/uploads/{filename}
    app.use('*', (req, res, next) => {
      if (req.path.includes('/uploads/')) {
        // Extract the part after /uploads/ and serve from uploads directory
        const uploadPathIndex = req.path.indexOf('/uploads/');
        const filePath = req.path.substring(uploadPathIndex + '/uploads/'.length);
        
        // Sanitize the filePath to prevent directory traversal
        const sanitizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '').replace(/\\/g, '/');
        const fullPath = path.join(uploadsPath, sanitizedPath);
        
        // Check if the path is trying to traverse outside the uploads directory
        const relativePath = path.relative(uploadsPath, fullPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          res.status(403).send('Access forbidden');
          return;
        }
        
        // Check if file exists before attempting to send it
        fs.access(fullPath, fs.constants.F_OK, (err) => {
          if (err) {
            // File does not exist at the direct path, try the books subdirectory
            const booksSubdirPath = path.join(uploadsPath, 'books', sanitizedPath);
            fs.access(booksSubdirPath, fs.constants.F_OK, (booksErr) => {
              if (booksErr) {
                // File does not exist in books subdirectory, try the covers subdirectory
                const coversSubdirPath = path.join(uploadsPath, 'covers', sanitizedPath);
                fs.access(coversSubdirPath, fs.constants.F_OK, (coversErr) => {
                  if (coversErr) {
                    // File does not exist in either location, continue with other middleware
                    next();
                  } else {
                    // File exists in covers subdirectory, send it
                    res.sendFile(coversSubdirPath);
                  }
                });
              } else {
                // File exists in books subdirectory, send it
                res.sendFile(booksSubdirPath);
              }
            });
          } else {
            // File exists at the direct path, send it
            res.sendFile(fullPath);
          }
        });
      } else {
        next();
      }
    });
  }

  // fall through to index.html if the file doesn't exist
  // but only for non-API routes and non-upload routes
  app.use("*", (req, res) => {
    // Skip catch-all for API routes and upload routes
    if (req.path.startsWith('/api') || req.path.includes('/uploads/')) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    
    // For other routes, serve index.html for SPA routing
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}