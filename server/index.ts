import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import path from "path";

const app = express();

// Add security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http://localhost:11434", "https://api.github.com"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding external resources
}));

// Check if HTTPS is enabled and certificates exist
const useHttps = process.env.USE_HTTPS === 'true';
const certsPath = path.resolve(process.cwd(), 'certs');
const keyPath = path.join(certsPath, 'localhost.key');
const certPath = path.join(certsPath, 'localhost.crt');

let httpServer;
if (useHttps && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  httpServer = createHttpsServer(httpsOptions, app);
  console.log('HTTPS mode enabled');
} else {
  httpServer = createServer(app);
}

// Add CORS middleware
app.use((req, res, next) => {
  console.log(`CORS middleware: ${req.method} ${req.path}`);
  // Allow requests from Vite dev server (3001) and any other origin
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// JSON middleware with exclusion for file upload endpoints
app.use((req, res, next) => {
  // Skip JSON parsing for file upload endpoints
  if ((req.path === '/api/books/upload' && req.method === 'POST') ||
      (req.path === '/api/profile/avatar' && req.method === 'POST')) {
    console.log(`Skipping JSON parsing for file upload: ${req.method} ${req.path}`);
    return next();
  }
  
  // For all other routes, use JSON middleware
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});

app.use(express.urlencoded({ extended: false }));

// Serve uploaded files with CORS headers
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', (req, res, next) => {
  // Add CORS headers for static file requests
  // For development, allow all origins to fix cross-origin issues
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  // Additional headers for image files
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    express.static(uploadsPath)(req, res, next);
  }
});

// Serve TTS audio files
const ttsPath = path.resolve(process.cwd(), 'storage', 'tts');
// app.use('/media/tts', express.static(ttsPath));



import { accessLogger } from './utils/logger';

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
  
  // Also log to file
  accessLogger.info(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  console.log(`Logging middleware: ${req.method} ${req.path}`);
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    console.log(`API Response for ${req.method} ${path}:`, bodyJson);
    accessLogger.info(`API Response for ${req.method} ${path}: ${JSON.stringify(bodyJson)}`);
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Capture non-JSON responses (like HTML)
  const originalResSend = res.send;
  res.send = function (data, ...args) {
    if (typeof data === 'string' && data.includes('<!DOCTYPE html')) {
      console.log(`HTML Response detected for ${req.method} ${path}:`, data.substring(0, 200) + '...');
      accessLogger.info(`HTML Response detected for ${req.method} ${path}: ${data.substring(0, 200)}...`);
    }
    return originalResSend.apply(res, [data, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
      
      // Also log to file using accessLogger
      accessLogger.info(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Register API routes first, before Vite middleware
registerRoutes(httpServer, app).then(async () => {
  console.log("Setting up error handling and Vite middleware...");
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: false,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
}).catch(error => {
  console.error("Failed to register routes:", error);
  process.exit(1);
});