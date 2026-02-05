import { Router, type Express } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { logUserAction } from '../actionLoggingMiddleware';
import { storage } from '../storage';
import { db } from '../storage/db';
import { users, books, bookViewStatistics } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

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
        rating: books.rating,
        viewStats: {
          cardViews: sql<number>`COALESCE(SUM(CASE WHEN ${bookViewStatistics.viewType} = 'card_view' THEN ${bookViewStatistics.viewCount} ELSE 0 END), 0)`,
          readerOpens: sql<number>`COALESCE(SUM(CASE WHEN ${bookViewStatistics.viewType} = 'reader_open' THEN ${bookViewStatistics.viewCount} ELSE 0 END), 0)`
        }
      })
      .from(books)
      .leftJoin(bookViewStatistics, eq(books.id, bookViewStatistics.bookId))
      .where(eq(books.isActive, true))
      .groupBy(books.id)
      .orderBy(desc(sql`COALESCE(SUM(${bookViewStatistics.viewCount}), 0)`))
      .limit(20);

    res.json(popularBooks);
  } catch (error) {
    console.error('Error fetching popular books:', error);
    res.status(500).json({ error: 'Failed to fetch popular books' });
  }
});

// Public users endpoint
router.get("/public/users", async (req, res) => {
  try {
    // Get public user information (excluding sensitive data)
    const publicUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        accessLevel: users.accessLevel,
        profileRating: users.profileRating,
        profileViewCount: users.profileViewCount,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.isBlocked, false))
      .orderBy(desc(users.createdAt))
      .limit(50);

    res.json(publicUsers);
  } catch (error) {
    console.error('Error fetching public users:', error);
    res.status(500).json({ error: 'Failed to fetch public users' });
  }
});

  return router;
}