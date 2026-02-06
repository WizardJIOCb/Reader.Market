import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { verifyToken as verifySecureToken } from "../utils/jwt-utils";

// Middleware to authenticate requests
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log('*** AUTH MIDDLEWARE CALLED FOR:', req.path, '***');
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
  
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }
  
    try {
      const decoded: any = await verifySecureToken(token);
      if (!decoded) {
        return res.status(403).json({ error: "Invalid token" });
      }
      
      // Verify that the user actually exists in the database
      const userData = await storage.getUser(decoded.userId);
      if (!userData) {
        return res.status(401).json({ error: "User not found. Please log in again." });
      }
      (req as any).user = decoded;
      next();
    } catch (tokenErr) {
      console.error("Token verification error:", tokenErr);
      return res.status(403).json({ error: "Invalid token" });
    }
  } catch (err) {
    console.error("Unexpected authentication error:", err);
    return res.status(500).json({ error: "Authentication service error" });
  }
};

// Optional authentication middleware - allows both authenticated and unauthenticated requests
export const optionalAuthenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // If no token, continue without user data
  if (!token) {
    (req as any).user = null;
    return next();
  }

  try {
    const decoded: any = await verifySecureToken(token);
    if (!decoded) {
      (req as any).user = null;
      return next();
    }
    
    // Verify that the user actually exists in the database
    const userData = await storage.getUser(decoded.userId);
    if (!userData) {
      (req as any).user = null;
      return next();
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    (req as any).user = null;
    return next();
  }
};