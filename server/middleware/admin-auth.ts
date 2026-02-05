import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Middleware to check if user has admin or moder access level
export const requireAdminOrModerator = async (req: Request, res: Response, next: NextFunction) => {
  // First check if user is authenticated
  const userObj = (req as any).user;
  if (!userObj || !userObj.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userId = userObj.userId;

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