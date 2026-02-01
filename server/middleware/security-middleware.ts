import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { validateFileType } from '../utils/secure-file-validator';
import { sanitizeCommentContent } from '../utils/input-sanitizer';
import { validateFilePath } from '../utils/path-validator';
import { authRateLimit, uploadRateLimit, commentRateLimit } from '../utils/rate-limiter';

/**
 * Middleware to validate file uploads securely
 */
export const secureFileUploadValidation = async (req: Request, res: Response, next: NextFunction) => {
  // This middleware should be used with multer
  if (req.files) {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    for (const file of files) {
      // Validate file type using magic numbers
      const validation = await validateFileType(file.path);
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: `File validation failed: ${validation.error}` 
        });
      }
      
      // Additional validation can go here
    }
  }
  
  next();
};

/**
 * Middleware to sanitize user input and prevent XSS
 */
export const sanitizeUserInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize body content
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeCommentContent(req.body[key]);
      }
    }
  }
  
  next();
};

/**
 * Middleware to validate file paths and prevent traversal
 */
export const validateFilePaths = (req: Request, res: Response, next: NextFunction) => {
  // Define allowed directories
  const allowedDirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'public')
  ];
  
  // Check for any path parameters that might be vulnerable
  if (req.params.filePath) {
    const validation = validateFilePath(req.params.filePath, allowedDirs);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: validation.error 
      });
    }
    req.params.filePath = validation.sanitizedPath!;
  }
  
  next();
};

/**
 * Security middleware bundle for authentication endpoints
 */
export const authSecurityMiddleware = [
  authRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    // Additional auth-specific security checks
    next();
  }
];

/**
 * Security middleware bundle for file upload endpoints
 */
export const uploadSecurityMiddleware = [
  uploadRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    // Additional upload-specific security checks
    next();
  }
];

/**
 * Security middleware bundle for comment/post endpoints
 */
export const commentSecurityMiddleware = [
  commentRateLimit,
  sanitizeUserInput,
  (req: Request, res: Response, next: NextFunction) => {
    // Additional comment-specific security checks
    next();
  }
];

/**
 * General security middleware for API endpoints
 */
export const apiSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Additional general security validations
  next();
};

/**
 * Middleware to check for suspicious patterns in requests
 */
export const suspiciousActivityDetection = (req: Request, res: Response, next: NextFunction) => {
  // Check for potential SQL injection patterns
  const sqlInjectionPatterns = [
    /(\%27)|(\')|(--)|(%23)|(#)/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(--)|(%3B)|(;))/gi,
    /w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
    /((\%27)|(\'))union/gi
  ];

  // Check body
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body);
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(bodyString)) {
        console.warn(`Suspicious activity detected from IP: ${req.ip}`, {
          url: req.url,
          method: req.method,
          pattern: pattern.toString()
        });
        return res.status(400).json({ 
          error: 'Request blocked due to suspicious content' 
        });
      }
    }
  }

  // Check query params
  const queryString = JSON.stringify(req.query);
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(queryString)) {
      console.warn(`Suspicious activity detected from IP: ${req.ip}`, {
        url: req.url,
        method: req.method,
        pattern: pattern.toString()
      });
      return res.status(400).json({ 
        error: 'Request blocked due to suspicious content' 
      });
    }
  }

  next();
};