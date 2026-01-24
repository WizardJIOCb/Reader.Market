// Server-side logging configuration management
import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const router = Router();

// Middleware to authenticate requests
const authenticateToken = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  // Promisify jwt.verify
  const verifyToken = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  };

  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || "default_secret") as any;
    
    // Verify that the user actually exists in the database
    const userData = await storage.getUser(decoded.userId);
    if (!userData) {
      return res.status(401).json({ error: "Invalid token: user not found" });
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware to check if user has admin or moder access level
const requireAdminOrModerator = async (req: Request, res: Response, next: Function) => {
  const userId = (req as any).user.userId;
  
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if user has admin or moder access level
    if (user.accessLevel !== 'admin' && user.accessLevel !== 'moder') {
      return res.status(403).json({ error: "Access denied: Admin or moderator privileges required" });
    }
    
    next();
  } catch (error) {
    console.error("Admin access check error:", error);
    return res.status(500).json({ error: "Failed to verify admin access" });
  }
};

// In-memory storage for logging configuration (in production, use database)
let loggingConfig = {
  globalEnabled: false,
  globalLevel: 'error',
  modules: {
    frontend: { enabled: false, level: 'error' }, // DISABLED BY DEFAULT
    api: { enabled: false, level: 'error' },
    websocket: { enabled: false, level: 'error' },
    auth: { enabled: false, level: 'error' },
    database: { enabled: false, level: 'error' },
    ui: { enabled: false, level: 'error' },
    readingProgress: { enabled: false, level: 'error' },
    books: { enabled: false, level: 'error' },
    shelves: { enabled: false, level: 'error' },
    comments: { enabled: false, level: 'error' },
    reactions: { enabled: false, level: 'error' },
    fileHandling: { enabled: false, level: 'error' },
    performance: { enabled: false, level: 'error' },
    errors: { enabled: true, level: 'error' },
    userActions: { enabled: false, level: 'error' }
  }
};

// Get current logging configuration
router.get('/logging-config', authenticateToken, requireAdminOrModerator, (req, res) => {
  // In a real implementation, you'd check admin permissions here
  // For now, allowing access to demonstrate the feature
  
  console.log('[LOGGING-CONFIG] GET request received');
  
  res.json({
    success: true,
    config: loggingConfig
  });
});

// Update logging configuration
router.put('/logging-config', authenticateToken, requireAdminOrModerator, (req, res) => {
  // In a real implementation, you'd check admin permissions here
  const { config } = req.body;
  
  console.log('[LOGGING-CONFIG] PUT request received:', config);
  
  if (!config) {
    return res.status(400).json({
      success: false,
      error: 'Configuration data is required'
    });
  }
  
  // Validate configuration structure
  if (typeof config.globalEnabled !== 'boolean' || 
      !['none', 'error', 'warn', 'info', 'debug'].includes(config.globalLevel) ||
      !config.modules) {
    return res.status(400).json({
      success: false,
      error: 'Invalid configuration structure'
    });
  }
  
  // Update configuration
  loggingConfig = {
    ...loggingConfig,
    ...config
  };
  
  console.log('[LOGGING-CONFIG] Configuration updated successfully');
  
  res.json({
    success: true,
    message: 'Logging configuration updated successfully',
    config: loggingConfig
  });
});

// Reset to default configuration
router.post('/logging-config/reset', authenticateToken, requireAdminOrModerator, (req, res) => {
  // In a real implementation, you'd check admin permissions here
  
  console.log('[LOGGING-CONFIG] Reset request received');
  
  const defaultConfig = {
    globalEnabled: false,
    globalLevel: 'error',
    modules: {
      frontend: { enabled: false, level: 'error' }, // DISABLED BY DEFAULT
      api: { enabled: false, level: 'error' },
      websocket: { enabled: false, level: 'error' },
      auth: { enabled: false, level: 'error' },
      database: { enabled: false, level: 'error' },
      ui: { enabled: false, level: 'error' },
      readingProgress: { enabled: false, level: 'error' },
      books: { enabled: false, level: 'error' },
      shelves: { enabled: false, level: 'error' },
      comments: { enabled: false, level: 'error' },
      reactions: { enabled: false, level: 'error' },
      fileHandling: { enabled: false, level: 'error' },
      performance: { enabled: false, level: 'error' },
      errors: { enabled: true, level: 'error' },
      userActions: { enabled: false, level: 'error' }
    }
  };
  
  loggingConfig = defaultConfig;
  
  console.log('[LOGGING-CONFIG] Configuration reset to defaults');
  
  res.json({
    success: true,
    message: 'Logging configuration reset to defaults',
    config: loggingConfig
  });
});

// Export current configuration
router.get('/logging-config/export', authenticateToken, requireAdminOrModerator, (req, res) => {
  // In a real implementation, you'd check admin permissions here
  
  console.log('[LOGGING-CONFIG] Export request received');
  
  res.json({
    success: true,
    config: loggingConfig,
    exportedAt: new Date().toISOString()
  });
});

export default router;