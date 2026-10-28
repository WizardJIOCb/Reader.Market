import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Use Vite middleware, but make sure it doesn't catch API routes or uploaded files
  app.use((req, res, next) => {
    // Skip Vite middleware for API routes and uploaded files
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      console.log(`Skipping Vite middleware for API/upload route: ${req.path}`);
      return next();
    }
    // For all other routes, use Vite middleware
    console.log(`Using Vite middleware for route: ${req.path}`);
    vite.middlewares(req, res, next);
  });

  // Catch-all route for frontend
  app.use("*", async (req, res, next) => {
    // Skip this for API routes and uploaded files
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      console.log(`Skipping Vite catch-all for API/upload route: ${req.path}`);
      return next();
    }
    
    console.log(`Serving frontend for route: ${req.path}`);
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}