import { Request, Response, NextFunction } from 'express';

// Define rate limit configuration
interface RateLimitConfig {
  windowMs: number;  // Window in milliseconds
  max: number;       // Maximum requests allowed
  message?: string;  // Custom message
  statusCode?: number; // Status code to return
}

// Store rate limit data (in a production app, you'd use Redis or similar)
interface RateLimitData {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitData> = new Map();

  consume(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number; error?: string } {
    const now = Date.now();
    const data = this.store.get(key);

    // If no existing data or window has passed, create new window
    if (!data || now >= data.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });

      return {
        allowed: true,
        remaining: config.max - 1,
        resetTime: now + config.windowMs
      };
    }

    // Check if limit exceeded
    if (data.count >= config.max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: data.resetTime,
        error: config.message || 'Too many requests, please try again later.'
      };
    }

    // Increment count
    this.store.set(key, {
      count: data.count + 1,
      resetTime: data.resetTime
    });

    return {
      allowed: true,
      remaining: config.max - (data.count + 1),
      resetTime: data.resetTime
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

const rateLimiter = new InMemoryRateLimiter();

/**
 * Generic rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Create a unique key for this request
    // Use IP address as the primary identifier
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress || 
               (req.connection as any).remoteAddress;

    // You can also create keys based on route or user
    const key = `${ip}:${req.url}`;

    const result = rateLimiter.consume(key, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return res.status(config.statusCode || 429).json({
        error: result.error,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

/**
 * Specific rate limiters for different endpoints
 */

// Auth rate limiter - more restrictive
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth
  message: 'Too many authentication attempts, please try again later.',
  statusCode: 429
});

// API rate limiter - moderate
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for general API
  message: 'Too many requests, please try again later.',
  statusCode: 429
});

// Upload rate limiter - less restrictive but with file-specific limits
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: 'Too many file uploads, please try again later.',
  statusCode: 429
});

// Comment rate limiter - to prevent spam
export const commentRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Limit each IP to 10 comments per 10 minutes
  message: 'Too many comments, please slow down.',
  statusCode: 429
});

/**
 * Enhanced rate limiter that considers user authentication
 */
export function authenticatedRateLimit(config: RateLimitConfig, authenticatedConfig?: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Create a key based on authentication status
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress || 
               (req.connection as any).remoteAddress;

    // Check if user is authenticated
    const userId = (req as any).user?.userId;
    const key = userId ? `user:${userId}` : `ip:${ip}:${req.url}`;

    // Use different limits for authenticated vs non-authenticated users
    const effectiveConfig = userId && authenticatedConfig ? authenticatedConfig : config;

    const result = rateLimiter.consume(key, effectiveConfig);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', effectiveConfig.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return res.status(effectiveConfig.statusCode || 429).json({
        error: result.error,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}