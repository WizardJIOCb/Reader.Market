import { Router, type Express } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from '../storage';
import { db } from '../storage/db';
import { books, bookViewStatistics, comments, reviews, shelfBooks } from '@shared/schema';
import { eq, desc, sql, count } from 'drizzle-orm';

export function createMiscRouter() {
  const router = Router();

  // Popular books endpoint
  router.get("/popular-books", async (req, res) => {
    try {
      // Get books with highest view counts
      const popularBooks = await db
        .select({
          id: books.id,
          title: books.title,
          author: books.author,
          coverImageUrl: books.coverImageUrl,
          videoCoverUrl: books.videoCoverUrl,
          description: books.description,
          genre: books.genre,
          rating: books.rating,
          cardViewCount: sql<number>`COALESCE(SUM(CASE WHEN ${bookViewStatistics.viewType} = 'card_view' THEN ${bookViewStatistics.viewCount} ELSE 0 END), 0)`,
          readerOpenCount: sql<number>`COALESCE(SUM(CASE WHEN ${bookViewStatistics.viewType} = 'reader_open' THEN ${bookViewStatistics.viewCount} ELSE 0 END), 0)`
        })
        .from(books)
        .leftJoin(bookViewStatistics, eq(books.id, bookViewStatistics.bookId))
        .where(eq(books.isActive, true))
        .groupBy(books.id)
        .orderBy(desc(sql`COALESCE(SUM(${bookViewStatistics.viewCount}), 0)`))
        .limit(20);

      // Now add the counts for comments, shelves, and reviews separately
      const popularBooksWithCounts = await Promise.all(popularBooks.map(async (book) => {
        // Get comment count using Drizzle ORM
        const commentCountResult = await db.select({ count: count() })
          .from(comments)
          .where(eq(comments.bookId, book.id));
        
        // Get review count using Drizzle ORM
        const reviewCountResult = await db.select({ count: count() })
          .from(reviews)
          .where(eq(reviews.bookId, book.id));
        
        // Get shelf count using Drizzle ORM
        const shelfCountResult = await db.select({ count: count() })
          .from(shelfBooks)
          .where(eq(shelfBooks.bookId, book.id));

        return {
          ...book,
          commentCount: commentCountResult[0]?.count || 0,
          reviewCount: reviewCountResult[0]?.count || 0,
          shelfCount: shelfCountResult[0]?.count || 0,
        };
      }));

      res.json(popularBooksWithCounts);
    } catch (error) {
      console.error('Error fetching popular books:', error);
      res.status(500).json({ error: 'Failed to fetch popular books' });
    }
  });

  // Get public users list with search, sort, and pagination
  router.get("/public/users", async (req, res) => {
    try {
      // Parse and validate query parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const rawLimit = parseInt(req.query.limit as string) || 6;
      const limit = [3, 6, 9, 12].includes(rawLimit) ? rawLimit : 6; // Validate limit
      const search = req.query.search as string | undefined;
      const rawSortBy = req.query.sortBy as string || 'rating';
      const sortOrder = (req.query.order as string) === 'asc' ? 'asc' : 'desc';
      
      // Whitelist sortBy parameter to prevent SQL injection
      const allowedSortOptions = ['rating', 'shelves', 'books', 'comments', 'reviews', 'lastActivity', 'registered'];
      const sortBy = allowedSortOptions.includes(rawSortBy) 
        ? rawSortBy as 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' | 'registered'
        : 'rating';
      
      const { users, total } = await storage.getPublicUsers(page, limit, search, sortBy, sortOrder);
      
      const pages = Math.ceil(total / limit);
      
      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error) {
      console.error('[API] Error fetching public users:', error);
      res.status(500).json({ 
        users: [],
        pagination: {
          page: 1,
          limit: 6,
          total: 0,
          pages: 1
        },
        error: 'Failed to fetch users' 
      });
    }
  });

  return router;
}