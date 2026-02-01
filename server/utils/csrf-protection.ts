import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// CSRF token storage (in production, use Redis or database)
interface CsrfToken {
  token: string;
  createdAt: number;
  userId?: string;
}

class CsrfTokenStore {
  private tokens: Map<string, CsrfToken> = new Map();

  // Generate a new CSRF token
  generateToken(userId?: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = crypto.randomBytes(16).toString('hex'); // Use crypto for token ID
    
    this.tokens.set(tokenId, {
      token,
      createdAt: Date.now(),
      userId
    });
    
    return tokenId;
  }

  // Verify a CSRF token
  verifyToken(tokenId: string, tokenValue: string, userId?: string): boolean {
    const storedToken = this.tokens.get(tokenId);
    
    if (!storedToken) {
      return false;
    }

    // Check if token has expired (1 hour)
    if (Date.now() - storedToken.createdAt > 60 * 60 * 1000) {
      this.tokens.delete(tokenId);
      return false;
    }

    // Check if user matches (if specified)
    if (userId && storedToken.userId && storedToken.userId !== userId) {
      return false;
    }

    // Verify the token value
    const isValid = crypto.timingSafeEqual(
      Buffer.from(storedToken.token),
      Buffer.from(tokenValue)
    );

    // Remove token after use (one-time use)
    this.tokens.delete(tokenId);

    return isValid;
  }

  // Clean up expired tokens periodically
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.tokens.entries());
    for (const [tokenId, tokenData] of entries) {
      if (now - tokenData.createdAt > 60 * 60 * 1000) {
        this.tokens.delete(tokenId);
      }
    }
  }
}

const csrfStore = new CsrfTokenStore();

// Periodic cleanup of expired tokens
setInterval(() => {
  csrfStore.cleanup();
}, 5 * 60 * 1000); // Cleanup every 5 minutes

/**
 * CSRF protection middleware
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Get token from header or body
  const tokenHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body?._csrf;
  const tokenFromQuery = req.query._csrf;

  const tokenId = tokenHeader || tokenFromBody || tokenFromQuery;

  if (!tokenId) {
    return res.status(403).json({ 
      error: 'CSRF token missing' 
    });
  }

  // Get the token value from session or wherever it's stored
  // For now, we'll expect it in a session-like object
  const tokenValue = req.headers['x-csrf-value'] as string;

  if (!tokenValue) {
    return res.status(403).json({ 
      error: 'CSRF token value missing' 
    });
  }

  // Get user ID if authenticated
  const userId = (req as any).user?.userId;

  // Verify the token
  const isValid = csrfStore.verifyToken(tokenId as string, tokenValue, userId);

  if (!isValid) {
    return res.status(403).json({ 
      error: 'Invalid or expired CSRF token' 
    });
  }

  next();
}

/**
 * Middleware to generate CSRF token for clients
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Get user ID if authenticated
  const userId = (req as any).user?.userId;
  
  // Generate a new token
  const tokenId = csrfStore.generateToken(userId);
  const tokenData = csrfStore['tokens'].get(tokenId); // Access the token value
  const tokenValue = tokenData?.token;

  if (!tokenValue) {
    return res.status(500).json({ 
      error: 'Failed to generate CSRF token' 
    });
  }

  // Add token to locals so it can be accessed by views or sent in response
  (res as any).locals = (res as any).locals || {};
  (res as any).locals.csrfToken = { id: tokenId, value: tokenValue };

  // Also set as header
  res.setHeader('X-CSRF-Token-Id', tokenId);
  res.setHeader('X-CSRF-Token', tokenValue);

  next();
}

/**
 * Function to get CSRF token pair for use in forms/API calls
 */
export function getCsrfTokenPair(req: Request): { id: string; value: string } | null {
  const userId = (req as any).user?.userId;
  const tokenId = csrfStore.generateToken(userId);
  const tokenData = csrfStore['tokens'].get(tokenId);
  const tokenValue = tokenData?.token;

  if (!tokenValue) {
    return null;
  }

  return { id: tokenId, value: tokenValue };
}

/**
 * Express middleware to set CSRF token in response locals
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  // Generate a new token for each request that needs it
  const tokenPair = getCsrfTokenPair(req);
  
  if (tokenPair) {
    // Make the token available to templates or API responses
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.csrfToken = tokenPair;
    
    // Also make it available via a getter function
    (res as any).getCsrfToken = () => tokenPair;
  }
  
  next();
}

/**
 * Advanced CSRF protection with additional security checks
 */
export function advancedCsrfProtection(options: {
  checkOrigin?: boolean;
  checkReferer?: boolean;
  sameSite?: boolean;
} = {}) {
  const { checkOrigin = true, checkReferer = true, sameSite = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Additional security checks
    if (checkOrigin) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      
      if (origin && host && !origin.includes(host.replace(/:\d+$/, ''))) {
        return res.status(403).json({ 
          error: 'Request origin does not match host' 
        });
      }
    }

    if (checkReferer) {
      const referer = req.headers.referer;
      const host = req.headers.host;
      
      if (referer && host && !referer.includes(host)) {
        return res.status(403).json({ 
          error: 'Request referer does not match host' 
        });
      }
    }

    // Now check the CSRF token
    csrfProtection(req, res, next);
  };
}