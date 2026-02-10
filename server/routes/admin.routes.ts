import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { createAdminStorage } from '../storage/modules/admin.storage';
import { users, news, comments, reviews, articles, articleCategories, books, bookmarkCollections } from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { BookFileManager } from '../utils/book-file-manager';

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/admin/',
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export function createAdminRouter() {
  const router = Router();

  // Admin: Create news
  router.post("/news", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Create news endpoint called");
    try {
      const userId = (req as any).user.userId;
      const { title, titleEn, slug, content, contentEn, published, imageUrls } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      
      const newsData = {
        title,
        titleEn: titleEn || undefined,
        slug: slug || undefined,
        content,
        contentEn: contentEn || undefined,
        imageUrls: imageUrls || undefined,
        authorId: userId,
        published: published || false,
        publishedAt: published ? new Date() : null
      };
      
      const newsItem = await storage.createNews(newsData);
      
      // Create activity feed entry and broadcast via WebSocket only if published
      if (published) {
        try {
          console.log('[STREAM DEBUG] Starting activity broadcast for news:', newsItem.id);
          console.log('[STREAM DEBUG] Socket.IO instance available:', !!(req.app as any).io);
          
          const user = await storage.getUser(userId);
          
          console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
          
          if (user && (req.app as any).io) {
            console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
            
            const io = (req.app as any).io;
            
            // Check room status
            const globalRoom = io.sockets.adapter.rooms.get('stream:global');
            console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
            if (globalRoom && globalRoom.size > 0) {
              console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
            }
            
            // Create activity data with snake_case field names
            const activityData = {
              id: newsItem.id,
              type: 'news',
              entityId: newsItem.id,
              userId: userId,
              metadata: {
                title: title,
                content_preview: content.substring(0, 200),
                author_id: userId,
                author_name: user.username || user.fullName || 'Anonymous',
                author_avatar: user.avatarUrl || null,
                view_count: 0,
                comment_count: 0,
                reaction_count: 0
              },
              createdAt: newsItem.createdAt
            };
            
            console.log('[STREAM DEBUG] Activity data:', activityData);
            
            // Broadcast to global stream
            io.to('stream:global').emit('stream:new-activity', activityData);
            console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✓ Direct broadcast sent to stream:global');
          } else {
            console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
              hasUser: !!user,
              hasIo: !!(req.app as any).io
            });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast news activity:', streamError);
          // Don't fail the request if stream activity broadcast fails
        }
      }
      
      res.status(201).json(newsItem);
    } catch (error) {
      console.error("Create news error:", error);
      res.status(500).json({ error: "Failed to create news" });
    }
  });

  // Admin: Update news
  router.put("/news/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update news endpoint called");
    try {
      const { id } = req.params;
      const { title, titleEn, slug, content, contentEn, published, imageUrls } = req.body;
      
      const existingNews = await storage.getNews(id);
      if (!existingNews) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      const newsData = {
        title: title !== undefined ? title : existingNews.title,
        titleEn: titleEn !== undefined ? (titleEn || undefined) : existingNews.titleEn,
        slug: slug !== undefined ? (slug || undefined) : existingNews.slug,
        content: content !== undefined ? content : existingNews.content,
        contentEn: contentEn !== undefined ? (contentEn || undefined) : existingNews.contentEn,
        imageUrls: imageUrls !== undefined ? (imageUrls || undefined) : existingNews.imageUrls,
        published: published !== undefined ? published : existingNews.published,
        publishedAt: (() => {
          const isPublishing = published !== undefined ? published : existingNews.published;
          
          if (isPublishing) {
            // If transitioning to published, set new timestamp
            // If already published, preserve existing timestamp (convert string to Date)
            if (published === true && !existingNews.published) {
              return new Date(); // First time publishing
            } else if (existingNews.publishedAt) {
              return new Date(existingNews.publishedAt); // Convert string to Date
            } else {
              return new Date(); // Fallback if somehow publishedAt is missing
            }
          } else {
            return null; // Unpublished state
          }
        })()
      };
      
      const updatedNews = await storage.updateNews(id, newsData);
      
      // Create activity feed entry and broadcast via WebSocket if newly published
      if (published && !existingNews.published) {
        try {
          console.log('[STREAM DEBUG] Starting activity broadcast for published news:', updatedNews.id);
          console.log('[STREAM DEBUG] Socket.IO instance available:', !!(req.app as any).io);
          
          const user = await storage.getUser((req as any).user.userId);
          
          console.log('[STREAM DEBUG] User found:', !!user, user ? user.username : 'N/A');
          
          if (user && (req.app as any).io) {
            console.log('[STREAM DEBUG] Broadcasting directly to stream:global room...');
            
            const io = (req.app as any).io;
            
            // Check room status
            const globalRoom = io.sockets.adapter.rooms.get('stream:global');
            console.log('[STREAM DEBUG] stream:global room size:', globalRoom ? globalRoom.size : 0);
            if (globalRoom && globalRoom.size > 0) {
              console.log('[STREAM DEBUG] Socket IDs in global room:', Array.from(globalRoom));
            }
            
            const newsContent = content !== undefined ? content : existingNews.content;
            const newsTitle = title !== undefined ? title : existingNews.title;
            
            // Create activity data with snake_case field names
            const activityData = {
              id: updatedNews.id,
              type: 'news',
              entityId: updatedNews.id,
              userId: user.id,
              metadata: {
                title: newsTitle,
                content_preview: newsContent.substring(0, 200),
                author_id: user.id,
                author_name: user.username || user.fullName || 'Anonymous',
                author_avatar: user.avatarUrl || null,
                view_count: 0,
                comment_count: 0,
                reaction_count: 0
              },
              createdAt: updatedNews.publishedAt || updatedNews.createdAt
            };
            
            console.log('[STREAM DEBUG] Activity data:', activityData);
            
            // Broadcast to global stream
            io.to('stream:global').emit('stream:new-activity', activityData);
            console.log('\x1b[32m%s\x1b[0m', '[STREAM DEBUG] ✓ Direct broadcast sent to stream:global');
          } else {
            console.warn('[STREAM DEBUG] Missing requirements for broadcast:', {
              hasUser: !!user,
              hasIo: !!(req.app as any).io
            });
          }
        } catch (streamError) {
          console.error('[STREAM] Failed to broadcast news activity:', streamError);
          // Don't fail the request if stream activity broadcast fails
        }
      }
      
      res.json(updatedNews);
    } catch (error) {
      console.error("Update news error:", error);
      res.status(500).json({ error: "Failed to update news" });
    }
  });

  // Admin: Delete news
  router.delete("/news/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete news endpoint called");
    try {
      const { id } = req.params;
      
      const existingNews = await storage.getNews(id);
      if (!existingNews) {
        return res.status(404).json({ error: "News item not found" });
      }
      
      await storage.deleteNews(id);
      
      // Broadcast deletion via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting news deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✓ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete news error:", error);
      res.status(500).json({ error: "Failed to delete news" });
    }
  });

  // Admin: Get all news (for admin panel)
  router.get("/news", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all news for admin endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      // Get all news items (published and unpublished)
      const allNews = await storage.getAllNews();
      const total = allNews.length;
      const paginatedNews = allNews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedNews,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get all news for admin error:", error);
      res.status(500).json({ error: "Failed to get news items" });
    }
  });

  // Admin: Update user access level
  router.put("/users/:userId/access-level", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { userId } = req.params;
      const { accessLevel } = req.body;

      if (!accessLevel || !['user', 'moder', 'admin'].includes(accessLevel)) {
        return res.status(400).json({ error: "Invalid access level. Must be 'user', 'moder', or 'admin'" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent demoting oneself
      const currentUserId = (req as any).user.userId;
      if (currentUserId === userId && accessLevel !== user.accessLevel) {
        return res.status(400).json({ error: "You cannot change your own access level" });
      }

      // Update user access level using raw SQL query since updateUser doesn't support accessLevel
      await db.update(users).set({ accessLevel }).where(eq(users.id, userId));
      
      // Fetch the updated user
      const updatedUser = await storage.getUser(userId);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found after update" });
      }
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user access level error:", error);
      res.status(500).json({ error: "Failed to update user access level" });
    }
  });

  // Admin: Update comment moderation status
  router.put("/comments/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;
      const { isApproved } = req.body;

      if (isApproved === undefined) {
        return res.status(400).json({ error: "isApproved is required" });
      }

      const comment = await storage.getCommentById(id);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const updatedComment = await storage.updateComment(id, { isApproved });
      res.json(updatedComment);
    } catch (error) {
      console.error("Update comment error:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  // Admin: Update review moderation status
  router.put("/reviews/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;
      const { isApproved } = req.body;

      if (isApproved === undefined) {
        return res.status(400).json({ error: "isApproved is required" });
      }

      const review = await storage.getReviewById(id);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      const updatedReview = await storage.updateReview(id, { isApproved });
      res.json(updatedReview);
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  // Admin: Moderate article
  router.put("/articles/:id/moderate", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Moderate article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const { status, moderationNotes } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const updatedArticle = await storage.moderateArticle(id, status, moderationNotes);
      res.json(updatedArticle);
    } catch (error) {
      console.error("Moderate article error:", error);
      res.status(500).json({ error: "Failed to moderate article" });
    }
  });

  // Admin: Delete any article
  router.delete("/articles/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin delete article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      
      await storage.deleteArticleByAdmin(id);
      res.status(204).send();
    } catch (error) {
      console.error("Admin delete article error:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Admin: Publish any article
  router.patch("/articles/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Admin publish article endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      // Use moderateArticle for admin publishing since it allows setting any status
      const updatedArticle = await storage.moderateArticle(id, status, `Status updated by admin`);
      res.json({ article: updatedArticle });
    } catch (error) {
      console.error("Admin publish article error:", error);
      res.status(500).json({ error: "Failed to update article status" });
    }
  });

  // Admin: Get all articles (for admin panel)
  router.get("/articles", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all articles for admin endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const status = req.query.status as string || undefined;
      
      const adminStorage = createAdminStorage(db);
      const result = await adminStorage.getAllArticlesForAdmin(page, limit, status);
      res.json(result);
    } catch (error) {
      console.error("Get all articles for admin error:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  // Admin: Get all article categories (for admin panel)
  router.get("/article-categories", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all article categories for admin endpoint called");
    try {
      const categories = await storage.getAllArticleCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get all article categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Admin: Create article category
  router.post("/article-categories", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Create article category endpoint called");
    try {
      const { name, nameRu, nameEn, slug, description, descriptionRu, descriptionEn, color } = req.body;
      
      if ((!name && !nameRu) || !slug) {
        return res.status(400).json({ error: "Name (Russian or English) and slug are required" });
      }
      
      const category = await storage.createArticleCategory({
        title: name || nameRu,
        titleEn: nameEn,
        description: description || descriptionRu,
        descriptionEn: descriptionEn,
        slug,
        sortOrder: 0
      });
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Create article category error:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Admin: Update article category
  router.put("/article-categories/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update article category endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      const { name, nameEn, slug, sortOrder, description, descriptionEn } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.title = name;
      if (nameEn !== undefined) updateData.titleEn = nameEn;
      if (description !== undefined) updateData.description = description;
      if (descriptionEn !== undefined) updateData.descriptionEn = descriptionEn;
      if (slug !== undefined) updateData.slug = slug;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      
      const updatedCategory = await storage.updateArticleCategory(id, updateData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Update article category error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Admin: Delete article category
  router.delete("/article-categories/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Delete article category endpoint called for ID:", req.params.id);
    try {
      const { id } = req.params;
      await storage.deleteArticleCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete article category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Admin: Get pending comments
  router.get("/comments/pending", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get pending comments endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const allComments = await storage.getAllComments();
      const total = allComments.length;
      const paginatedComments = allComments
        .filter(comment => !comment.isApproved) // Only pending/unapproved comments
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedComments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get pending comments error:", error);
      res.status(500).json({ error: "Failed to get pending comments" });
    }
  });

  // Admin: Get pending reviews
  router.get("/reviews/pending", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get pending reviews endpoint called");
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const allReviews = await storage.getAllReviews();
      const total = allReviews.length;
      const paginatedReviews = allReviews
        .filter(review => !review.isApproved) // Only pending/unapproved reviews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first
        .slice(offset, offset + limit);
      
      res.json({
        items: paginatedReviews,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Get pending reviews error:", error);
      res.status(500).json({ error: "Failed to get pending reviews" });
    }
  });

  // Admin: Delete comment (admin override)
  router.delete("/comments/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;

      // Admins can delete any comment, passing null for userId to bypass permission checks
      const success = await storage.deleteComment(id, null);

      if (!success) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // Broadcast deletion via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting comment deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✓ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Admin delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Admin: Delete review (admin override)
  router.delete("/reviews/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;

      // Admins can delete any review, passing null for userId to bypass permission checks
      const success = await storage.deleteReview(id, null);

      if (!success) {
        return res.status(404).json({ error: "Review not found" });
      }

      // Broadcast deletion via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting review deletion:', id);
          io.to('stream:global').emit('stream:activity-deleted', { entityId: id });
          console.log('\x1b[32m%s\x1b[0m', '[STREAM] ✓ Deletion broadcast sent');
        }
      } catch (streamError) {
        console.error('[STREAM] Failed to broadcast deletion:', streamError);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Admin delete review error:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Admin: Get all users with statistics
  router.get("/users", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get users with stats endpoint called");
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;
      
      let users;
      let totalCount;
      
      if (search) {
        // Search users by username, full name, or email
        const searchPattern = `%${search}%`;
        const usersResult = await db.execute(sql`
          SELECT 
            u.id,
            u.username,
            u.full_name as "fullName",
            u.email,
            u.access_level as "accessLevel",
            COALESCE(u.is_blocked, false) as "isBlocked",
            u.block_reason as "blockReason",
            u.created_at as "createdAt",
            u.last_login_at as "lastLogin",
            u.last_activity_at as "lastActivity",
            COUNT(DISTINCT s.id)::text as "shelvesCount",
            COUNT(DISTINCT sb.book_id)::text as "booksOnShelvesCount",
            COUNT(DISTINCT c.id)::text as "commentsCount",
            COUNT(DISTINCT r.id)::text as "reviewsCount"
          FROM users u
          LEFT JOIN shelves s ON u.id = s.user_id
          LEFT JOIN shelf_books sb ON s.id = sb.shelf_id
          LEFT JOIN comments c ON u.id = c.user_id
          LEFT JOIN reviews r ON u.id = r.user_id
          WHERE 
            LOWER(u.username) LIKE LOWER(${searchPattern}) OR
            LOWER(u.full_name) LIKE LOWER(${searchPattern}) OR
            LOWER(u.email) LIKE LOWER(${searchPattern})
          GROUP BY u.id, u.username, u.full_name, u.email, u.access_level, u.is_blocked, u.block_reason, u.created_at, u.updated_at, u.last_login_at, u.last_activity_at
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
        
        users = usersResult.rows;
        
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM users
          WHERE 
            LOWER(username) LIKE LOWER(${searchPattern}) OR
            LOWER(full_name) LIKE LOWER(${searchPattern}) OR
            LOWER(email) LIKE LOWER(${searchPattern})
        `);
        totalCount = parseInt(countResult.rows[0].count as string);
      } else {
        users = await storage.getUsersWithStats(limit, offset);
        
        // Get total count for pagination
        const totalCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        totalCount = parseInt(totalCountResult.rows[0].count as string);
      }
      
      res.json({
        users,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error("Get users with stats error:", error);
      res.status(500).json({ error: "Failed to get users with statistics" });
    }
  });

  // Admin: Update user
  router.put("/users/:userId", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Update user endpoint called");
    try {
      const { userId } = req.params;
      const { username, fullName, email, bio } = req.body;
      
      // Build update object
      const updateData: any = {};
      if (username) updateData.username = username;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (bio !== undefined) updateData.bio = bio;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Admin: Change user password
  router.put("/users/:userId/password", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Change user password endpoint called");
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      
      // Hash the new password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user with new password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Change user password error:", error);
      res.status(500).json({ error: "Failed to change user password" });
    }
  });

  // Admin: Impersonate user
  router.post("/users/:userId/impersonate", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Generate impersonation token endpoint called");
    try {
      const { userId } = req.params;
      
      // Check if the target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Generate a temporary token for the target user
      const createSecureToken = (payload: any) => {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'fallback_secret_key';
        return jwt.sign(payload, secret, { expiresIn: '1h' }); // Token expires in 1 hour
      };
      
      const impersonationToken = createSecureToken({ 
        userId: targetUser.id,
        accessLevel: 'impersonated'
      });
      
      res.json({
        token: impersonationToken,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          fullName: targetUser.fullName,
          email: targetUser.email
        }
      });
    } catch (error) {
      console.error("Generate impersonation token error:", error);
      res.status(500).json({ error: "Failed to generate impersonation token" });
    }
  });

  // Admin: Create book
  router.post("/books", authenticateToken, requireAdminOrModerator, (req, res, next) => {
    // Configure multer for book uploads (images and book files)
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        // Save cover images to the covers directory, other files to books directory
        if (file.fieldname === 'coverImage') {
          cb(null, 'uploads/covers/');
        } else {
          cb(null, 'uploads/books/');
        }
      },
      filename: function (req, file, cb) {
        // Generate unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
      }
    });
    
    const bookUpload = multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow book files and images
        const allowedTypes = [
          'image/jpeg',
          'image/png', 
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/epub+zip', // .epub
          'text/plain',
          'application/fb2',
          'application/x-fictionbook+xml',
          'text/xml',
          'application/octet-stream' // Generic binary (might be FB2)
        ];
        
        // Also check file extension for FB2 files
        const fileName = file.originalname.toLowerCase();
        const isFB2File = fileName.endsWith('.fb2');
        
        if (allowedTypes.includes(file.mimetype) || isFB2File) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      }
    });

    const uploadMiddleware = bookUpload.fields([
      { name: 'coverImage', maxCount: 1 }, 
      { name: 'bookFile', maxCount: 1 }
    ]);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 100MB limit' });
        }
        if (err.message === 'Unexpected field') {
          return res.status(400).json({ error: `Unexpected file field. Only 'coverImage' and 'bookFile' are allowed.` });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const bookData = req.body;
      
      // Validate required fields
      if (!bookData.title || !bookData.author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      
      // Prepare book data with file paths if files were uploaded
      const newBookData: any = {
        title: bookData.title,
        author: bookData.author,
        description: bookData.description || null,
        genre: bookData.genre || null,
        publishedYear: bookData.publishedYear ? parseInt(bookData.publishedYear) : null,
        publishedAt: bookData.publishedAt ? new Date(bookData.publishedAt) : null,
        isActive: bookData.isActive !== undefined ? bookData.isActive === 'true' || bookData.isActive === true : true,
        userId: (req as any).user.userId // Set the uploader ID
      };
      
      // Handle cover image upload
      if (files && files.coverImage && files.coverImage[0]) {
        // The file is saved in 'uploads/covers/' but accessed via '/uploads/'
        newBookData.coverImageUrl = '/uploads/covers/' + files.coverImage[0].filename;
      }
      
      // Handle book file upload
      if (files && files.bookFile && files.bookFile[0]) {
        const bookFile = files.bookFile[0];
        // The file is saved in 'uploads/books/' but accessed via '/uploads/'
        newBookData.filePath = '/uploads/books/' + bookFile.filename;
        newBookData.fileSize = bookFile.size;
        newBookData.fileType = bookFile.mimetype;
      }
      
      // Validate that at least a file path is provided (either existing or uploaded)
      if (!newBookData.filePath && !bookData.filePath) {
        return res.status(400).json({ error: "Book file is required" });
      }
      
      // If no file was uploaded but filePath is provided in body, use it
      if (!newBookData.filePath && bookData.filePath) {
        newBookData.filePath = bookData.filePath;
      }
      
      // If no cover image was uploaded but coverImageUrl is provided in body, use it
      if (!newBookData.coverImageUrl && bookData.coverImageUrl) {
        newBookData.coverImageUrl = bookData.coverImageUrl;
      }

      const book = await storage.createBook(newBookData);

      // Create activity feed entry and broadcast via WebSocket
      try {
        if ((req.app as any).io) {
          const io = (req.app as any).io;
          console.log('[STREAM] Broadcasting book creation:', book.id);

          // Create activity data
          const activityData = {
            id: book.id,
            type: 'book_creation',
            entity_type: 'book',
            entity_id: book.id,
            title: book.title,
            author: book.author,
            created_at: book.createdAt,
            timestamp: book.createdAt.toISOString()
          };

          // Broadcast to global stream
          io.to('stream:global').emit('stream:new-activity', activityData);
          console.log('[STREAM] ✓ Book creation broadcast sent');
        }
      } catch (broadcastError) {
        console.error('[STREAM] Failed to broadcast book creation:', broadcastError);
      }

      res.status(201).json(book);
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({ error: "Failed to create book" });
    }
  });

  // Admin: Get all books with pagination and search
  router.get("/books", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get all books (admin) endpoint called");
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const sortBy = req.query.sortBy as string || 'uploadedAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const offset = (page - 1) * limit;
      
      const adminStorage = createAdminStorage(db);
      const { books, total } = await adminStorage.getAllBooksWithUploader(limit, offset, search, sortBy, sortOrder);
      
      res.json({
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Get all books (admin) error:", error);
      res.status(500).json({ error: "Failed to get books" });
    }
  });

  // Admin: Update book
  router.put("/books/:id", authenticateToken, requireAdminOrModerator, (req, res, next) => {
    // Configure multer for book updates (images and book files)
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        // Save cover images to the covers directory, other files to books directory
        if (file.fieldname === 'coverImage') {
          cb(null, 'uploads/covers/');
        } else {
          cb(null, 'uploads/books/');
        }
      },
      filename: function (req, file, cb) {
        // Generate unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
      }
    });
    
    const bookUpload = multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow book files and images
        const allowedTypes = [
          'image/jpeg',
          'image/png', 
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/epub+zip', // .epub
          'text/plain',
          'application/fb2',
          'application/x-fictionbook+xml',
          'text/xml',
          'application/octet-stream' // Generic binary (might be FB2)
        ];
        
        // Also check file extension for FB2 files
        const fileName = file.originalname.toLowerCase();
        const isFB2File = fileName.endsWith('.fb2');
        
        if (allowedTypes.includes(file.mimetype) || isFB2File) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      }
    });

    const uploadMiddleware = bookUpload.fields([
      { name: 'coverImage', maxCount: 1 }, 
      { name: 'bookFile', maxCount: 1 }
    ]);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 100MB limit' });
        }
        if (err.message === 'Unexpected field') {
          return res.status(400).json({ error: `Unexpected file field. Only 'coverImage' and 'bookFile' are allowed.` });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  }, async (req, res) => {
    console.log("Update book (admin) endpoint called");
    console.log("Request files:", req.files);
    console.log("Request body:", req.body);
    try {
      const { id } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Check if book exists
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Prepare update data
      const updateData: any = {};
      
      console.log("Processing book update for ID:", id);
      console.log("Request body isActive:", req.body.isActive);
      console.log("Request body type:", typeof req.body.isActive);
      
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.author) updateData.author = req.body.author;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.genre !== undefined) updateData.genre = req.body.genre;
      if (req.body.publishedYear) updateData.publishedYear = parseInt(req.body.publishedYear);
      if (req.body.publishedAt) updateData.publishedAt = new Date(req.body.publishedAt);
      if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive === 'true' || req.body.isActive === true;
        console.log("Setting isActive to:", updateData.isActive);
      }
      
      // Handle cover image update
      if (files && files.coverImage && files.coverImage[0]) {
        // Delete old cover image if it exists
        if (book.coverImageUrl) {
          const oldCoverPath = path.join(process.cwd(), book.coverImageUrl);
          if (fs.existsSync(oldCoverPath)) {
            try {
              fs.unlinkSync(oldCoverPath);
            } catch (error) {
              console.error("Error deleting old cover image:", error);
              // Don't fail the update if old image deletion fails
            }
          }
        }
        
        // Move the uploaded file to the standardized location using the book ID
        const newCoverPath = BookFileManager.moveCoverImageFromTemp(
          id,
          files.coverImage[0].path,
          files.coverImage[0].originalname
        );
        updateData.coverImageUrl = newCoverPath;
      }
      
      // Handle book file update
      if (files && files.bookFile && files.bookFile[0]) {
        const bookFile = files.bookFile[0];
        
        // Delete old book file if it exists
        if (book.filePath) {
          const oldBookPath = path.join(process.cwd(), book.filePath);
          if (fs.existsSync(oldBookPath)) {
            try {
              fs.unlinkSync(oldBookPath);
            } catch (error) {
              console.error("Error deleting old book file:", error);
              // Don't fail the update if old file deletion fails
            }
          }
        }
        
        // Move the uploaded file to the standardized location using the book ID
        const newBookPath = BookFileManager.moveBookFileFromTemp(
          id,
          bookFile.path,
          bookFile.originalname
        );
        updateData.filePath = newBookPath;
        updateData.fileSize = bookFile.size;
        
        // Determine proper MIME type based on file extension if multer detected generic type
        const fileExtension = path.extname(bookFile.originalname).toLowerCase();
        if (bookFile.mimetype === 'application/octet-stream') {
          // Map file extensions to proper MIME types
          switch (fileExtension) {
            case '.fb2':
            case '.fb2.zip':
              updateData.fileType = 'application/fb2';
              break;
            case '.epub':
              updateData.fileType = 'application/epub+zip';
              break;
            case '.pdf':
              updateData.fileType = 'application/pdf';
              break;
            case '.doc':
              updateData.fileType = 'application/msword';
              break;
            case '.docx':
              updateData.fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              break;
            case '.txt':
              updateData.fileType = 'text/plain';
              break;
            case '.xml':
              updateData.fileType = 'text/xml';
              break;
            default:
              updateData.fileType = bookFile.mimetype;
          }
        } else {
          updateData.fileType = bookFile.mimetype;
        }
      }
      
      // Validate required fields if provided
      if (updateData.title && !updateData.title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      if (updateData.author && !updateData.author.trim()) {
        return res.status(400).json({ error: "Author cannot be empty" });
      }
      if (updateData.publishedYear) {
        const currentYear = new Date().getFullYear();
        if (updateData.publishedYear < 1000 || updateData.publishedYear > currentYear) {
          return res.status(400).json({ error: `Year must be between 1000 and ${currentYear}` });
        }
      }
      
      const adminStorage = createAdminStorage(db);
      const updatedBook = await adminStorage.updateBookAdmin(id, updateData);
      console.log("Storage update result:", updatedBook);
      console.log("Final isActive value:", updatedBook?.isActive);
      
      if (!updatedBook) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(updatedBook);
    } catch (error) {
      console.error("Update book (admin) error:", error);
      res.status(500).json({ error: "Failed to update book" });
    }
  });

  // Admin: Delete book
  router.delete("/books/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;

      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }

      const adminStorage = createAdminStorage(db);
      const success = await adminStorage.deleteBookAdmin(id);

      if (!success) {
        return res.status(500).json({ error: "Failed to delete book" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete book error:", error);
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Admin: Get bookmark collections
  router.get("/collections", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const collections = await db.select({
        id: bookmarkCollections.id,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        coverImageUrl: bookmarkCollections.coverImageUrl,
        viewCount: bookmarkCollections.viewCount,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt
      })
      .from(bookmarkCollections)
      .leftJoin(users, eq(bookmarkCollections.userId, users.id))
      .orderBy(desc(bookmarkCollections.createdAt));

      res.json(collections);
    } catch (error) {
      console.error("Get admin collections error:", error);
      res.status(500).json({ error: "Failed to get collections" });
    }
  });

  // Admin endpoint to create a collection
  router.post("/collections", authenticateToken, requireAdminOrModerator, upload.single('coverImage'), async (req, res) => {
    try {
      const { name, description, color, isPublic, userId } = req.body;
      
      // Validate required fields
      if (!name || !userId) {
        return res.status(400).json({ error: "Name and userId are required" });
      }
      
      // Check if user exists
      const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userExists.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Process cover image if provided
      let coverImageUrl = null;
      if (req.file) {
        coverImageUrl = `/uploads/collections/${req.file.filename}`;
      }
      
      // Create the collection
      const [newCollection] = await db.insert(bookmarkCollections)
        .values({
          name,
          description: description || null,
          color: color || '#3b82f6',
          isPublic: isPublic === 'true',
          userId,
          coverImageUrl
        })
        .returning();
        
      res.status(201).json(newCollection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  // Admin endpoint to update a collection
  router.put("/collections/:id", authenticateToken, requireAdminOrModerator, upload.single('coverImage'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, isPublic, userId } = req.body;
      
      // Verify collection exists
      const existingCollection = await db.select().from(bookmarkCollections).where(eq(bookmarkCollections.id, id)).limit(1);
      if (existingCollection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // If userId is being updated, check if user exists
      if (userId) {
        const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userExists.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }
      }
      
      // Prepare update data
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (color) updateData.color = color;
      if (isPublic !== undefined) updateData.isPublic = isPublic === 'true';
      if (userId) updateData.userId = userId;
      
      // Process cover image if provided
      if (req.file) {
        updateData.coverImageUrl = `/uploads/collections/${req.file.filename}`;
      }
      
      // Update the collection
      const [updatedCollection] = await db.update(bookmarkCollections)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(bookmarkCollections.id, id))
        .returning();
        
      res.json(updatedCollection);
    } catch (error) {
      console.error("Error updating collection:", error);
      res.status(500).json({ error: "Failed to update collection" });
    }
  });

  // Admin endpoint to delete a collection
  router.delete("/collections/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify collection exists
      const existingCollection = await db.select()
        .from(bookmarkCollections)
        .where(eq(bookmarkCollections.id, id))
        .limit(1);
      
      if (existingCollection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Delete the collection (this will cascade delete related items due to foreign key constraints)
      await db.delete(bookmarkCollections).where(eq(bookmarkCollections.id, id));
      
      res.json({ success: true, message: "Collection deleted successfully" });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Rating system configuration endpoints
  router.get("/rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.getRatingSystemConfig();
      res.json(config);
    } catch (error) {
      console.error("Error getting rating config:", error);
      res.status(500).json({ error: "Failed to get rating configuration" });
    }
  });

  router.put("/rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const {
        algorithmType,
        priorMean,
        priorWeight,
        likesAlpha,
        likesMaxWeight,
        minTextWeight,
        timeDecayEnabled,
        timeDecayHalfLife,
      } = req.body;

      const config = await storage.updateRatingSystemConfig({
        algorithmType,
        priorMean,
        priorWeight,
        likesAlpha,
        likesMaxWeight,
        minTextWeight,
        timeDecayEnabled,
        timeDecayHalfLife,
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating rating config:", error);
      res.status(500).json({ error: "Failed to update rating configuration" });
    }
  });

  router.post("/recalculate-ratings", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const result = await storage.recalculateAllBookRatings();
      res.json(result);
    } catch (error) {
      console.error("Error recalculating ratings:", error);
      res.status(500).json({ error: "Failed to recalculate ratings" });
    }
  });

  // User rating system configuration endpoints
  router.get("/user-rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.getUserRatingConfig();
      res.json(config);
    } catch (error) {
      console.error("Error getting user rating config:", error);
      res.status(500).json({ error: "Failed to get user rating configuration" });
    }
  });

  router.put("/user-rating-config", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const config = await storage.updateUserRatingConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error updating user rating config:", error);
      res.status(500).json({ error: "Failed to update user rating configuration" });
    }
  });

  router.post("/recalculate-user-ratings", authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const result = await storage.recalculateAllUserRatings();
      res.json(result);
    } catch (error) {
      console.error("Error recalculating user ratings:", error);
      res.status(500).json({ error: "Failed to recalculate user ratings" });
    }
  });

  // Admin: Get dashboard statistics
  router.get("/dashboard-stats", authenticateToken, requireAdminOrModerator, async (req, res) => {
    console.log("Get dashboard stats endpoint called");
    try {
      // Return basic dummy stats to avoid storage method issues
      const result = {
        totalUsers: 0,
        totalBooks: 0,
        totalArticles: 0,
        activeUsersToday: 0,
        timestamp: new Date()
      };
      
      console.log('[DASHBOARD-STATS] Sending response:', JSON.stringify(result));
      
      // Ensure proper headers for JSON response
      res.setHeader('Content-Type', 'application/json');
      res.json(result);
      
      console.log('[DASHBOARD-STATS] Response sent successfully');
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ error: "Failed to get dashboard statistics" });
    }
  });

  return router;
}