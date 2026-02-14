import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type User, type InsertUser, users, books, shelves, shelfBooks, readingProgress, bookmarks, bookmarkCollections, bookmarkCollectionItems, collectionBooks, readingStatistics, userStatistics, comments, reviews, reactions, messages, conversations, bookViewStatistics, news, groups, groupMembers, groupBooks, channels, messageReactions, notifications, fileUploads, userActions, userChannelReadPositions, bookChatMessages, oauthAccounts, profileRatings, profileComments, ratingSystemConfig, userRatingConfig, userRatingAgg, subscriptions, ttsConfig, ttsCache, ttsJobs, articleCategories, articleTags, articles, articleTagLinks, articleBooks, articleViews, articleReadLater, activityFeed, type Article, type InsertArticle, type ArticleCategory, type InsertArticleCategory, type ArticleTag, type InsertArticleTag } from "@shared/schema";
import { eq, and, inArray, desc, asc, sql, or, ilike, like, isNull, isNotNull, ne, count } from "drizzle-orm";
import { calculateRating, type RatingAlgorithmConfig, type Review } from "./rating-algorithms";
import { 
  calculateUserRatingWeight, 
  calculateUserRatingOverall, 
  detectSpamInComment,
  type UserRatingAlgorithmConfig,
  type UserRatingParams,
  type RaterUserData,
  DEFAULT_USER_RATING_CONFIG
} from "./user-rating-algorithms";

// Database connection
console.log("Connecting to database with URL:", process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Disable SSL for local development
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool);

// Helper function to check if a book has a valid rating
const hasValidRating = (book: any): boolean => {
  return book.rating !== null && 
         book.rating !== undefined && 
         book.rating !== '' && 
         !isNaN(Number(book.rating)) &&
         Number(book.rating) !== 0; // Treat 0 as no rating
};

// SortOption type for book sorting
type SortOption = 'views' | 'readerOpens' | 'rating' | 'comments' | 'reviews';

// Helper function to sort books by the specified field
const sortBooksByOption = (books: any[], sortBy?: string, direction: 'asc' | 'desc' = 'desc'): any[] => {
  if (!sortBy || sortBy === 'rating') {
    // Default sorting: by rating (desc), then by total engagement (reviews + comments) (desc), then by creation date (desc)
    let sorted = [...books].sort((a, b) => {
      const ratingANum = a.rating ? Number(a.rating) : 0;
      const ratingBNum = b.rating ? Number(b.rating) : 0;
      
      if (ratingBNum !== ratingANum) {
        return ratingBNum - ratingANum;
      }
      
      const reviewCountA = a.reviewCount !== undefined ? Number(a.reviewCount) : 0;
      const reviewCountB = b.reviewCount !== undefined ? Number(b.reviewCount) : 0;
      const commentCountA = a.commentCount !== undefined ? Number(a.commentCount) : 0;
      const commentCountB = b.commentCount !== undefined ? Number(b.commentCount) : 0;
      
      const totalEngagementA = reviewCountA + commentCountA;
      const totalEngagementB = reviewCountB + commentCountB;
      
      if (totalEngagementB !== totalEngagementA) {
        return totalEngagementB - totalEngagementA;
      }
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Reverse if ascending
    if (direction === 'asc') {
      sorted = sorted.reverse();
    }
    
    return sorted;
  }
  
  let sorted = [...books].sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case 'views':
        result = (b.cardViewCount || 0) - (a.cardViewCount || 0);
        break;
      case 'readerOpens':
        result = (b.readerOpenCount || 0) - (a.readerOpenCount || 0);
        break;
      case 'comments':
        result = (b.commentCount || 0) - (a.commentCount || 0);
        break;
      case 'reviews':
        result = (b.reviewCount || 0) - (a.reviewCount || 0);
        break;
      case 'shelfCount':
        result = (b.shelfCount || 0) - (a.shelfCount || 0);
        break;
      case 'uploadedAt':
        // Sort by upload date
        result = new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
        break;
      case 'publishedAt':
        // Sort by publication date, nulls last
        const publishedAtA = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
        const publishedAtB = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
        result = publishedAtB - publishedAtA;
        break;
      default:
        result = 0;
    }
    
    return result;
  });
  
  // Reverse if ascending
  if (direction === 'asc') {
    sorted = sorted.reverse();
  }
  
  return sorted;
};
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameCaseInsensitive(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(userId: string): Promise<void>;
  updateUserLastActivity(userId: string): Promise<void>;
  
  // Book operations
  createBook(bookData: any): Promise<any>;
  getBook(id: string, userId?: string): Promise<any | undefined>;
  searchBooks(query: string, sortBy?: string, sortDirection?: 'asc' | 'desc'): Promise<any[]>;
  deleteBook(id: string, userId: string): Promise<boolean>;
  getPopularBooks(sortBy?: string): Promise<any[]>;
  getBooksByGenre(genre: string, sortBy?: string): Promise<any[]>;
  getRecentlyReviewedBooks(sortBy?: string): Promise<any[]>;
  getCurrentUserBooks(userId: string): Promise<any[]>;
  getNewReleases(sortBy?: string): Promise<any[]>;
  
  // Shelf operations
  createShelf(userId: string, shelfData: any): Promise<any>;
  getShelves(userId: string): Promise<any[]>;
  getShelf(id: string): Promise<any | undefined>;
  getBookShelves(bookId: string, userId: string): Promise<any[]>;
  updateShelf(id: string, shelfData: any): Promise<any>;
  deleteShelf(id: string): Promise<void>;
  addBookToShelf(shelfId: string, bookId: string): Promise<void>;
  removeBookFromShelf(shelfId: string, bookId: string): Promise<void>;
  
  // Reading progress operations
  updateReadingProgress(userId: string, bookId: string, progress: any): Promise<any>;
  getReadingProgress(userId: string, bookId: string): Promise<any | undefined>;
  
  // Reading statistics operations
  updateReadingStatistics(userId: string, bookId: string, stats: any): Promise<any>;
  getReadingStatistics(userId: string, bookId: string): Promise<any | undefined>;
  getUserStatistics(userId: string): Promise<any | undefined>;
  updateUserStatistics(userId: string, stats: any): Promise<any>;
  
  // Bookmark operations
  createBookmark(bookmarkData: any): Promise<any>;
  getBookmarks(userId: string, bookId: string): Promise<any[]>;
  updateBookmark(id: string, title: string): Promise<any>;
  deleteBookmark(id: string): Promise<void>;
  
  // Comment operations
  createComment(commentData: any): Promise<any>;
  getCommentById(id: string): Promise<any | undefined>;
  getComments(bookId: string, currentUserId?: string): Promise<any[]>;
  getBookCommentReplies(commentId: string, currentUserId?: string): Promise<any[]>;
  countBookCommentReplies(commentId: string): Promise<number>;
  getCommentReactions(commentId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]>;
  addBookCommentReaction(userId: string, commentId: string, emoji: string): Promise<any>;
  removeBookCommentReaction(userId: string, commentId: string, emoji: string): Promise<boolean>;
  getAllComments(): Promise<any[]>;
  updateComment(id: string, commentData: any): Promise<any>;
  deleteComment(id: string, userId: string | null): Promise<boolean>;
  
  // Review operations
  createReview(reviewData: any): Promise<any>;
  getReviews(bookId: string, currentUserId?: string): Promise<any[]>;
  getReviewReplies(reviewId: string, currentUserId?: string): Promise<any[]>;
  countReviewReplies(reviewId: string): Promise<number>;
  getReviewReactions(reviewId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]>;
  addReviewReaction(userId: string, reviewId: string, emoji: string): Promise<any>;
  removeReviewReaction(userId: string, reviewId: string, emoji: string): Promise<boolean>;
  getAllReviews(): Promise<any[]>;
  getUserReview(userId: string, bookId: string): Promise<any | undefined>;
  getReviewById(reviewId: string): Promise<any | undefined>;
  updateReview(id: string, reviewData: any): Promise<any>;
  deleteReview(id: string, userId: string | null): Promise<boolean>;
  
  // Reaction operations
  createReaction(reactionData: any): Promise<any>;
  getReactions(entityId: string, entityType: 'comment' | 'review' | 'news' | 'book'): Promise<any[]>;
  getReactionsForItems(itemIds: string[], isComment: boolean): Promise<any[]>;
  deleteReaction(id: string, userId: string | null): Promise<boolean>;
  getAggregatedBookReactions(bookId: string, userId?: string): Promise<any[]>;
  
  // Book view statistics operations
  incrementBookViewCount(bookId: string, viewType: string): Promise<any>;
  getBookViewStats(bookId: string): Promise<any>;
  
  // Messaging operations
  createMessage(messageData: any): Promise<any>;
  getMessagesBetweenUsers(senderId: string, recipientId: string): Promise<any[]>;
  getConversationsForUser(userId: string): Promise<any[]>;
  markMessageAsRead(messageId: string): Promise<void>;
  getUnreadMessagesCount(userId: string): Promise<number>;
  deleteMessage(id: string, userId: string | null): Promise<boolean>;
  
  // News operations
  createNews(newsData: any): Promise<any>;
  getNews(id: string): Promise<any | undefined>;
  getPublishedNews(): Promise<any[]>;
  getAllNews(): Promise<any[]>;
  updateNews(id: string, newsData: any): Promise<any>;
  deleteNews(id: string): Promise<void>;
  incrementNewsViewCount(newsId: string): Promise<void>;
  createNewsComment(commentData: any): Promise<any>;
  getNewsComments(newsId: string, userId?: string): Promise<any[]>;
  createNewsReaction(reactionData: any): Promise<any>;
  getNewsReactions(newsId: string): Promise<any[]>;
  getReactionsForNews(newsId: string): Promise<any[]>;
  updateAccessLevel(userId: string, accessLevel: string, isBlocked?: boolean, blockReason?: string | null): Promise<User>;
  getUsersWithStats(limit: number, offset: number): Promise<any[]>;
  getRecentActivity(limit: number): Promise<any[]>;
  getNewsCountSince(date: Date): Promise<number>;
  getCommentsCountSince(date: Date): Promise<number>;
  getReviewsCountSince(date: Date): Promise<number>;
  
  // Profile ratings operations
  createProfileRating(ratingData: {userId: string, profileId: string, rating: number}): Promise<any>;
  getProfileRatings(profileId: string): Promise<any[]>;
  getUserProfileRating(userId: string, profileId: string): Promise<any | undefined>;
  updateProfileRating(id: string, rating: number): Promise<any>;
  deleteProfileRating(id: string, userId: string | null): Promise<boolean>;
  updateProfileAverageRating(profileId: string): Promise<void>;
  
  // Profile view count operations
  incrementProfileViewCount(userId: string): Promise<any>;
  
  // Profile comments operations
  createProfileComment(commentData: {userId: string, profileId: string, content: string, attachments?: any, parentCommentId?: string, quotedText?: string}): Promise<any>;
  getProfileComments(profileId: string, options: {limit: number, offset: number, currentUserId?: string}): Promise<{comments: any[], total: number}>;
  getCommentReplies(commentId: string, currentUserId?: string): Promise<any[]>;
  getUserProfileComment(userId: string, profileId: string): Promise<any | undefined>;
  updateProfileComment(id: string, content: string): Promise<any>;
  deleteProfileComment(id: string, userId: string | null): Promise<boolean>;
  
  // Profile comment reactions
  addProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<any>;
  removeProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<boolean>;
  getProfileCommentReactions(commentId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]>;
  
  // File upload operations
  createFileUpload(fileData: any): Promise<any>;
  getFileUpload(id: string): Promise<any | undefined>;
  updateFileUploadThumbnail(id: string, thumbnailUrl: string): Promise<void>;
  updateFileUploadEntity(id: string, entityType: string, entityId: string): Promise<void>;
  verifyFileAccess(uploadId: string, userId: string): Promise<boolean>;
  softDeleteFileUpload(id: string, deleterId: string): Promise<void>;
  
  // Activity feed operations
  getGlobalActivities(limit: number, offset: number, before?: string): Promise<any[]>;
  getPersonalActivities(userId: string, limit: number, offset: number, before?: string): Promise<any[]>;
  getShelfActivities(userId: string, shelfIds?: string[], bookIds?: string[], limit?: number, offset?: number, before?: string): Promise<any[]>;
  getUserShelvesWithBooks(userId: string): Promise<{shelves: any[], books: any[]}>;
  
  // User actions operations
  createUserAction(actionData: any): Promise<any>;
  getLastActions(limit: number, offset: number): Promise<any[]>;
  cleanupOldActions(daysToKeep: number): Promise<void>;
  deleteUserAction(id: string): Promise<boolean>;
  createActivity(activityData: any): Promise<any>;
  updateActivityMetadata(entityId: string, metadata: any): Promise<void>;
  softDeleteActivity(activityId: string): Promise<void>;
  
  // Subscription operations
  subscribeToEntity(userId: string, entityType: string, entityId: string): Promise<void>;
  unsubscribeFromEntity(userId: string, entityType: string, entityId: string): Promise<void>;
  getUserSubscriptions(userId: string): Promise<any[]>;
  getUnreadCountForSubscription(userId: string, entityType: string, entityId: string): Promise<number>;
  
  // Channel read position operations
  upsertChannelReadPosition(userId: string, channelId: string): Promise<void>;
  getChannelReadPosition(userId: string, channelId: string): Promise<Date | null>;
  
  // Book chat operations
  createBookChatMessage(messageData: { bookId: string; userId: string; content: string; mentionedUserId?: string; quotedMessageId?: string; attachmentUrls?: string[]; attachmentMetadata?: any }): Promise<any>;
  getBookChatMessages(bookId: string, limit?: number, offset?: number): Promise<any[]>;
  deleteBookChatMessage(id: string, userId: string, isAdminOrModer?: boolean): Promise<boolean>;
  
  // Article operations
  createArticle(articleData: InsertArticle): Promise<Article>;
  getArticleById(id: string, currentUserId?: string): Promise<Article | undefined>;
  getArticleBySlug(slug: string, currentUserId?: string): Promise<Article | undefined>;
  getArticles(options?: { 
    page?: number; 
    limit?: number; 
    categoryId?: string; 
    publicationType?: string;
    category?: string; // New enum field
    type?: string; // New enum field
    tagId?: string; 
    authorId?: string; 
    status?: string; 
    search?: string; 
    sortBy?: string;
    sortDirection?: 'asc' | 'desc'
  }): Promise<{ articles: Article[]; total: number }>;
  updateArticle(id: string, articleData: Partial<InsertArticle>): Promise<Article>;
  deleteArticle(id: string, userId: string | null): Promise<boolean>;
  publishArticle(id: string): Promise<Article>;
  unpublishArticle(id: string): Promise<Article>;
  
  // Article category operations
  createArticleCategory(categoryData: InsertArticleCategory): Promise<ArticleCategory>;
  getArticleCategories(): Promise<ArticleCategory[]>;
  getArticleCategoryById(id: string): Promise<ArticleCategory | undefined>;
  updateArticleCategory(id: string, categoryData: Partial<InsertArticleCategory>): Promise<ArticleCategory>;
  deleteArticleCategory(id: string): Promise<boolean>;
  
  // Article tag operations
  createArticleTag(tagData: InsertArticleTag): Promise<ArticleTag>;
  getArticleTags(): Promise<ArticleTag[]>;
  getOrCreateArticleTag(name: string): Promise<ArticleTag>;
  
  // Article view operations
  recordArticleView(articleId: string, userId?: string, ip?: string, userAgent?: string): Promise<void>;
  getArticleViewCount(articleId: string): Promise<number>;
  getArticleBookmarkCount(articleId: string): Promise<number>;
  
  // Article read later operations
  addArticleToReadLater(userId: string, articleId: string): Promise<void>;
  removeArticleFromReadLater(userId: string, articleId: string): Promise<boolean>;
  getUserReadLaterArticles(params: { userId: string; page: number; limit: number; sortBy?: "savedAt" | "publishedAt" | "createdAt" | "views"; sortOrder?: "asc" | "desc" }): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }>;
  
  // Article-book associations
  getArticlesByBook(params: { bookId: string; page: number; limit: number; role?: "primary" | "in_list" | "mentioned"; sortBy?: "publishedAt" | "createdAt" | "views" | "sortOrder"; sortOrder?: "asc" | "desc"; userId?: string }): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }>;
  attachBooksToArticle(articleId: string, bookIds: string[], roles?: string[]): Promise<void>;
  getArticleAttachedBooks(articleId: string): Promise<any[]>;
  
  // Article-tag associations
  attachTagsToArticle(articleId: string, tagNames: string[]): Promise<void>;
  getArticleTagsByArticleId(articleId: string): Promise<ArticleTag[]>;
  getArticleStatsByCategory(): Promise<any[]>;
  updateArticleCommentsCount(articleId: string, count: number): Promise<void>;
}

// Article-specific types
export interface ArticleWithRelations extends Article {
  author?: User;
  sectionObj?: ArticleCategory;  // Renamed to avoid conflict with section field
  tags?: ArticleTag[];
  attachedBooks?: any[];
  replyTo?: Article;
  repliesCount?: number;
  bookmarkCount?: number;
}

export class DBStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log("getUserByUsername called with username:", username);
      const result = await db.select().from(users).where(eq(users.username, username));
      console.log("Database query completed, result length:", result.length);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async getUserByUsernameCaseInsensitive(username: string): Promise<User | undefined> {
    try {
      console.log("getUserByUsernameCaseInsensitive called with username:", username);
      const result = await db.select().from(users).where(ilike(users.username, username));
      console.log("Database query completed, result length:", result.length);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username (case-insensitive):", error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      console.log("Creating user with data:", userData);
      const result = await db.insert(users).values(userData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    try {
      const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user last login:", error);
      throw error;
    }
  }

  async updateUserLastActivity(userId: string): Promise<void> {
    try {
      await db.update(users).set({ lastActivityAt: new Date() }).where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user last activity:", error);
      // Don't throw - this is a non-critical background operation
    }
  }

  async createBook(bookData: any): Promise<any> {
    try {
      const result = await db.insert(books).values(bookData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating book:", error);
      throw error;
    }
  }

  async getBook(id: string, userId?: string): Promise<any | undefined> {
    try {
      console.log(`Getting book with ID: ${id}`);
      const result = await db.select().from(books).where(eq(books.id, id));
      console.log(`Database result for book ${id}:`, result[0]);
      if (result[0]) {
        // Get comment count using Drizzle ORM
        const commentCountResult = await db.select({ count: count() })
          .from(comments)
          .where(eq(comments.bookId, result[0].id));
        
        // Get review count using Drizzle ORM
        const reviewCountResult = await db.select({ count: count() })
          .from(reviews)
          .where(eq(reviews.bookId, result[0].id));
        
        // Get the latest comment or review date
        const latestComments = await db.select({ createdAt: comments.createdAt })
          .from(comments)
          .where(eq(comments.bookId, result[0].id))
          .limit(1)
          .orderBy(desc(comments.createdAt));
          
        const latestReviews = await db.select({ createdAt: reviews.createdAt })
          .from(reviews)
          .where(eq(reviews.bookId, result[0].id))
          .limit(1)
          .orderBy(desc(reviews.createdAt));
          
        const latestDate = [
          latestComments[0]?.createdAt,
          latestReviews[0]?.createdAt
        ].filter(Boolean)
         .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        
        const latestActivityResult = [{ latest_date: latestDate }];
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(id);
        
        // Get shelf count using Drizzle ORM
        const shelfCountResult = await db.select({ count: count() })
          .from(shelfBooks)
          .where(eq(shelfBooks.bookId, result[0].id));
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(id, userId);
        
        // Get reading progress for authenticated user
        let readingProgress = null;
        if (userId) {
          try {
            readingProgress = await this.getReadingProgress(userId, id);
            // Only include progress if user has actually read something (percentage > 0)
            if (readingProgress && readingProgress.percentage <= 0) {
              readingProgress = null;
            }
          } catch (error) {
            console.error('Error fetching reading progress for book:', error);
            // Continue without reading progress if there's an error
          }
        }
        
        // Format dates for the frontend
        const formattedBook = {
          ...result[0],
          rating: result[0].rating !== null && result[0].rating !== undefined ? 
            (typeof result[0].rating === 'number' ? result[0].rating : parseFloat(result[0].rating.toString())) : 
            null,
          uploadedAt: result[0].uploadedAt ? result[0].uploadedAt.toISOString() : null,
          publishedAt: result[0].publishedAt ? result[0].publishedAt.toISOString() : null,
          createdAt: result[0].createdAt.toISOString(),
          updatedAt: result[0].updatedAt.toISOString(),
          commentCount: commentCountResult[0]?.count || 0,
          reviewCount: reviewCountResult[0]?.count || 0,
          shelfCount: shelfCountResult[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: latestActivityResult[0]?.latest_date ? new Date(latestActivityResult[0].latest_date).toISOString() : null,
          reactions: reactions,
          readingProgress: readingProgress
        };
        console.log(`Formatted book ${id}:`, formattedBook);
        return formattedBook;
      }
      return result[0];
    } catch (error) {
      console.error("Error getting book:", error);
      return undefined;
    }
  }

  async searchBooks(query: string, sortBy?: string, sortDirection: 'asc' | 'desc' = 'desc'): Promise<any[]> {
    try {
      let result;
      if (query && query.trim() !== '') {
        // First, perform a search based on the query across multiple fields, sorted by rating (descending, nulls last)
        // Use explicit collation to ensure Cyrillic characters are handled properly
        // Properly escape special characters for Cyrillic text
        const escapedQuery = query.replace(/[%_]/g, '\\$&');
        const searchPattern = '%' + escapedQuery + '%';
        
        // Check if the query is a numeric value (could be a publication year)
        const isNumericQuery = /^\d+$/.test(query.trim());
        let yearQuery: number | null = null;
        if (isNumericQuery && query.trim().length === 4) { // Likely a year if it's 4 digits
          yearQuery = parseInt(query.trim(), 10);
        }
        
        // Build the search condition based on whether the query looks like a year
        if (yearQuery) {
          // If the query looks like a year, include publishedYear in the search
          result = await db.select().from(books).where(
            sql`is_active = true AND (title ILIKE ${searchPattern} OR author ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR genre ILIKE ${searchPattern} OR published_year = ${yearQuery})`
          ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
        } else {
          // Otherwise, search in all text fields except publishedYear
          result = await db.select().from(books).where(
            sql`is_active = true AND (title ILIKE ${searchPattern} OR author ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR genre ILIKE ${searchPattern})`
          ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
        }
        
        // Additionally, for books with TXT files, search within the content
        // Get all active books to check their file types
        const contentMatches: any[] = [];
        
        try {
          const allBooks = await db.select().from(books).where(sql`is_active = true`);
          
          // For TXT files, we'll search the content
          const fs = await import('fs');
          const path = await import('path');
          
          // Use process.cwd() which works in both CommonJS and ESM contexts
          const projectRoot = process.cwd();
          
          for (const book of allBooks) {
            // Check if this book has a TXT file
            if (book.filePath && book.filePath.endsWith('.txt')) {
              try {
                // Construct the full file path - handle both relative and absolute paths
                let fullPath;
                if (path.isAbsolute(book.filePath)) {
                  fullPath = book.filePath;
                } else {
                  // For relative paths, construct from the project root
                  fullPath = path.join(projectRoot, book.filePath);
                }
                
                // Check if file exists
                if (fs.existsSync(fullPath)) {
                  // Read file content
                  const content = fs.readFileSync(fullPath, 'utf8');
                  
                  // Check if query is in content
                  if (content.toLowerCase().includes(query.toLowerCase())) {
                    // Check if this book is not already in the results
                    const alreadyIncluded = result.some((r: any) => r.id === book.id);
                    if (!alreadyIncluded) {
                      contentMatches.push(book);
                    }
                  }
                }
              } catch (fileError) {
                console.warn(`Could not read file for book ${book.id}:`, fileError);
              }
            }
          }
          
          // Combine field matches with content matches
          result = [...result, ...contentMatches];
        } catch (contentSearchError) {
          console.warn('Content search failed, proceeding with metadata search only:', contentSearchError);
          // If content search fails (e.g., due to path resolution issues), continue with just metadata search
        }
      } else {
        // Return all active books if no query, sorted by rating (descending, nulls last)
        result = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      }
      
      // For books without ratings, calculate them
      for (const book of result) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      if (query && query.trim() !== '') {
        // Use explicit collation to ensure Cyrillic characters are handled properly
        // Properly escape special characters for Cyrillic text
        const escapedQuery = query.replace(/[%_]/g, '\\$&');
        const searchPattern = '%' + escapedQuery + '%';
        result = await db.select().from(books).where(
          sql`is_active = true AND (title ILIKE ${searchPattern} OR author ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR genre ILIKE ${searchPattern})`
        ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      } else {
        // Return all active books if no query, sorted by rating (descending, nulls last)
        result = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      }
      
      // Efficiently get all counts and stats for all books in bulk
      const bookIds = result.map(book => book.id);
      
      // Get all comment counts in bulk
      const commentCounts = await db.select({ bookId: comments.bookId, count: count() })
        .from(comments)
        .where(inArray(comments.bookId, bookIds))
        .groupBy(comments.bookId);
      
      // Get all review counts in bulk
      const reviewCounts = await db.select({ bookId: reviews.bookId, count: count() })
        .from(reviews)
        .where(inArray(reviews.bookId, bookIds))
        .groupBy(reviews.bookId);
      
      // Get latest comment dates in bulk
      const latestComments = await db.select({ bookId: comments.bookId, createdAt: comments.createdAt })
        .from(comments)
        .where(inArray(comments.bookId, bookIds))
        .orderBy(desc(comments.createdAt));
      
      // Get latest review dates in bulk
      const latestReviews = await db.select({ bookId: reviews.bookId, createdAt: reviews.createdAt })
        .from(reviews)
        .where(inArray(reviews.bookId, bookIds))
        .orderBy(desc(reviews.createdAt));
      
      // Get all shelf counts in bulk
      const shelfCounts = await db.select({ bookId: shelfBooks.bookId, count: count() })
        .from(shelfBooks)
        .where(inArray(shelfBooks.bookId, bookIds))
        .groupBy(shelfBooks.bookId);
      
      // Convert arrays to maps for fast lookup
      const commentCountMap = new Map(commentCounts.map(row => [row.bookId, Number(row.count)]));
      const reviewCountMap = new Map(reviewCounts.map(row => [row.bookId, Number(row.count)]));
      const shelfCountMap = new Map(shelfCounts.map(row => [row.bookId, Number(row.count)]));
      
      // Group latest activity by bookId
      const latestCommentMap = new Map();
      const latestReviewMap = new Map();
      
      // Process latest comments
      for (const comment of latestComments) {
        if (!latestCommentMap.has(comment.bookId) || comment.createdAt > latestCommentMap.get(comment.bookId)) {
          latestCommentMap.set(comment.bookId, comment.createdAt);
        }
      }
      
      // Process latest reviews
      for (const review of latestReviews) {
        if (!latestReviewMap.has(review.bookId) || review.createdAt > latestReviewMap.get(review.bookId)) {
          latestReviewMap.set(review.bookId, review.createdAt);
        }
      }
      
      // Process all books with enriched data
      const resultWithCounts = await Promise.all(result.map(async (book) => {
        // Get latest activity date for this book
        const latestCommentDate = latestCommentMap.get(book.id);
        const latestReviewDate = latestReviewMap.get(book.id);
        
        const latestDate = [
          latestCommentDate,
          latestReviewDate
        ].filter(Boolean)
         .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestDate
          ? new Date(latestDate).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        // Format dates for the frontend
        return {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString(),
          commentCount: commentCountMap.get(book.id) || 0,
          reviewCount: reviewCountMap.get(book.id) || 0,
          shelfCount: shelfCountMap.get(book.id) || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(resultWithCounts, sortBy, sortDirection);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error searching books:", error);
      return [];
    }
  }
  
  /**
   * Delete a book by ID if the user is the owner
   * @param id Book ID
   * @param userId User ID
   * @returns boolean indicating success
   */
  async deleteBook(id: string, userId: string): Promise<boolean> {
    try {
      // First, get the book to check ownership and get file paths
      // We need to get the raw book data to access the filePath
      const bookResult = await db.select().from(books).where(eq(books.id, id));
      const book = bookResult[0];
      
      if (!book) {
        return false; // Book not found
      }
      
      // Check if the user owns this book
      if (book.userId !== userId) {
        throw new Error("Unauthorized: You can only delete books you uploaded");
      }
      
      // Delete associated records first (in reverse order of dependencies)
      // Delete bookmarks
      await db.delete(bookmarks).where(eq(bookmarks.bookId, id));
      
      // Delete reading statistics
      await db.delete(readingStatistics).where(eq(readingStatistics.bookId, id));
      
      // Delete reading progress
      await db.delete(readingProgress).where(eq(readingProgress.bookId, id));
      
      // Remove book from all shelves
      await db.delete(shelfBooks).where(eq(shelfBooks.bookId, id));
      
      // Delete comments
      await db.delete(comments).where(eq(comments.bookId, id));
      
      // Delete reviews
      await db.delete(reviews).where(eq(reviews.bookId, id));
      
      // Delete group book associations
      await db.delete(groupBooks).where(eq(groupBooks.bookId, id));
      
      // Delete book view statistics
      await db.delete(bookViewStatistics).where(eq(bookViewStatistics.bookId, id));
      
      // Delete the physical file if it exists
      if (book.filePath) {
        try {
          const path = await import('path');
          const fs = await import('fs');
          
          // Use process.cwd() which works in both CommonJS and ESM contexts
          const projectRoot = process.cwd();
          
          // Construct the full file path - handle both relative and absolute paths
          let fullPath;
          if (path.isAbsolute(book.filePath)) {
            fullPath = book.filePath;
          } else {
            // For relative paths, construct from the project root
            fullPath = path.join(projectRoot, book.filePath);
          }
          
          console.log(`Attempting to delete file: ${fullPath}`);
          
          // Check if file exists and delete it
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted file: ${fullPath}`);
          } else {
            console.log(`File not found, skipping: ${fullPath}`);
          }
        } catch (fileError) {
          console.warn(`Could not delete file for book ${id}:`, fileError);
          // Don't throw error here as we still want to delete the database record
        }
      }
      
      // Delete the cover image file if it exists
      if (book.coverImageUrl) {
        try {
          const path = await import('path');
          const fs = await import('fs');
          
          const projectRoot = process.cwd();
          let coverPath;
          if (path.isAbsolute(book.coverImageUrl)) {
            coverPath = book.coverImageUrl;
          } else {
            coverPath = path.join(projectRoot, book.coverImageUrl);
          }
          
          console.log(`Attempting to delete cover image: ${coverPath}`);
          
          if (fs.existsSync(coverPath)) {
            fs.unlinkSync(coverPath);
            console.log(`Deleted cover image: ${coverPath}`);
          } else {
            console.log(`Cover image not found, skipping: ${coverPath}`);
          }
        } catch (fileError) {
          console.warn(`Could not delete cover image for book ${id}:`, fileError);
        }
      }
      
      // Finally, delete the book itself
      const result = await db.delete(books).where(eq(books.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting book:", error);
      throw error;
    }
  }
  
  async getBooksByIds(bookIds: string[]): Promise<any[]> {
    try {
      if (bookIds.length === 0) return [];
      
      console.log('Fetching books with IDs:', bookIds);
      
      // First get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(resultWithCounts);
      
      console.log('Books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting books by IDs:", error);
      return [];
    }
  }
  
  async getPopularBooks(sortBy?: string, limit: number = 6): Promise<any[]> {
    try {
      console.log('Fetching popular books');
      
      // Get active books sorted by rating (descending, nulls last), limit to 20
      // Use SQL to ensure null ratings appear last
      const booksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(limit * 2);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(limit * 2);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(resultWithCounts, sortBy);
      
      // Limit to the requested number of books
      const limitedBooks = sortedBooks.slice(0, limit);
      
      console.log('Popular books fetched with counts:', limitedBooks);
      
      return limitedBooks;
    } catch (error) {
      console.error("Error getting popular books:", error);
      return [];
    }
  }
  
  async getBooksByGenre(genre: string, sortBy?: string): Promise<any[]> {
    try {
      console.log('Fetching books by genre:', genre);
      
      // Get active books filtered by genre and sorted by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(sql`is_active = true AND LOWER(genre) LIKE LOWER('%' || ${genre} || '%')`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(sql`is_active = true AND LOWER(genre) LIKE LOWER('%' || ${genre} || '%')`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
      
      // For each book, get the comment and review counts
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(resultWithCounts, sortBy);
      
      console.log('Books by genre fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting books by genre:", error);
      return [];
    }
  }
  
  async getRecentlyReviewedBooks(sortBy?: string): Promise<any[]> {
    try {
      console.log('Fetching recently reviewed books');
      
      // Get books that have recent reviews (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // First get recent reviews
      const recentReviews = await db.select({
        bookId: reviews.bookId,
        createdAt: reviews.createdAt
      })
      .from(reviews)
      .where(sql`created_at > ${thirtyDaysAgo.toISOString()}`)
      .orderBy(desc(reviews.createdAt))
      .limit(20);
      
      // Get unique book IDs
      const bookIdsSet = new Set(recentReviews.map(review => review.bookId));
      const bookIds = Array.from(bookIdsSet);
      
      if (bookIds.length === 0) {
        return [];
      }
      
      // Get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(and(inArray(books.id, bookIds), sql`is_active = true`)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(and(inArray(books.id, bookIds), sql`is_active = true`)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(result, sortBy);
      
      console.log('Recently reviewed books fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting recently reviewed books:", error);
      return [];
    }
  }
  
  async getCurrentUserBooks(userId: string): Promise<any[]> {
    try {
      console.log('Fetching current user books for user ID:', userId);
      
      // Get books that the user is currently reading (have reading progress)
      const readingProgressRecords = await db.select({
        bookId: readingProgress.bookId,
        percentage: readingProgress.percentage,
        currentPage: readingProgress.currentPage,
        totalPages: readingProgress.totalPages,
        lastReadAt: readingProgress.lastReadAt
      })
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(20);
      
      const bookIds = readingProgressRecords.map(record => record.bookId);
      
      if (bookIds.length === 0) {
        return [];
      }
      
      // Create a map of bookId to reading progress for easy lookup
      const readingProgressMap = new Map(readingProgressRecords.map(record => [
        record.bookId, 
        {
          percentage: record.percentage ? parseFloat(record.percentage.toString()) : 0,
          currentPage: record.currentPage,
          totalPages: record.totalPages,
          lastReadAt: record.lastReadAt
        }
      ]));
      
      // Get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        // Get reading progress for this book
        const readingProgressData = readingProgressMap.get(book.id);
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions,
          readingProgress: readingProgressData
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(result);
      
      console.log('Current user books fetched with counts and reading progress:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting current user books:", error);
      return [];
    }
  }
  
  async getNewReleases(sortBy?: string): Promise<any[]> {
    try {
      console.log('Fetching new releases');
      
      // Get active books sorted by created date (descending) - showing newest additions to our system first
      const booksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(desc(books.createdAt)).limit(20);
      console.log('Books result from database:', booksResult.length);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(desc(books.createdAt)).limit(20);
      console.log('Updated books result from database:', updatedBooksResult.length);
      
      // For each book, get the comment and review counts
      const result = await Promise.all(updatedBooksResult.map(async (book) => {
        console.log('Fetching counts for book ID:', book.id);
        
        // Get comment count using raw SQL
        const commentCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE book_id = ${book.id}`);
        
        console.log('Comment count result for book', book.id, ':', commentCountResult);
        
        // Get review count using raw SQL
        const reviewCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id}`);
        
        console.log('Review count result for book', book.id, ':', reviewCountResult);
        
        // Get rating count (number of reviews that have a rating)
        const ratingCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE book_id = ${book.id} AND rating IS NOT NULL`);
        
        // Get the latest comment or review date
        const latestActivityResult = await db.execute(sql`SELECT MAX(created_at) as latest_date FROM (
          SELECT created_at FROM comments WHERE book_id = ${book.id}
          UNION ALL
          SELECT created_at FROM reviews WHERE book_id = ${book.id}
        ) AS activity`);
        
        // Get shelf count using raw SQL
        const shelfCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ${book.id}`);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date: use the latest comment/review date, or fall back to uploaded date if no activity
        const lastActivityDate = latestActivityResult.rows[0]?.latest_date 
          ? new Date(latestActivityResult.rows[0].latest_date as string).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id);
        
        return {
          ...formattedBook,
          commentCount: commentCountResult.rows[0]?.count || 0,
          reviewCount: reviewCountResult.rows[0]?.count || 0,
          ratingCount: ratingCountResult.rows[0]?.count || 0,
          shelfCount: shelfCountResult.rows[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(result, sortBy);
      
      console.log('New releases fetched with counts:', sortedBooks);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting new releases:", error);
      return [];
    }
  }

  async createShelf(userId: string, shelfData: any): Promise<any> {
    try {
      const result = await db.insert(shelves).values({ ...shelfData, userId }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating shelf:", error);
      throw error;
    }
  }

  async getShelvesWithBooks(userId: string): Promise<any[]> {
    try {
      console.log('=== DEBUG: Fetching shelves with books for user ID:', userId, '===');
      
      // First get all shelves for the user
      const userShelves = await db.select().from(shelves).where(eq(shelves.userId, userId));
      console.log('Found user shelves:', userShelves.length);
      
      if (userShelves.length === 0) {
        console.log('No shelves found, returning empty array');
        return [];
      }
      
      // Get all shelf-book associations
      const shelfIds = userShelves.map(shelf => shelf.id);
      const shelfBookRecords = await db.select().from(shelfBooks).where(inArray(shelfBooks.shelfId, shelfIds));
      console.log('Found shelf-book associations:', shelfBookRecords.length);
      
      // Get all unique book IDs
      const bookIds: string[] = [];
      const seenBookIds = new Set<string>();
      shelfBookRecords.forEach(record => {
        if (!seenBookIds.has(record.bookId)) {
          seenBookIds.add(record.bookId);
          bookIds.push(record.bookId);
        }
      });
      console.log('Unique book IDs found:', bookIds.length, bookIds);
      
      if (bookIds.length === 0) {
        console.log('No book IDs found, returning shelves with empty books arrays');
        // Return shelves with empty book arrays
        return userShelves.map(shelf => ({
          ...shelf,
          books: []
        }));
      }
      
      // Get all books with reading progress for this user
      console.log('Calling getBooksByIdsWithProgress with', bookIds.length, 'book IDs');
      let books = await this.getBooksByIdsWithProgress(bookIds, userId);
      console.log('getBooksByIdsWithProgress returned', books.length, 'books');
      
      // Create a map for quick book lookup
      const bookMap = new Map(books.map(book => [book.id, book]));
      console.log('Created bookMap with', bookMap.size, 'entries');
      
      // Create a map of shelfId to bookIds
      const shelfBookMap = new Map<string, string[]>();
      shelfBookRecords.forEach(record => {
        if (!shelfBookMap.has(record.shelfId)) {
          shelfBookMap.set(record.shelfId, []);
        }
        shelfBookMap.get(record.shelfId)!.push(record.bookId);
      });
      console.log('Created shelfBookMap with', shelfBookMap.size, 'entries');
      
      // Build shelves with books
      const shelvesWithBooks = userShelves.map(shelf => {
        const shelfBookIds = shelfBookMap.get(shelf.id) || [];
        console.log(`Shelf ${shelf.name} has book IDs:`, shelfBookIds);
        
        const shelfBooks = shelfBookIds
          .map(bookId => {
            const book = bookMap.get(bookId);
            console.log(`  Looking for book ${bookId}:`, book ? 'FOUND' : 'NOT FOUND');
            return book;
          })
          .filter(Boolean) as any[];
          
        console.log(`Final result for shelf ${shelf.name}:`, shelfBooks.length, 'books');
        
        return {
          ...shelf,
          books: shelfBooks
        };
      });
      
      console.log(`=== FINAL RESULT: ${shelvesWithBooks.length} shelves with books ===`);
      shelvesWithBooks.forEach(shelf => {
        console.log(`  ${shelf.name}: ${shelf.books.length} books`);
      });
      
      return shelvesWithBooks;
    } catch (error) {
      console.error("Error getting shelves with books:", error);
      return [];
    }
  }
  
  // Helper method to get books by IDs with reading progress
  async getBooksByIdsWithProgress(bookIds: string[], userId?: string): Promise<any[]> {
    try {
      if (bookIds.length === 0) return [];
      
      // First get the books and sort by rating (descending, nulls last)
      const booksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // For books without ratings, calculate them
      for (const book of booksResult) {
        if (book.rating === null || book.rating === undefined) {
          await this.updateBookAverageRating(book.id);
        }
      }
      
      // Fetch the books again with updated ratings
      const updatedBooksResult = await db.select().from(books).where(inArray(books.id, bookIds)).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
      
      // Get reading progress if userId is provided
      let readingProgressMap = new Map();
      if (userId) {
        try {
          const readingProgressRecords = await db.select({
            bookId: readingProgress.bookId,
            percentage: readingProgress.percentage,
            currentPage: readingProgress.currentPage,
            totalPages: readingProgress.totalPages,
            lastReadAt: readingProgress.lastReadAt
          })
          .from(readingProgress)
          .where(and(
            eq(readingProgress.userId, userId),
            inArray(readingProgress.bookId, bookIds)
          ));
          
          readingProgressMap = new Map(readingProgressRecords.map(record => [
            record.bookId, 
            {
              percentage: record.percentage ? parseFloat(record.percentage.toString()) : 0,
              currentPage: record.currentPage || 0,
              totalPages: record.totalPages || 0,
              lastReadAt: record.lastReadAt
            }
          ]));
        } catch (progressError) {
          console.error('Error fetching reading progress:', progressError);
        }
      }
      
      // For each book, get the comment and review counts and add reading progress
      const resultWithCounts = await Promise.all(updatedBooksResult.map(async (book) => {
        // Get comment count using Drizzle ORM
        const commentCountResult = await db.select({ count: count() })
          .from(comments)
          .where(eq(comments.bookId, book.id));
        
        // Get review count using Drizzle ORM
        const reviewCountResult = await db.select({ count: count() })
          .from(reviews)
          .where(eq(reviews.bookId, book.id));
        
        // Get the latest comment or review date
        const latestComments = await db.select({ createdAt: comments.createdAt })
          .from(comments)
          .where(eq(comments.bookId, book.id))
          .limit(1)
          .orderBy(desc(comments.createdAt));
          
        const latestReviews = await db.select({ createdAt: reviews.createdAt })
          .from(reviews)
          .where(eq(reviews.bookId, book.id))
          .limit(1)
          .orderBy(desc(reviews.createdAt));
          
        const latestDate = [
          latestComments[0]?.createdAt,
          latestReviews[0]?.createdAt
        ].filter(Boolean)
         .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        
        const latestActivityResult = [{ latest_date: latestDate }];
        
        // Get shelf count using Drizzle ORM
        const shelfCountResult = await db.select({ count: count() })
          .from(shelfBooks)
          .where(eq(shelfBooks.bookId, book.id));
        
        // Get aggregated reactions for this book
        const reactions = await this.getAggregatedBookReactions(book.id, userId);
        
        // Format dates for the frontend
        const formattedBook = {
          ...book,
          rating: book.rating !== null && book.rating !== undefined ? 
            (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
            null,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString()
        };
        
        // Get book view statistics
        const viewStats = await this.getBookViewStats(book.id);
        
        // Determine the last activity date
        const lastActivityDate = latestActivityResult[0]?.latest_date 
          ? new Date(latestActivityResult[0].latest_date).toISOString()
          : book.uploadedAt ? book.uploadedAt.toISOString() : book.createdAt.toISOString();
        
        // Add reading progress if available
        const readingProgressData = readingProgressMap.get(book.id) || null;
        
        return {
          ...formattedBook,
          commentCount: commentCountResult[0]?.count || 0,
          reviewCount: reviewCountResult[0]?.count || 0,
          shelfCount: shelfCountResult[0]?.count || 0,
          cardViewCount: viewStats.card_view || 0,
          readerOpenCount: viewStats.reader_open || 0,
          lastActivityDate: lastActivityDate,
          reactions: reactions,
          readingProgress: readingProgressData
        };
      }));
      
      // Sort the books using the helper function
      const sortedBooks = sortBooksByOption(resultWithCounts);
      
      return sortedBooks;
    } catch (error) {
      console.error("Error getting books by IDs with progress:", error);
      return [];
    }
  }
  async getShelves(userId: string): Promise<any[]> {
    try {
      console.log('Fetching shelves for user ID:', userId);
      
      // First get all shelves for the user
      console.log('Executing database query for shelves');
      const userShelves = await db.select().from(shelves).where(eq(shelves.userId, userId));
      console.log('Database query for shelves completed');
      
      console.log('User shelves found:', userShelves);
      
      // Handle case where user has no shelves
      if (userShelves.length === 0) {
        console.log('No shelves found for user');
        return [];
      }
      
      // For each shelf, get the associated book IDs
      console.log('Processing shelves with books');
      const shelvesWithBooks = await Promise.all(userShelves.map(async (shelf) => {
        console.log('Fetching books for shelf ID:', shelf.id);
        
        // Get all book IDs for this shelf
        console.log('Executing database query for shelf books');
        const shelfBookRecords = await db.select().from(shelfBooks).where(eq(shelfBooks.shelfId, shelf.id));
        console.log('Database query for shelf books completed');
        const bookIds = shelfBookRecords.map(record => record.bookId);
        
        console.log('Book IDs for shelf', shelf.id, ':', bookIds);
        
        return {
          ...shelf,
          bookIds
        };
      }));
      console.log('Finished processing shelves with books');
      
      console.log('Shelves with books:', shelvesWithBooks);
      
      return shelvesWithBooks;
    } catch (error) {
      console.error("Error getting shelves:", error);
      return [];
    }
  }

  async getShelf(id: string): Promise<any | undefined> {
    try {
      console.log(`Getting shelf with ID: ${id}`);
      const result = await db.select().from(shelves).where(eq(shelves.id, id));
      console.log(`Database result for shelf ${id}:`, result[0]);
      return result[0];
    } catch (error) {
      console.error("Error getting shelf:", error);
      return undefined;
    }
  }

  async getBookShelves(bookId: string, userId: string): Promise<any[]> {
    try {
      const bookShelves = await db
        .select({
          id: shelfBooks.id,
          shelfId: shelfBooks.shelfId,
          bookId: shelfBooks.bookId,
          addedAt: shelfBooks.addedAt,
          shelf: {
            id: shelves.id,
            name: shelves.name,
            description: shelves.description,
            color: shelves.color,
            userId: shelves.userId,
            createdAt: shelves.createdAt,
            updatedAt: shelves.updatedAt
          }
        })
        .from(shelfBooks)
        .leftJoin(shelves, eq(shelves.id, shelfBooks.shelfId))
        .where(and(
          eq(shelfBooks.bookId, bookId),
          eq(shelves.userId, userId)
        ));

      return bookShelves;
    } catch (error) {
      console.error("Error getting book shelves:", error);
      return [];
    }
  }

  async updateShelf(id: string, shelfData: any): Promise<any> {
    try {
      const result = await db.update(shelves).set(shelfData).where(eq(shelves.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating shelf:", error);
      throw error;
    }
  }

  async deleteShelf(id: string): Promise<void> {
    try {
      // First remove all book associations
      await db.delete(shelfBooks).where(eq(shelfBooks.shelfId, id));
      // Then delete the shelf itself
      await db.delete(shelves).where(eq(shelves.id, id));
    } catch (error) {
      console.error("Error deleting shelf:", error);
      throw error;
    }
  }

  async addBookToShelf(shelfId: string, bookId: string): Promise<void> {
    try {
      await db.insert(shelfBooks).values({ shelfId, bookId }).onConflictDoNothing();
    } catch (error) {
      console.error("Error adding book to shelf:", error);
      throw error;
    }
  }

  async removeBookFromShelf(shelfId: string, bookId: string): Promise<void> {
    try {
      await db.delete(shelfBooks).where(
        and(
          eq(shelfBooks.shelfId, shelfId),
          eq(shelfBooks.bookId, bookId)
        )
      );
    } catch (error) {
      console.error("Error removing book from shelf:", error);
      throw error;
    }
  }

  async updateReadingProgress(userId: string, bookId: string, progress: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(readingProgress)
        .set({ ...progress, updatedAt: new Date() })
        .where(and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        ))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(readingProgress)
          .values({ ...progress, userId, bookId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating reading progress:", error);
      throw error;
    }
  }

  async getReadingProgress(userId: string, bookId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(readingProgress).where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error getting reading progress:", error);
      return undefined;
    }
  }

  async updateReadingStatistics(userId: string, bookId: string, stats: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(readingStatistics)
        .set({ ...stats, updatedAt: new Date() })
        .where(and(
          eq(readingStatistics.userId, userId),
          eq(readingStatistics.bookId, bookId)
        ))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(readingStatistics)
          .values({ ...stats, userId, bookId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating reading statistics:", error);
      throw error;
    }
  }

  async getReadingStatistics(userId: string, bookId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(readingStatistics).where(
        and(
          eq(readingStatistics.userId, userId),
          eq(readingStatistics.bookId, bookId)
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error getting reading statistics:", error);
      return undefined;
    }
  }

  async getUserStatistics(userId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(userStatistics).where(eq(userStatistics.userId, userId));
      return result[0];
    } catch (error) {
      console.error("Error getting user statistics:", error);
      return undefined;
    }
  }

  async updateUserStatistics(userId: string, stats: any): Promise<any> {
    try {
      // First try to update existing record
      const result = await db.update(userStatistics)
        .set({ ...stats, updatedAt: new Date() })
        .where(eq(userStatistics.userId, userId))
        .returning();
      
      // If no rows were updated, insert a new record
      if (result.length === 0) {
        const insertResult = await db.insert(userStatistics)
          .values({ ...stats, userId })
          .returning();
        return insertResult[0];
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating user statistics:", error);
      throw error;
    }
  }

  async createBookmark(bookmarkData: any): Promise<any> {
    try {
      const result = await db.insert(bookmarks).values(bookmarkData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bookmark:", error);
      throw error;
    }
  }

  async getDefaultBookmarkCollection(userId: string, bookId: string): Promise<any> {
    try {
      // First try to find existing collection for this user and book
      const existingCollections = await db.select()
        .from(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.userId, userId),
          eq(bookmarkCollections.bookId, bookId)
        ))
        .orderBy(asc(bookmarkCollections.createdAt));
      
      if (existingCollections.length > 0) {
        return existingCollections[0];
      }
      
      // If no collection exists, return null - we'll create it when needed
      return null;
    } catch (error) {
      console.error("Error getting default bookmark collection:", error);
      return null;
    }
  }

  async createDefaultBookmarkCollection(userId: string, bookId: string, bookTitle: string): Promise<any> {
    try {
      const collectionName = `Закладки для ${bookTitle}`;
      const collectionDescription = `Автоматическая коллекция для книги ${bookTitle}`;
      
      const result = await db.insert(bookmarkCollections)
        .values({
          userId,
          name: collectionName,
          description: collectionDescription,
          color: '#3b82f6',
          isPublic: false,
          bookId
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating default bookmark collection:", error);
      throw error;
    }
  }

  async getBookmarks(userId: string, bookId: string): Promise<any[]> {
    try {
      const result = await db.select().from(bookmarks).where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.bookId, bookId)
        )
      );
      return result;
    } catch (error) {
      console.error("Error getting bookmarks:", error);
      return [];
    }
  }

  async deleteBookmark(id: string): Promise<void> {
    try {
      await db.delete(bookmarks).where(eq(bookmarks.id, id));
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      throw error;
    }
  }

  async updateBookmark(id: string, title: string): Promise<any> {
    try {
      const result = await db.update(bookmarks)
        .set({ title })
        .where(eq(bookmarks.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bookmark:", error);
      throw error;
    }
  }

  // Bookmark Collections Methods
  
  async createBookmarkCollection(collectionData: any): Promise<any> {
    try {
      // Create the collection
      // Prepare the data for insertion, ensuring coverImageUrl is included
      const collectionValues = {
        userId: collectionData.userId,
        name: collectionData.name,
        description: collectionData.description || '',
        color: collectionData.color || '#3b82f6',
        isPublic: collectionData.isPublic || false,
        coverImageUrl: collectionData.coverImageUrl || null,
        bookId: collectionData.bookId || null,
      };
      
      const result = await db.insert(bookmarkCollections).values(collectionValues).returning();
      const newCollection = result[0];
      
      // If bookIds are provided, associate them with the collection
      if (collectionData.bookIds && Array.isArray(collectionData.bookIds) && collectionData.bookIds.length > 0) {
        const bookAssociations = collectionData.bookIds.map((bookId: string) => ({
          collectionId: newCollection.id,
          bookId
        }));
        
        await db.insert(collectionBooks).values(bookAssociations).onConflictDoNothing();
      }
      
      return newCollection;
    } catch (error) {
      console.error("Error creating bookmark collection:", error);
      throw error;
    }
  }

  async getBookmarkCollections(userId: string): Promise<any[]> {
    try {
      const result = await db.select().from(bookmarkCollections)
        .where(eq(bookmarkCollections.userId, userId))
        .orderBy(desc(bookmarkCollections.createdAt));
      
      // Add bookmark count, view count, and book count for each collection
      const collectionsWithCounts = await Promise.all(result.map(async (collection) => {
        // Get bookmark count
        const itemCount = await db.select({ count: sql`count(*)` })
          .from(bookmarkCollectionItems)
          .where(eq(bookmarkCollectionItems.collectionId, collection.id));
        
        // Get book count (distinct books with bookmarks in this collection)
        const bookCountResult = await db.select({ count: sql`COUNT(DISTINCT ${bookmarks.bookId})`.mapWith(Number) })
          .from(bookmarkCollectionItems)
          .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
          .where(eq(bookmarkCollectionItems.collectionId, collection.id));
        
        // Get associated books count (from collection_books table)
        const associatedBooksCount = await db.select({ count: sql`COUNT(*)`.mapWith(Number) })
          .from(collectionBooks)
          .where(eq(collectionBooks.collectionId, collection.id));
        
        // Use the higher of the two counts (associated books or books with bookmarks)
        const bookCount = Math.max(
          bookCountResult[0]?.count || 0,
          associatedBooksCount[0]?.count || 0
        );
        
        return {
          ...collection,
          bookmarkCount: parseInt((itemCount[0] as any).count.toString()),
          bookCount: bookCount,
          viewCount: collection.viewCount || 0
        };
      }));
      
      return collectionsWithCounts;
    } catch (error) {
      console.error("Error getting bookmark collections:", error);
      return [];
    }
  }

  async getBookmarkCollection(id: string, userId: string): Promise<any | null> {
    try {
      // Get collection with owner information
      const collectionResult = await db.select({
        id: bookmarkCollections.id,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        viewCount: bookmarkCollections.viewCount,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
        ownerId: users.id,
        ownerUsername: users.username,
        ownerFullName: users.fullName,
        ownerAvatarUrl: users.avatarUrl,
        ownerProfileRating: users.profileRating
      })
      .from(bookmarkCollections)
      .leftJoin(users, eq(bookmarkCollections.userId, users.id))
      .where(and(
        eq(bookmarkCollections.id, id),
        or(
          eq(bookmarkCollections.userId, userId),
          eq(bookmarkCollections.isPublic, true)
        )
      ));
      
      if (collectionResult.length === 0) return null;
      
      const collection = collectionResult[0];
      
      // Get all books associated with this collection (regardless of bookmarks)
      const associatedBooks = await db.select({
        id: books.id,
        title: books.title,
        author: books.author,
        coverImageUrl: books.coverImageUrl
      })
      .from(collectionBooks)
      .innerJoin(books, eq(collectionBooks.bookId, books.id))
      .where(eq(collectionBooks.collectionId, id));
      
      // Get bookmark counts for each associated book
      const booksWithCounts = await Promise.all(associatedBooks.map(async (book) => {
        const countResult = await db.select({ count: sql`COUNT(*)`.mapWith(Number) })
          .from(bookmarkCollectionItems)
          .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
          .where(and(
            eq(bookmarkCollectionItems.collectionId, id),
            eq(bookmarks.bookId, book.id)
          ));
        
        return {
          ...book,
          bookmarkCount: countResult[0].count
        };
      }));
      
      // Also get books that have bookmarks in this collection (in case they're not in collectionBooks)
      const booksFromBookmarks = await db.selectDistinct({
        id: books.id,
        title: books.title,
        author: books.author,
        coverImageUrl: books.coverImageUrl
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .innerJoin(books, eq(bookmarks.bookId, books.id))
      .where(eq(bookmarkCollectionItems.collectionId, id));
      
      // Get bookmark counts for books from bookmarks
      const bookBookmarkCounts = await Promise.all(booksFromBookmarks.map(async (book) => {
        const countResult = await db.select({ count: sql`COUNT(*)`.mapWith(Number) })
          .from(bookmarkCollectionItems)
          .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
          .where(and(
            eq(bookmarkCollectionItems.collectionId, id),
            eq(bookmarks.bookId, book.id)
          ));
        
        return {
          ...book,
          bookmarkCount: countResult[0].count
        };
      }));
      
      // Combine both sources and deduplicate (favor books from collectionBooks)
      const allBooks = [...booksWithCounts, ...bookBookmarkCounts];
      const uniqueBooks = Array.from(
        new Map(allBooks.map(book => [book.id, book])).values()
      );
      
      // Get bookmarks in this collection with book details
      const bookmarksInCollection = await db.select({
        id: bookmarks.id,
        title: bookmarks.title,
        chapterIndex: bookmarks.chapterIndex,
        percentage: bookmarks.percentage,
        selectedText: bookmarks.selectedText,
        pageInChapter: bookmarks.pageInChapter,
        clickCount: bookmarks.clickCount, // Include click count
        createdAt: bookmarks.createdAt,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthor: books.author,
        bookCoverImageUrl: books.coverImageUrl
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarks, eq(bookmarkCollectionItems.bookmarkId, bookmarks.id))
      .innerJoin(books, eq(bookmarks.bookId, books.id))
      .where(eq(bookmarkCollectionItems.collectionId, id))
      .orderBy(bookmarkCollectionItems.addedAt);
      
      return {
        ...collection,
        books: uniqueBooks,
        bookmarks: bookmarksInCollection
      };
    } catch (error) {
      console.error("Error getting bookmark collection:", error);
      return null;
    }
  }

  async updateBookmarkCollection(id: string, userId: string, updateData: any): Promise<any | null> {
    try {
      console.log('=== UPDATE BOOKMARK COLLECTION DEBUG ===');
      console.log('Collection ID:', id);
      console.log('User ID:', userId);
      console.log('Update Data:', JSON.stringify(updateData, null, 2));
      console.log('Book IDs in updateData:', updateData.bookIds);
      console.log('Book IDs type:', typeof updateData.bookIds);
      console.log('Book IDs isArray:', Array.isArray(updateData.bookIds));
      
      // Update the collection with proper fields
      const result = await db.update(bookmarkCollections)
        .set({
          name: updateData.name,
          description: updateData.description,
          color: updateData.color,
          isPublic: updateData.isPublic,
          coverImageUrl: updateData.coverImageUrl,
          bookId: updateData.bookId, // Handle single book ID if provided
          updatedAt: new Date() // Make sure to update the timestamp
        })
        .where(and(
          eq(bookmarkCollections.id, id),
          eq(bookmarkCollections.userId, userId)
        ))
        .returning({
          id: bookmarkCollections.id,
          userId: bookmarkCollections.userId,
          name: bookmarkCollections.name,
          description: bookmarkCollections.description,
          color: bookmarkCollections.color,
          isPublic: bookmarkCollections.isPublic,
          viewCount: bookmarkCollections.viewCount,
          createdAt: bookmarkCollections.createdAt,
          updatedAt: bookmarkCollections.updatedAt,
          bookId: bookmarkCollections.bookId
        });
      
      const updatedCollection = result[0] || null;
      
      if (!updatedCollection) {
        console.log('No collection was updated - likely unauthorized');
        return null;
      }
      
      console.log('Collection updated successfully:', updatedCollection.name);
      
      // If bookIds are provided, update the book associations (for multiple books)
      if (updateData.bookIds !== undefined) {
        console.log('Processing multiple book associations...');
        console.log('Book IDs to process:', updateData.bookIds);
        
        // Remove all existing book associations
        const deleteResult = await db.delete(collectionBooks)
          .where(eq(collectionBooks.collectionId, id));
        console.log('Deleted existing book associations:', deleteResult.count);
        
        // Add new book associations if provided
        if (Array.isArray(updateData.bookIds) && updateData.bookIds.length > 0) {
          const bookAssociations = updateData.bookIds.map((bookId: string) => ({
            collectionId: id,
            bookId
          }));
          
          console.log('Inserting book associations:', bookAssociations);
          const insertResult = await db.insert(collectionBooks).values(bookAssociations).onConflictDoNothing();
          console.log('Inserted book associations result:', insertResult);
        } else {
          console.log('No book IDs to insert (empty array or not array)');
        }
      } else {
        console.log('No bookIds provided in updateData');
      }
      
      // Also handle the deprecated single bookId field for backward compatibility
      if (updateData.bookId !== undefined && updateData.bookIds === undefined) {
        console.log('Processing single bookId for backward compatibility:', updateData.bookId);
        // Update the book_id column in bookmark_collections table
        await db.update(bookmarkCollections)
          .set({ bookId: updateData.bookId })
          .where(eq(bookmarkCollections.id, id));
      }
      
      console.log('=== END UPDATE BOOKMARK COLLECTION DEBUG ===');
      
      return updatedCollection;
    } catch (error) {
      console.error("Error updating bookmark collection:", error);
      throw error;
    }
  }

  async deleteBookmarkCollection(id: string, userId: string): Promise<boolean> {
    try {
      const result = await db.delete(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.id, id),
          eq(bookmarkCollections.userId, userId)
        ));
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Error deleting bookmark collection:", error);
      throw error;
    }
  }

  async addBookmarkToCollection(collectionId: string, bookmarkId: string, userId: string): Promise<any> {
    try {
      // First verify that the collection belongs to the user and bookmark exists
      const collection = await db.select().from(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.id, collectionId),
          eq(bookmarkCollections.userId, userId)
        ));
      
      if (collection.length === 0) {
        throw new Error("Collection not found or unauthorized");
      }
      
      const bookmark = await db.select().from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId));
      
      if (bookmark.length === 0) {
        throw new Error("Bookmark not found");
      }
      
      // Add bookmark to collection
      const result = await db.insert(bookmarkCollectionItems)
        .values({
          collectionId,
          bookmarkId
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error adding bookmark to collection:", error);
      throw error;
    }
  }

  async removeBookmarkFromCollection(collectionId: string, bookmarkId: string, userId: string): Promise<boolean> {
    try {
      // Verify that the collection belongs to the user
      const collection = await db.select().from(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.id, collectionId),
          eq(bookmarkCollections.userId, userId)
        ));
      
      if (collection.length === 0) {
        return false;
      }
      
      // Remove bookmark from collection
      const result = await db.delete(bookmarkCollectionItems)
        .where(and(
          eq(bookmarkCollectionItems.collectionId, collectionId),
          eq(bookmarkCollectionItems.bookmarkId, bookmarkId)
        ));
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Error removing bookmark from collection:", error);
      throw error;
    }
  }

  async getBookmarkCollectionsForBookmark(bookmarkId: string, userId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: bookmarkCollections.id,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        color: bookmarkCollections.color,
        isPublic: bookmarkCollections.isPublic,
        createdAt: bookmarkCollections.createdAt
      })
      .from(bookmarkCollectionItems)
      .innerJoin(bookmarkCollections, eq(bookmarkCollectionItems.collectionId, bookmarkCollections.id))
      .where(and(
        eq(bookmarkCollectionItems.bookmarkId, bookmarkId),
        eq(bookmarkCollections.userId, userId)
      ))
      .orderBy(bookmarkCollections.name);
      
      return result;
    } catch (error) {
      console.error("Error getting collections for bookmark:", error);
      return [];
    }
  }

  async createComment(commentData: any): Promise<any> {
    try {
      // Insert the comment
      const insertResult = await db.insert(comments).values(commentData).returning();
      
      // Get the comment with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        parentCommentId: comments.parentCommentId,
        quotedText: comments.quotedText,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        attachmentMetadata: comments.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, insertResult[0].id));
      
      // Format the response to match what the frontend expects
      const comment = result[0];
      return {
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        content: comment.content,
        parentCommentId: comment.parentCommentId,
        quotedText: comment.quotedText,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous',
        username: comment.username,
        avatarUrl: comment.avatarUrl || null,
        attachmentMetadata: comment.attachmentMetadata
      };
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  }

  async getComments(bookId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Get only root comments (no parent) with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        parentCommentId: comments.parentCommentId,
        quotedText: comments.quotedText,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        attachmentMetadata: comments.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(and(
        eq(comments.bookId, bookId),
        isNull(comments.parentCommentId)
      ))
      .orderBy(desc(comments.createdAt));
      
      // Get reactions and reply counts for each comment
      const commentsWithData = await Promise.all(result.map(async (comment) => {
        const metadata = comment.attachmentMetadata as any;
        const replyCount = await this.countBookCommentReplies(comment.id);
        const reactions = await this.getCommentReactions(comment.id, currentUserId);
        
        return {
          id: comment.id,
          userId: comment.userId,
          bookId: comment.bookId,
          content: comment.content,
          parentCommentId: comment.parentCommentId,
          quotedText: comment.quotedText,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          author: comment.fullName || comment.username || 'Anonymous',
          username: comment.username,
          avatarUrl: comment.avatarUrl || null,
          isOwnComment: currentUserId ? comment.userId === currentUserId : false,
          reactions,
          replyCount,
          attachments: metadata?.attachments || []
        };
      }));
      
      return commentsWithData;
    } catch (error) {
      console.error("Error getting comments:", error);
      return [];
    }
  }

  async countBookCommentReplies(commentId: string): Promise<number> {
    // Recursively count all replies (direct and nested)
    const directReplies = await db.select({
      id: comments.id
    })
    .from(comments)
    .where(eq(comments.parentCommentId, commentId));
    
    let total = directReplies.length;
    
    for (const reply of directReplies) {
      total += await this.countBookCommentReplies(reply.id);
    }
    
    return total;
  }

  async getBookTotalCommentCount(bookId: string): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(comments)
        .where(eq(comments.bookId, bookId));
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting book total comment count:", error);
      return 0;
    }
  }

  async getBookCommentReplies(commentId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Get direct replies to this comment
      const replies = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        parentCommentId: comments.parentCommentId,
        quotedText: comments.quotedText,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        attachmentMetadata: comments.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.parentCommentId, commentId))
      .orderBy(comments.createdAt); // Oldest first for replies
      
      // Get reactions, parent info, and nested replies for each reply
      const repliesWithData = await Promise.all(replies.map(async (reply) => {
        const metadata = reply.attachmentMetadata as any;
        const reactions = await this.getCommentReactions(reply.id, currentUserId);
        
        // Get parent comment author name
        let parentCommentAuthor = null;
        if (reply.parentCommentId) {
          const parentComment = await db.select({
            username: users.username,
            fullName: users.fullName,
          })
          .from(comments)
          .leftJoin(users, eq(comments.userId, users.id))
          .where(eq(comments.id, reply.parentCommentId))
          .limit(1);
          
          if (parentComment[0]) {
            parentCommentAuthor = parentComment[0].fullName || parentComment[0].username;
          }
        }
        
        // Recursively get nested replies
        const nestedReplies = await this.getBookCommentReplies(reply.id, currentUserId);
        const replyCount = await this.countBookCommentReplies(reply.id);
        
        // Get file uploads associated with this reply
        const replyAttachments = await db
          .select({
            id: fileUploads.id,
            fileUrl: fileUploads.fileUrl,
            filename: fileUploads.filename,
            fileSize: fileUploads.fileSize,
            mimeType: fileUploads.mimeType,
            thumbnailUrl: fileUploads.thumbnailUrl
          })
          .from(fileUploads)
          .where(and(
            eq(fileUploads.entityId, reply.id),
            eq(fileUploads.entityType, 'comment')
          ));
        
        return {
          id: reply.id,
          userId: reply.userId,
          bookId: reply.bookId,
          content: reply.content,
          parentCommentId: reply.parentCommentId,
          quotedText: reply.quotedText,
          createdAt: reply.createdAt.toISOString(),
          updatedAt: reply.updatedAt.toISOString(),
          author: reply.fullName || reply.username || 'Anonymous',
          username: reply.username,
          avatarUrl: reply.avatarUrl || null,
          isOwnComment: currentUserId ? reply.userId === currentUserId : false,
          reactions,
          parentCommentAuthor,
          replies: nestedReplies,
          replyCount,
          attachments: replyAttachments.map(att => ({
            uploadId: att.id,
            url: att.fileUrl,
            filename: att.filename,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            thumbnailUrl: att.thumbnailUrl
          }))
        };
      }));
      
      return repliesWithData;
    } catch (error) {
      console.error("Error getting book comment replies:", error);
      throw error;
    }
  }

  async getAllComments(): Promise<any[]> {
    try {
      // Get all comments with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        newsId: comments.newsId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .orderBy(desc(comments.createdAt));
      
      // Format the response to match what the frontend expects
      return result.map(comment => ({
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        newsId: comment.newsId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous',
        avatarUrl: comment.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting all comments:", error);
      return [];
    }
  }

  async deleteComment(id: string, userId: string | null): Promise<boolean> {
    try {
      const comment = await db.select().from(comments).where(eq(comments.id, id));
      if (!comment.length) {
        console.log(`[deleteComment] Comment not found: ${id}`);
        return false; // Comment not found
      }
      
      console.log(`[deleteComment] Attempting to delete comment ${id} by user ${userId}`);
      
      // If userId is provided, verify it belongs to the user (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && comment[0].userId !== userId) {
        console.log(`[deleteComment] Permission denied: user ${userId} is not owner ${comment[0].userId}`);
        return false; // Not the owner and not an admin action
      }
      
      // Store the newsId or bookId before deletion to update counters
      const commentNewsId = comment[0].newsId;
      const commentBookId = comment[0].bookId;
      
      // Delete associated reactions first
      console.log(`[deleteComment] Deleting reactions for comment ${id}`);
      await db.delete(reactions).where(eq(reactions.commentId, id));
      
      // Soft delete associated file uploads
      const metadata = comment[0].attachmentMetadata as any;
      if (metadata?.attachments && Array.isArray(metadata.attachments)) {
        console.log(`[deleteComment] Found ${metadata.attachments.length} attachments to soft delete`);
        for (const attachment of metadata.attachments) {
          // Find file upload by URL
          const fileUpload = await db.select().from(fileUploads)
            .where(eq(fileUploads.fileUrl, attachment.url));
          
          if (fileUpload.length > 0 && !fileUpload[0].deletedAt) {
            console.log(`[deleteComment] Soft deleting file upload: ${fileUpload[0].id}`);
            await db.update(fileUploads)
              .set({ deletedAt: new Date() })
              .where(eq(fileUploads.id, fileUpload[0].id));
          }
        }
      }
      
      // Delete the comment
      console.log(`[deleteComment] Deleting comment ${id}`);
      await db.delete(comments).where(eq(comments.id, id));
      console.log(`[deleteComment] Successfully deleted comment ${id}`);
      
      // Decrement comment count in news (books don't have commentCount in schema)
      if (commentNewsId) {
        console.log(`[deleteComment] Decrementing comment count for news ${commentNewsId}`);
        await db.update(news)
          .set({ commentCount: sql`GREATEST(${news.commentCount} - 1, 0)`, updatedAt: new Date() })
          .where(eq(news.id, commentNewsId));
      }
      
      return true;
    } catch (error) {
      console.error("[deleteComment] Error deleting comment:", error);
      throw error;
    }
  }

  async updateComment(id: string, commentData: any): Promise<any> {
    try {
      // Update the comment
      const updateResult = await db.update(comments)
        .set({ ...commentData, updatedAt: new Date() })
        .where(eq(comments.id, id))
        .returning();
      
      if (updateResult.length === 0) {
        return null; // Comment not found
      }
      
      // Get the updated comment with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, updateResult[0].id));
      
      // Format the response to match what the frontend expects
      const comment = result[0];
      return {
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error updating comment:", error);
      throw error;
    }
  }
    
  async getCommentById(id: string): Promise<any | undefined> {
    try {
      // Get the comment with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        bookId: comments.bookId,
        newsId: comments.newsId,
        articleId: comments.articleId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        parentCommentId: comments.parentCommentId,
        quotedText: comments.quotedText,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, id));
        
      if (result.length === 0) {
        return undefined; // Comment not found
      }
        
      // Format the response to match what the frontend expects
      const comment = result[0];
      return {
        id: comment.id,
        userId: comment.userId,
        bookId: comment.bookId,
        newsId: comment.newsId,
        articleId: comment.articleId || null,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        parentCommentId: comment.parentCommentId || null,
        quotedText: comment.quotedText || null,
        username: comment.username,
        fullName: comment.fullName,
        author: comment.fullName || comment.username || 'Anonymous',
        avatarUrl: comment.avatarUrl || null
      };
    } catch (error) {
      console.error("Error getting comment by ID:", error);
      return undefined;
    }
  }
    
  async createReview(reviewData: any): Promise<any> {
    try {
      console.log('Creating review with data:', reviewData);
      // Insert the review
      const insertResult = await db.insert(reviews).values(reviewData).returning();
        
      console.log('Inserted review result:', insertResult[0]);
      // Get the review with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        parentReviewId: reviews.parentReviewId,
        quotedText: reviews.quotedText,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        attachmentMetadata: reviews.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.id, insertResult[0].id));
        
      console.log('Selected review result:', result[0]);
      // Calculate and update the book's average rating (only for root reviews)
      if (!reviewData.parentReviewId) {
        console.log('Calling updateBookAverageRating for book:', reviewData.bookId);
        await this.updateBookAverageRating(reviewData.bookId);
      }
        
      // Format the response to match what the frontend expects
      const review = result[0];
      return {
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        parentReviewId: review.parentReviewId,
        quotedText: review.quotedText,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous',
        username: review.username,
        avatarUrl: review.avatarUrl || null,
        attachmentMetadata: review.attachmentMetadata
      };
    } catch (error) {
      console.error("Error creating review:", error);
      throw error;
    }
  }
    
  async updateBookAverageRating(bookId: string): Promise<void> {
    try {
      console.log(`Updating average rating for book ${bookId}`);
      
      // Get current rating algorithm configuration
      const configResult = await db.select().from(ratingSystemConfig).limit(1);
      const config = configResult[0];
      
      if (!config) {
        console.error("No rating system configuration found, using simple average");
      }
      
      // Get all reviews for this book with reaction counts
      const bookReviews = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.bookId, bookId));
        
      console.log(`Found ${bookReviews.length} reviews for book ${bookId}`);
      
      if (bookReviews.length > 0) {
        // Get reaction counts (likes) for all reviews
        const reviewIds = bookReviews.map(r => r.id);
        const reactionCounts = await db.select({
          reviewId: reactions.reviewId,
          count: sql<number>`count(*)::int`
        })
        .from(reactions)
        .where(inArray(reactions.reviewId, reviewIds))
        .groupBy(reactions.reviewId);
        
        // Create a map of review ID to like count
        const likesMap = new Map<string, number>();
        for (const rc of reactionCounts) {
          if (rc.reviewId) {
            likesMap.set(rc.reviewId, rc.count);
          }
        }
        
        // Format reviews for rating calculation
        const reviewsForCalc: Review[] = bookReviews.map(r => ({
          id: r.id,
          rating: r.rating,
          content: r.content,
          createdAt: r.createdAt,
          likes: likesMap.get(r.id) || 0,
          userId: r.userId
        }));
        
        // Build rating algorithm config from database settings
        const ratingConfig: RatingAlgorithmConfig = {
          type: (config?.algorithmType as any) || 'simple_average',
          params: {
            priorMean: config ? Number(config.priorMean) : 7.4,
            priorWeight: config?.priorWeight || 30,
            likesAlpha: config ? Number(config.likesAlpha) : 0.4,
            likesMaxWeight: config ? Number(config.likesMaxWeight) : 3,
            minTextWeight: config ? Number(config.minTextWeight) : 0.3,
            timeDecayEnabled: config?.timeDecayEnabled || false,
            timeDecayHalfLife: config?.timeDecayHalfLife || 180,
          }
        };
        
        // Calculate rating using the configured algorithm
        const { rating: calculatedRating, confidence } = calculateRating(reviewsForCalc, ratingConfig);
        
        console.log(`Calculated rating: ${calculatedRating} (confidence: ${confidence.toFixed(2)}) for book ${bookId} using ${ratingConfig.type}`);
          
        // Update the book's rating field
        if (calculatedRating !== null) {
          await db.update(books)
            .set({ rating: sql`${calculatedRating}` })
            .where(eq(books.id, bookId));
            
          console.log(`Updated book ${bookId} rating to ${calculatedRating}`);
        } else {
          await db.update(books)
            .set({ rating: null })
            .where(eq(books.id, bookId));
            
          console.log(`Set book ${bookId} rating to null`);
        }
      } else {
        // If no reviews, set rating to null
        await db.update(books)
          .set({ rating: null })
          .where(eq(books.id, bookId));
          
        console.log(`Set book ${bookId} rating to null (no reviews)`);
      }
    } catch (error) {
      console.error("Error updating book average rating:", error);
      // Don't throw error as this is a secondary operation
    }
  };

  async getReviews(bookId: string, currentUserId?: string): Promise<any[]> {
    try {
      console.log(`[getReviews] Looking for reviews for book ${bookId}`);
      
      // Get only root reviews (no parent) with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        parentReviewId: reviews.parentReviewId,
        quotedText: reviews.quotedText,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        attachmentMetadata: reviews.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(
        eq(reviews.bookId, bookId),
        isNull(reviews.parentReviewId)
      ))
      .orderBy(desc(reviews.createdAt));
      
      console.log(`[getReviews] Found ${result.length} root reviews`);
      
      // Also check all reviews for this book (including replies)
      const allReviews = await db.select()
        .from(reviews)
        .where(eq(reviews.bookId, bookId));
      
      console.log(`[getReviews] Total reviews for this book: ${allReviews.length}`);
      console.log(`[getReviews] All reviews:`, allReviews);
      
      // Get reactions and reply counts for each review
      const reviewsWithData = await Promise.all(result.map(async (review) => {
        const metadata = review.attachmentMetadata as any;
        const replyCount = await this.countReviewReplies(review.id);
        const reactions = await this.getReviewReactions(review.id, currentUserId);
        
        return {
          id: review.id,
          userId: review.userId,
          bookId: review.bookId,
          rating: review.rating,
          content: review.content,
          parentReviewId: review.parentReviewId,
          quotedText: review.quotedText,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
          author: review.fullName || review.username || 'Anonymous',
          username: review.username,
          avatarUrl: review.avatarUrl || null,
          isOwnReview: currentUserId ? review.userId === currentUserId : false,
          reactions,
          replyCount,
          attachments: metadata?.attachments || []
        };
      }));
      
      console.log(`[getReviews] Returning ${reviewsWithData.length} reviews`);
      return reviewsWithData;
    } catch (error) {
      console.error("Error getting reviews:", error);
      return [];
    }
  }

  async countReviewReplies(reviewId: string): Promise<number> {
    // Recursively count all replies (direct and nested)
    const directReplies = await db.select({
      id: reviews.id
    })
    .from(reviews)
    .where(eq(reviews.parentReviewId, reviewId));
    
    let total = directReplies.length;
    
    for (const reply of directReplies) {
      total += await this.countReviewReplies(reply.id);
    }
    
    return total;
  }

  async getReviewReplies(reviewId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Get direct replies to this review
      const replies = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        parentReviewId: reviews.parentReviewId,
        quotedText: reviews.quotedText,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        attachmentMetadata: reviews.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.parentReviewId, reviewId))
      .orderBy(reviews.createdAt); // Oldest first for replies
      
      // Get reactions, parent info, and nested replies for each reply
      const repliesWithData = await Promise.all(replies.map(async (reply) => {
        const metadata = reply.attachmentMetadata as any;
        const reactions = await this.getReviewReactions(reply.id, currentUserId);
        
        // Get parent review author name
        let parentReviewAuthor = null;
        if (reply.parentReviewId) {
          const parentReview = await db.select({
            username: users.username,
            fullName: users.fullName,
          })
          .from(reviews)
          .leftJoin(users, eq(reviews.userId, users.id))
          .where(eq(reviews.id, reply.parentReviewId))
          .limit(1);
          
          if (parentReview[0]) {
            parentReviewAuthor = parentReview[0].fullName || parentReview[0].username;
          }
        }
        
        // Get user's root review rating for this book (if they have one)
        let userBookRating = null;
        const userRootReview = await db.select({
          rating: reviews.rating,
        })
        .from(reviews)
        .where(and(
          eq(reviews.userId, reply.userId),
          eq(reviews.bookId, reply.bookId),
          isNull(reviews.parentReviewId)
        ))
        .limit(1);
        
        if (userRootReview[0] && userRootReview[0].rating) {
          userBookRating = userRootReview[0].rating;
        }
        
        // Recursively get nested replies
        const nestedReplies = await this.getReviewReplies(reply.id, currentUserId);
        const replyCount = await this.countReviewReplies(reply.id);
        
        return {
          id: reply.id,
          userId: reply.userId,
          bookId: reply.bookId,
          rating: reply.rating,
          userBookRating, // User's rating from their root review
          content: reply.content,
          parentReviewId: reply.parentReviewId,
          quotedText: reply.quotedText,
          createdAt: reply.createdAt.toISOString(),
          updatedAt: reply.updatedAt.toISOString(),
          author: reply.fullName || reply.username || 'Anonymous',
          username: reply.username,
          avatarUrl: reply.avatarUrl || null,
          isOwnReview: currentUserId ? reply.userId === currentUserId : false,
          reactions,
          parentReviewAuthor,
          replies: nestedReplies,
          replyCount,
          attachments: metadata?.attachments || []
        };
      }));
      
      return repliesWithData;
    } catch (error) {
      console.error("Error getting review replies:", error);
      throw error;
    }
  }

  async getReviewReactions(reviewId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]> {
    try {
      // Get all reactions for this review grouped by emoji
      const allReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.reviewId, reviewId));
      
      // Group by emoji and count
      const emojiCounts: Record<string, {count: number, userReacted: boolean}> = {};
      
      for (const reaction of allReactions) {
        if (!emojiCounts[reaction.emoji]) {
          emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
        }
        emojiCounts[reaction.emoji].count++;
        if (currentUserId && reaction.userId === currentUserId) {
          emojiCounts[reaction.emoji].userReacted = true;
        }
      }
      
      // Convert to array
      return Object.entries(emojiCounts).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      }));
    } catch (error) {
      console.error("Error getting review reactions:", error);
      return [];
    }
  }

  async addReviewReaction(userId: string, reviewId: string, emoji: string): Promise<any> {
    try {
      // Check if reaction already exists
      const existing = await db.select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.reviewId, reviewId),
            eq(reactions.emoji, emoji)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        return existing[0]; // Already reacted with this emoji
      }
      
      // Add new reaction
      const result = await db.insert(reactions)
        .values({
          userId,
          reviewId,
          emoji,
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error adding review reaction:", error);
      throw error;
    }
  }

  async removeReviewReaction(userId: string, reviewId: string, emoji: string): Promise<boolean> {
    try {
      const result = await db.delete(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.reviewId, reviewId),
            eq(reactions.emoji, emoji)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error removing review reaction:", error);
      throw error;
    }
  }

  async getAllReviews(): Promise<any[]> {
    try {
      // Get all reviews with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .orderBy(desc(reviews.createdAt));
      
      // Format the response to match what the frontend expects
      return result.map(review => ({
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous',
        avatarUrl: review.avatarUrl || null,
        reactions: []
      }));
    } catch (error) {
      console.error("Error getting all reviews:", error);
      return [];
    }
  }

  async getUserReview(userId: string, bookId: string): Promise<any | undefined> {
    try {
      // First try to find root review with user info
      let result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        parentReviewId: reviews.parentReviewId,
        quotedText: reviews.quotedText,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        attachmentMetadata: reviews.attachmentMetadata,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(
        eq(reviews.userId, userId),
        eq(reviews.bookId, bookId),
        isNull(reviews.parentReviewId)
      ))
      .limit(1);
      
      // If no root review found, try to find any review (including replies)
      if (result.length === 0) {
        result = await db.select({
          id: reviews.id,
          userId: reviews.userId,
          bookId: reviews.bookId,
          rating: reviews.rating,
          content: reviews.content,
          parentReviewId: reviews.parentReviewId,
          quotedText: reviews.quotedText,
          createdAt: reviews.createdAt,
          updatedAt: reviews.updatedAt,
          attachmentMetadata: reviews.attachmentMetadata,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(and(
          eq(reviews.userId, userId),
          eq(reviews.bookId, bookId)
        ))
        .limit(1);
      }
      
      if (result.length === 0) {
        // Let's also check what reviews exist for this user and book
        const allUserReviews = await db.select()
          .from(reviews)
          .where(and(
            eq(reviews.userId, userId),
            eq(reviews.bookId, bookId)
          ));
        return undefined;
      }
      
      const review = result[0];
      const metadata = review.attachmentMetadata as any;
      
      return {
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        parentReviewId: review.parentReviewId,
        quotedText: review.quotedText,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous',
        avatarUrl: review.avatarUrl || null
      };
    } catch (error) {
      console.error("Error getting user review:", error);
      return undefined;
    }
  }

  async getReviewById(reviewId: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(reviews).where(eq(reviews.id, reviewId));
      
      if (result.length === 0) {
        return undefined;
      }
      
      return result[0];
    } catch (error) {
      console.error("Error getting review by id:", error);
      return undefined;
    }
  }

  async deleteReview(id: string, userId: string | null): Promise<boolean> {
    try {
      const review = await db.select().from(reviews).where(eq(reviews.id, id));
      if (!review.length) {
        console.log(`[deleteReview] Review not found: ${id}`);
        return false; // Review not found
      }
      
      console.log(`[deleteReview] Attempting to delete review ${id} by user ${userId}`);
      
      // If userId is provided, verify it belongs to the user (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && review[0].userId !== userId) {
        console.log(`[deleteReview] Permission denied: user ${userId} is not owner ${review[0].userId}`);
        return false; // Not the owner and not an admin action
      }
      
      const bookId = review[0].bookId;
      
      // Delete associated reactions first
      console.log(`[deleteReview] Deleting reactions for review ${id}`);
      await db.delete(reactions).where(eq(reactions.reviewId, id));
      
      // Soft delete associated file uploads
      const metadata = review[0].attachmentMetadata as any;
      if (metadata?.attachments && Array.isArray(metadata.attachments)) {
        console.log(`[deleteReview] Found ${metadata.attachments.length} attachments to soft delete`);
        for (const attachment of metadata.attachments) {
          // Find file upload by URL
          const fileUpload = await db.select().from(fileUploads)
            .where(eq(fileUploads.fileUrl, attachment.url));
          
          if (fileUpload.length > 0 && !fileUpload[0].deletedAt) {
            console.log(`[deleteReview] Soft deleting file upload: ${fileUpload[0].id}`);
            await db.update(fileUploads)
              .set({ deletedAt: new Date() })
              .where(eq(fileUploads.id, fileUpload[0].id));
          }
        }
      }
      
      // Delete the review
      console.log(`[deleteReview] Deleting review ${id}`);
      await db.delete(reviews).where(eq(reviews.id, id));
      
      // Recalculate and update the book's average rating
      console.log(`[deleteReview] Recalculating book rating for ${bookId}`);
      await this.updateBookAverageRating(bookId);
      
      console.log(`[deleteReview] Successfully deleted review ${id}`);
      return true;
    } catch (error) {
      console.error("[deleteReview] Error deleting review:", error);
      throw error;
    }
  }

  async updateReview(id: string, reviewData: any): Promise<any> {
    try {
      // Get the current review to access the bookId before update
      const currentReview = await db.select().from(reviews).where(eq(reviews.id, id));
      if (currentReview.length === 0) {
        return null; // Review not found
      }
      
      const bookId = currentReview[0].bookId;
      
      // Update the review
      const updateResult = await db.update(reviews)
        .set({ ...reviewData, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      
      if (updateResult.length === 0) {
        return null; // Review not found
      }
      
      // Get the updated review with user information
      const result = await db.select({
        id: reviews.id,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.id, updateResult[0].id));
      
      // Recalculate and update the book's average rating
      await this.updateBookAverageRating(bookId);
      
      // Format the response to match what the frontend expects
      const review = result[0];
      return {
        id: review.id,
        userId: review.userId,
        bookId: review.bookId,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        author: review.fullName || review.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error updating review:", error);
      throw error;
    }
  }

  async createReaction(reactionData: any): Promise<any> {
    try {
      console.log('Creating reaction with data:', reactionData);
      
      // Validate that exactly one entity ID is provided
      const entityIds = [reactionData.commentId, reactionData.reviewId, reactionData.newsId, reactionData.bookId].filter(id => id && id !== '');
      
      if (entityIds.length === 0) {
        throw new Error('One of commentId, reviewId, newsId, or bookId is required');
      }
      
      if (entityIds.length > 1) {
        throw new Error('Only one of commentId, reviewId, newsId, or bookId should be provided');
      }
      
      // Build the condition to check for existing reactions
      let entityCondition;
      if (reactionData.commentId) {
        entityCondition = eq(reactions.commentId, reactionData.commentId);
      } else if (reactionData.reviewId) {
        entityCondition = eq(reactions.reviewId, reactionData.reviewId);
      } else if (reactionData.newsId) {
        entityCondition = eq(reactions.newsId, reactionData.newsId);
      } else if (reactionData.bookId) {
        entityCondition = eq(reactions.bookId, reactionData.bookId);
      }
      
      const condition = and(
        eq(reactions.userId, reactionData.userId),
        eq(reactions.emoji, reactionData.emoji),
        entityCondition
      );
      
      console.log('Query condition:', condition);
      
      const existingReactions = await db.select().from(reactions).where(condition);
      
      console.log('Existing reactions found:', existingReactions.length);
      if (existingReactions.length > 0) {
        console.log('Existing reaction details:', existingReactions[0]);
      }
      
      if (existingReactions.length > 0) {
        // If reaction exists, remove it (toggle off)
        console.log('Removing existing reaction with ID:', existingReactions[0].id);
        await db.delete(reactions).where(eq(reactions.id, existingReactions[0].id));
        
        // Get updated reactions for this entity
        let entityTypeId: string;
        let entityType: 'comment' | 'review' | 'news' | 'book' | 'article';
        
        if (reactionData.bookId) {
          entityTypeId = reactionData.bookId;
          entityType = 'book';
        } else if (reactionData.commentId) {
          entityTypeId = reactionData.commentId;
          entityType = 'comment';
        } else if (reactionData.reviewId) {
          entityTypeId = reactionData.reviewId;
          entityType = 'review';
        } else if (reactionData.newsId) {
          entityTypeId = reactionData.newsId;
          entityType = 'news';
        } else if (reactionData.articleId) {
          entityTypeId = reactionData.articleId;
          entityType = 'article';
        } else {
          throw new Error('No entity ID provided for reaction');
        }
        
        const updatedReactions = await this.getReactions(entityTypeId, entityType);
        
        return { removed: true, id: existingReactions[0].id, reactions: updatedReactions };
      } else {
        // If reaction doesn't exist, create it
        console.log('Inserting new reaction');
        const result = await db.insert(reactions).values(reactionData).returning();
        console.log('Created reaction:', result[0]);
        
        // Get updated reactions for this entity
        let entityTypeId: string;
        let entityType: 'comment' | 'review' | 'news' | 'book' | 'article';
        
        if (reactionData.bookId) {
          entityTypeId = reactionData.bookId;
          entityType = 'book';
        } else if (reactionData.commentId) {
          entityTypeId = reactionData.commentId;
          entityType = 'comment';
        } else if (reactionData.reviewId) {
          entityTypeId = reactionData.reviewId;
          entityType = 'review';
        } else if (reactionData.newsId) {
          entityTypeId = reactionData.newsId;
          entityType = 'news';
        } else if (reactionData.articleId) {
          entityTypeId = reactionData.articleId;
          entityType = 'article';
        } else {
          throw new Error('No entity ID provided for reaction');
        }
        
        const updatedReactions = await this.getReactions(entityTypeId, entityType);
        
        return { created: true, reaction: result[0], reactions: updatedReactions };
      }
    } catch (error) {
      console.error("Error creating reaction:", error);
      throw error;
    }
  }

  async getReactions(entityId: string, entityType: 'comment' | 'review' | 'news' | 'book' | 'article'): Promise<any[]> {
    try {
      let condition;
      if (entityType === 'comment') {
        condition = eq(reactions.commentId, entityId);
      } else if (entityType === 'review') {
        condition = eq(reactions.reviewId, entityId);
      } else if (entityType === 'news') {
        condition = eq(reactions.newsId, entityId);
      } else if (entityType === 'book') {
        condition = eq(reactions.bookId, entityId);
      } else if (entityType === 'article') {
        condition = eq(reactions.articleId, entityId);
      }
      
      const result = await db.select({
        id: reactions.id,
        userId: reactions.userId,
        commentId: reactions.commentId,
        reviewId: reactions.reviewId,
        newsId: reactions.newsId,
        bookId: reactions.bookId,
        articleId: reactions.articleId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reactions)
      .leftJoin(users, eq(reactions.userId, users.id))
      .where(condition);
      
      return result;
    } catch (error) {
      console.error("Error getting reactions:", error);
      return [];
    }
  }

  async getReactionsForItems(itemIds: string[], isComment: boolean): Promise<any[]> {
    try {
      if (itemIds.length === 0) return [];
      
      const result = await db.select({
        id: reactions.id,
        userId: reactions.userId,
        commentId: reactions.commentId,
        reviewId: reactions.reviewId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt
      })
      .from(reactions)
      .where(isComment 
        ? inArray(reactions.commentId, itemIds)
        : inArray(reactions.reviewId, itemIds));
      
      return result;
    } catch (error) {
      console.error("Error getting reactions for items:", error);
      return [];
    }
  }
  
  async deleteReaction(id: string, userId: string | null): Promise<boolean> {
    try {
      // First check if the reaction exists
      const reaction = await db.select().from(reactions).where(eq(reactions.id, id));
      if (!reaction.length) {
        return false; // Reaction not found
      }
      
      const reactionData = reaction[0];
      
      // If userId is provided, verify it belongs to the user (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && reactionData.userId !== userId) {
        return false; // Not the owner and not an admin action
      }
      
      // Delete the reaction
      await db.delete(reactions).where(eq(reactions.id, id));
      
      // Update the reaction count in the news table if this was a news reaction
      if (reactionData.newsId) {
        await db.update(news)
          .set({ 
            reactionCount: sql`GREATEST(0, ${news.reactionCount} - 1)`,
            updatedAt: new Date() 
          })
          .where(eq(news.id, reactionData.newsId));
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting reaction:", error);
      throw error;
    }
  }
  
  // Helper method to get aggregated reactions for a book
  async getAggregatedBookReactions(bookId: string, userId?: string): Promise<any[]> {
    try {
      const bookReactions = await this.getReactions(bookId, 'book');
      
      // Group reactions by emoji
      const reactionMap = new Map<string, { emoji: string; count: number; userReacted: boolean }>();
      
      for (const reaction of bookReactions) {
        const existing = reactionMap.get(reaction.emoji);
        if (existing) {
          existing.count++;
          if (userId && reaction.userId === userId) {
            existing.userReacted = true;
          }
        } else {
          reactionMap.set(reaction.emoji, {
            emoji: reaction.emoji,
            count: 1,
            userReacted: userId ? reaction.userId === userId : false
          });
        }
      }
      
      return Array.from(reactionMap.values());
    } catch (error) {
      console.error("Error getting aggregated book reactions:", error);
      return [];
    }
  }
  
  async createMessage(messageData: any): Promise<any> {
    try {
      console.log('🔴 [storage.createMessage] Input messageData:', JSON.stringify(messageData, null, 2));
      
      // Prepare the insert data
      const insertData: any = {
        senderId: messageData.senderId,
        recipientId: messageData.recipientId,
        conversationId: messageData.conversationId,
        channelId: messageData.channelId,
        content: messageData.content,
        readStatus: messageData.readStatus || false,
      };
      
      // Add attachment metadata if present (Drizzle requires explicit field assignment for JSONB)
      if (messageData.attachmentMetadata) {
        insertData.attachmentMetadata = messageData.attachmentMetadata;
      }
      
      // Add quote data if present
      if (messageData.quotedMessageId) {
        insertData.quotedMessageId = messageData.quotedMessageId;
      }
      if (messageData.quotedText) {
        insertData.quotedText = messageData.quotedText;
      }
      
      console.log('🔴 [storage.createMessage] Insert data prepared:', JSON.stringify(insertData, null, 2));
      
      // Insert the message
      const result: any = await db.insert(messages).values(insertData).returning();
      const insertedMessage = result[0];
      
      console.log('🔴 [storage.createMessage] Inserted message:', JSON.stringify(insertedMessage, null, 2));
      
      // Get the inserted message with sender and recipient information
      const fullMessage = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
        senderAvatarUrl: users.avatarUrl,
        senderRating: users.profileRating,
        attachmentMetadata: messages.attachmentMetadata,
        quotedMessageId: messages.quotedMessageId,
        quotedText: messages.quotedText,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.id, insertedMessage.id));
      
      console.log('🔴 [storage.createMessage] Full message query result:', JSON.stringify(fullMessage, null, 2));
      
      // Get quoted sender name if quotedMessageId exists
      let quotedSenderName = null;
      let quotedMessageContent = null;
      if (fullMessage[0].quotedMessageId) {
        const quotedMsg = await db.select({
          senderId: messages.senderId,
          senderUsername: users.username,
          senderFullName: users.fullName,
          content: messages.content,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.id, fullMessage[0].quotedMessageId));
        
        if (quotedMsg.length > 0) {
          quotedSenderName = quotedMsg[0].senderFullName || quotedMsg[0].senderUsername;
          quotedMessageContent = quotedMsg[0].content;
        }
      }
      
      // Format with attachments
      const msg = fullMessage[0];
      const metadata = msg.attachmentMetadata as any;
      const finalMessage = {
        ...msg,
        attachments: metadata?.attachments || [],
        quotedSenderName,
        quotedMessageContent
      };
      
      // Update the conversation's lastMessageId to reflect this new message
      if (messageData.conversationId) {
        try {
          await db.update(conversations)
            .set({ lastMessageId: insertedMessage.id, updatedAt: new Date() })
            .where(eq(conversations.id, messageData.conversationId));
          console.log('🔴 [storage.createMessage] Updated conversation lastMessageId:', messageData.conversationId, '->', insertedMessage.id);
        } catch (updateError) {
          console.error('🔴 [storage.createMessage] Error updating conversation lastMessageId:', updateError);
        }
      }
      
      console.log('🔴 [storage.createMessage] Returning final message:', JSON.stringify(finalMessage, null, 2));
      
      return finalMessage;
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }
  
  async getMessagesBetweenUsers(senderId: string, recipientId: string): Promise<any[]> {
    try {
      // Get messages between these two users (both directions)
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        sql`${messages.senderId} IN (${senderId}, ${recipientId}) AND ${messages.recipientId} IN (${senderId}, ${recipientId})`
      )
      .orderBy(messages.createdAt);
      
      // Format the messages
      return result.map(message => ({
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        readStatus: message.readStatus,
        sender: message.senderFullName || message.senderUsername || 'Anonymous'
      }));
    } catch (error) {
      console.error("Error getting messages between users:", error);
      return [];
    }
  }
  
  async getConversationsForUser(userId: string): Promise<any[]> {
    try {
      // Get all conversations where the user is either user1 or user2
      const result = await db.select({
        id: conversations.id,
        user1Id: conversations.user1Id,
        user2Id: conversations.user2Id,
        lastMessageId: conversations.lastMessageId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        // Get information about the other user in the conversation
        otherUserId: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN ${conversations.user2Id} ELSE ${conversations.user1Id} END`,
        otherUsername: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN user2.username ELSE user1.username END`,
        otherFullName: sql<string>`CASE WHEN ${conversations.user1Id} = ${userId} THEN user2.full_name ELSE user1.full_name END`,
        // Get the last message content and time
        lastMessageContent: messages.content,
        lastMessageCreatedAt: messages.createdAt,
        lastMessageSenderId: messages.senderId,
      })
      .from(conversations)
      .leftJoin(users as any, sql`${(users as any).id} IN (${conversations.user1Id}, ${conversations.user2Id})`)
      .leftJoin(users as any, eq((users as any).id, conversations.user1Id))
      .leftJoin(users as any, eq((users as any).id, conversations.user2Id))
      .leftJoin(messages, eq(messages.id, conversations.lastMessageId))
      .where(
        sql`${conversations.user1Id} = ${userId} OR ${conversations.user2Id} = ${userId}`
      )
      .orderBy(sql`${conversations.updatedAt} DESC`);
      
      // Simplified approach to get conversations
      // First get all messages where user is sender or recipient
      const allMessages = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        readStatus: messages.readStatus,
      })
      .from(messages)
      .where(
        sql`${messages.senderId} = ${userId} OR ${messages.recipientId} = ${userId}`
      )
      .orderBy(desc(messages.createdAt));
      
      // Group messages by the other participant
      const conversationsMap: { [key: string]: any } = {};
      
      for (const msg of allMessages) {
        const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
        
        // Skip if otherUserId is null
        if (!otherUserId) continue;
        
        if (!conversationsMap[otherUserId]) {
          // Get the other user's information
          const otherUser = await db.select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          }).from(users).where(eq(users.id, otherUserId));
          
          conversationsMap[otherUserId] = {
            userId: otherUser[0].id,
            username: otherUser[0].username,
            fullName: otherUser[0].fullName,
            avatarUrl: otherUser[0].avatarUrl,
            lastMessage: {
              id: msg.id,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
              isOwnMessage: msg.senderId === userId,
            },
            unreadCount: 0, // We'll calculate this separately
          };
        }
      }
      
      // Calculate unread counts for each conversation
      for (const otherUserId in conversationsMap) {
        const unreadCount = await db.execute(sql`SELECT COUNT(*) as count FROM messages WHERE sender_id != ${userId} AND recipient_id = ${userId} AND read_status = false`);
        conversationsMap[otherUserId].unreadCount = parseInt(unreadCount.rows[0].count as string);
      }
      
      return Object.values(conversationsMap);
    } catch (error) {
      console.error("Error getting conversations for user:", error);
      return [];
    }
  }
  
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await db.update(messages)
        .set({ readStatus: true, updatedAt: new Date() })
        .where(eq(messages.id, messageId));
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }
  
  async getUnreadMessagesCount(userId: string): Promise<number> {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM messages WHERE recipient_id = ${userId} AND read_status = false`);
      return parseInt(result.rows[0].count as string);
    } catch (error) {
      console.error("Error getting unread messages count:", error);
      return 0;
    }
  }
  
  async deleteMessage(id: string, userId: string | null): Promise<boolean> {
    try {
      console.log(`[deleteMessage] Starting deletion for message ${id} by user ${userId}`);
      
      // Get the message to check if it exists and get attachments
      const message = await db.select().from(messages).where(eq(messages.id, id));
      if (!message.length) {
        console.log(`[deleteMessage] Message not found: ${id}`);
        return false; // Message not found
      }
      
      console.log(`[deleteMessage] Found message: ${JSON.stringify(message[0])}`);
      console.log(`[deleteMessage] Attempting to delete message ${id} by user ${userId}`);
      
      // If userId is provided, verify it's the sender (for regular users)
      // If userId is null, allow deletion (for admin/moderators)
      if (userId !== null && message[0].senderId !== userId) {
        console.log(`[deleteMessage] Permission denied: user ${userId} is not sender ${message[0].senderId}`);
        return false; // Not the sender and not an admin action
      }
      
      try {
        // Remove references from conversations table (lastMessageId)
        console.log(`[deleteMessage] Removing references from conversations table`);
        await db.update(conversations)
          .set({ lastMessageId: null })
          .where(eq(conversations.lastMessageId, id));
        console.log(`[deleteMessage] Cleared conversation references`);
      } catch (error) {
        console.error(`[deleteMessage] Error clearing conversation references:`, error);
        // Continue anyway
      }
      
      try {
        // Delete associated message reactions first
        console.log(`[deleteMessage] Deleting reactions for message ${id}`);
        const deletedReactions = await db.delete(messageReactions).where(eq(messageReactions.messageId, id));
        console.log(`[deleteMessage] Deleted reactions result:`, deletedReactions);
      } catch (error) {
        console.error(`[deleteMessage] Error deleting reactions:`, error);
        // Continue anyway - maybe there were no reactions
      }
      
      try {
        // Soft delete associated file uploads
        const metadata = message[0].attachmentMetadata as any;
        if (metadata?.attachments && Array.isArray(metadata.attachments)) {
          console.log(`[deleteMessage] Found ${metadata.attachments.length} attachments to soft delete`);
          for (const attachment of metadata.attachments) {
            try {
              // Find file upload by URL
              const fileUpload = await db.select().from(fileUploads)
                .where(eq(fileUploads.fileUrl, attachment.url));
              
              if (fileUpload.length > 0 && !fileUpload[0].deletedAt) {
                console.log(`[deleteMessage] Soft deleting file upload: ${fileUpload[0].id}`);
                await db.update(fileUploads)
                  .set({ deletedAt: new Date() })
                  .where(eq(fileUploads.id, fileUpload[0].id));
              }
            } catch (error) {
              console.error(`[deleteMessage] Error soft deleting attachment ${attachment.url}:`, error);
              // Continue with other attachments
            }
          }
        } else {
          console.log(`[deleteMessage] No attachments found in metadata`);
        }
      } catch (error) {
        console.error(`[deleteMessage] Error processing attachments:`, error);
        // Continue anyway
      }
      
      // Delete the message
      console.log(`[deleteMessage] Deleting message ${id}`);
      const deleteResult = await db.delete(messages).where(eq(messages.id, id));
      console.log(`[deleteMessage] Delete result:`, deleteResult);
      console.log(`[deleteMessage] Successfully deleted message ${id}`);
      return true;
    } catch (error) {
      console.error(`[deleteMessage] Error deleting message ${id}:`, error);
      console.error(`[deleteMessage] Error stack:`, (error as Error).stack);
      throw error;
    }
  }
  
  async incrementBookViewCount(bookId: string, viewType: string): Promise<any> {
    try {
      // First check if a record already exists for this bookId and viewType
      const existingRecord = await db.select().from(bookViewStatistics)
        .where(
          and(
            eq(bookViewStatistics.bookId, bookId),
            eq(bookViewStatistics.viewType, viewType)
          )
        )
        .limit(1);
      
      if (existingRecord.length > 0) {
        // If record exists, update it
        const result = await db.update(bookViewStatistics)
          .set({
            viewCount: sql`${bookViewStatistics.viewCount} + 1`,
            lastViewedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(bookViewStatistics.bookId, bookId),
              eq(bookViewStatistics.viewType, viewType)
            )
          )
          .returning();
        
        return result[0];
      } else {
        // If record doesn't exist, insert a new one
        const result = await db.insert(bookViewStatistics)
          .values({ 
            bookId, 
            viewType, 
            viewCount: 1,
            lastViewedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return result[0];
      }
    } catch (error) {
      console.error("Error incrementing book view count:", error);
      throw error;
    }
  }
  
  async getBookViewStats(bookId: string): Promise<any> {
    try {
      const results = await db.select().from(bookViewStatistics).where(eq(bookViewStatistics.bookId, bookId));
      
      // Organize the stats by view type
      const stats: any = {};
      results.forEach(row => {
        stats[row.viewType] = row.viewCount;
      });
      
      return stats;
    } catch (error) {
      console.error("Error getting book view stats:", error);
      return {};
    }
  }
  
  async getNewsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM news WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting news count since date:", error);
      return 0;
    }
  }
  
  async getCommentsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting comments count since date:", error);
      return 0;
    }
  }
  
  async getReviewsCountSince(date: Date): Promise<number> {
    try {
      // Ensure we're using UTC timestamp for comparison
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE created_at >= ${date.toISOString()}`);
      return parseInt(result.rows[0].count as string) || 0;
    } catch (error) {
      console.error("Error getting reviews count since date:", error);
      return 0;
    }
  }
  
  async createNews(newsData: any): Promise<any> {
    try {
      // Insert the news item
      const result = await db.insert(news).values(newsData).returning();
      
      // Get the news with author information
      const newsWithAuthor = await db.select({
        id: news.id,
        title: news.title,
        content: news.content,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        imageUrls: news.imageUrls,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(eq(news.id, result[0].id));
      
      const newsItem = newsWithAuthor[0];
      return {
        id: newsItem.id,
        title: newsItem.title,
        content: newsItem.content,
        authorId: newsItem.authorId,
        published: newsItem.published,
        publishedAt: newsItem.publishedAt?.toISOString() || null,
        imageUrls: newsItem.imageUrls,
        createdAt: newsItem.createdAt.toISOString(),
        updatedAt: newsItem.updatedAt.toISOString(),
        author: newsItem.fullName || newsItem.username || 'Anonymous'
      };
    } catch (error) {
      console.error("Error creating news:", error);
      throw error;
    }
  }
  
  async getNews(id: string): Promise<any | undefined> {
    try {
      // Get news with author information
      // Support both ID and slug lookup
      const result = await db.select({
        id: news.id,
        title: news.title,
        titleEn: news.titleEn,
        content: news.content,
        contentEn: news.contentEn,
        slug: news.slug,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        viewCount: news.viewCount,
        commentCount: news.commentCount,
        reactionCount: news.reactionCount,
        imageUrls: news.imageUrls,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(or(eq(news.id, id), eq(news.slug, id)));
      
      if (result.length === 0) {
        return undefined;
      }
      
      const newsItem = result[0];
      return {
        id: newsItem.id,
        title: newsItem.title,
        titleEn: newsItem.titleEn,
        content: newsItem.content,
        contentEn: newsItem.contentEn,
        slug: newsItem.slug,
        authorId: newsItem.authorId,
        published: newsItem.published,
        publishedAt: newsItem.publishedAt?.toISOString() || null,
        viewCount: newsItem.viewCount,
        commentCount: newsItem.commentCount,
        reactionCount: newsItem.reactionCount,
        imageUrls: newsItem.imageUrls,
        createdAt: newsItem.createdAt.toISOString(),
        updatedAt: newsItem.updatedAt.toISOString(),
        author: newsItem.fullName || newsItem.username || 'Anonymous',
        avatarUrl: newsItem.avatarUrl || null
      };
    } catch (error) {
      console.error("Error getting news:", error);
      return undefined;
    }
  }
  
  async incrementNewsViewCount(newsId: string): Promise<void> {
    try {
      // Support both slug and UUID
      await db.update(news)
        .set({ viewCount: sql`${news.viewCount} + 1`, updatedAt: new Date() })
        .where(or(eq(news.id, newsId), eq(news.slug, newsId)));
    } catch (error) {
      console.error("Error incrementing news view count:", error);
      throw error;
    }
  }
  
  async createNewsComment(commentData: any): Promise<any> {
    try {
      // First, resolve newsId (could be slug or UUID) to actual UUID
      const newsItem = await this.getNews(commentData.newsId);
      if (!newsItem) {
        throw new Error('News item not found');
      }
      
      const result = await db.insert(comments).values({
        userId: commentData.userId,
        newsId: newsItem.id, // Use resolved UUID
        content: commentData.content,
        attachmentMetadata: commentData.attachmentMetadata || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Link file uploads to the comment if provided
      if (commentData.attachments && commentData.attachments.length > 0) {
        for (const uploadId of commentData.attachments) {
          await this.updateFileUploadEntity(uploadId, 'comment', result[0].id);
        }
      }
      
      // Get the comment with user information and attachments
      const commentWithUser = await db.select({
        id: comments.id,
        userId: comments.userId,
        newsId: comments.newsId,
        content: comments.content,
        attachmentUrls: comments.attachmentUrls,
        attachmentMetadata: comments.attachmentMetadata,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, result[0].id));
      
      // Get file uploads associated with this comment
      const commentAttachments = await db
        .select({
          id: fileUploads.id,
          fileUrl: fileUploads.fileUrl,
          filename: fileUploads.filename,
          fileSize: fileUploads.fileSize,
          mimeType: fileUploads.mimeType,
          thumbnailUrl: fileUploads.thumbnailUrl
        })
        .from(fileUploads)
        .where(
          and(
            eq(fileUploads.entityId, result[0].id),
            eq(fileUploads.entityType, 'comment')
          )
        );
      
      // Increment comment count in news
      await db.update(news)
        .set({ commentCount: sql`${news.commentCount} + 1`, updatedAt: new Date() })
        .where(eq(news.id, newsItem.id)); // Use resolved UUID
      
      // Return formatted comment with attachments
      const comment = commentWithUser[0];
      return {
        id: comment.id,
        userId: comment.userId,
        newsId: comment.newsId,
        content: comment.content,
        attachmentUrls: comment.attachmentUrls,
        attachmentMetadata: comment.attachmentMetadata,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        author: comment.fullName || comment.username || 'Anonymous',
        username: comment.username,
        avatarUrl: comment.avatarUrl || null,
        attachments: commentAttachments.map(att => ({
          uploadId: att.id,
          url: att.fileUrl,
          filename: att.filename,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          thumbnailUrl: att.thumbnailUrl
        }))
      };
    } catch (error) {
      console.error("Error creating news comment:", error);
      throw error;
    }
  }
  
  async getNewsComments(newsId: string, userId?: string): Promise<any[]> {
    try {
      // First, resolve newsId (could be slug or UUID) to actual UUID
      const newsItem = await this.getNews(newsId);
      if (!newsItem) {
        return [];
      }
      
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        newsId: comments.newsId,
        content: comments.content,
        attachmentUrls: comments.attachmentUrls,
        attachmentMetadata: comments.attachmentMetadata,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.newsId, newsItem.id)) // Use resolved UUID
      .orderBy(desc(comments.createdAt));
      
      // For each comment, get its reactions and attachments
      const commentsWithReactions = await Promise.all(result.map(async item => {
        // Get reactions for this comment
        const commentReactions = await this.getReactions(item.id, 'comment');
        
        // Group and aggregate reactions by emoji
        const reactionsMap: Record<string, any[]> = {};
        
        // Group reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        commentReactions.forEach((reaction: any) => {
          const key = reaction.emoji;
          if (!groupedReactions[key]) {
            groupedReactions[key] = [];
          }
          groupedReactions[key].push(reaction);
        });
        
        // Create aggregated reactions array
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          // Check if the current user has reacted with this emoji
          const userReacted = userId ? reactionList.some((reaction: any) => reaction.userId === userId) : false;
          
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted
          });
        });
        
        // Get file uploads associated with this comment
        const commentAttachments = await db
          .select({
            id: fileUploads.id,
            fileUrl: fileUploads.fileUrl,
            filename: fileUploads.filename,
            fileSize: fileUploads.fileSize,
            mimeType: fileUploads.mimeType,
            thumbnailUrl: fileUploads.thumbnailUrl
          })
          .from(fileUploads)
          .where(
            and(
              eq(fileUploads.entityId, item.id),
              eq(fileUploads.entityType, 'comment')
            )
          );
        
        return {
          id: item.id,
          userId: item.userId,
          newsId: item.newsId,
          content: item.content,
          attachmentUrls: item.attachmentUrls,
          attachmentMetadata: item.attachmentMetadata,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          author: item.fullName || item.username || 'Anonymous',
          avatarUrl: item.avatarUrl || null,
          reactions: aggregatedReactions,
          attachments: commentAttachments.map(att => ({
            uploadId: att.id,
            url: att.fileUrl,
            filename: att.filename,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            thumbnailUrl: att.thumbnailUrl
          }))
        };
      }));
      
      return commentsWithReactions;
    } catch (error) {
      console.error("Error getting news comments:", error);
      return [];
    }
  }
  
  async createNewsReaction(reactionData: any): Promise<any> {
    try {
      // First, resolve newsId (could be slug or UUID) to actual UUID
      const newsItem = await this.getNews(reactionData.newsId);
      if (!newsItem) {
        throw new Error('News item not found');
      }
      
      // Check if user already reacted to this news with the same emoji
      const existingReaction = await db.select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, reactionData.userId),
            eq(reactions.newsId, newsItem.id), // Use resolved UUID
            eq(reactions.emoji, reactionData.emoji)
          )
        );
      
      if (existingReaction.length > 0) {
        // User already reacted with this emoji, remove it
        await db.delete(reactions)
          .where(eq(reactions.id, existingReaction[0].id));
        
        // Decrement reaction count in news
        await db.update(news)
          .set({ reactionCount: sql`${news.reactionCount} - 1`, updatedAt: new Date() })
          .where(eq(news.id, newsItem.id)); // Use resolved UUID
        
        return { success: true, action: 'removed', removed: true };
      } else {
        // Create new reaction
        const result = await db.insert(reactions).values({
          userId: reactionData.userId,
          newsId: newsItem.id, // Use resolved UUID
          emoji: reactionData.emoji,
          createdAt: new Date()
        }).returning();
        
        // Increment reaction count in news
        await db.update(news)
          .set({ reactionCount: sql`${news.reactionCount} + 1`, updatedAt: new Date() })
          .where(eq(news.id, newsItem.id)); // Use resolved UUID
        
        return { ...result[0], action: 'added' };
      }
    } catch (error) {
      console.error("Error creating news reaction:", error);
      throw error;
    }
  }
  
  async getNewsReactions(newsId: string): Promise<any[]> {
    try {
      // First, resolve newsId (could be slug or UUID) to actual UUID
      const newsItem = await this.getNews(newsId);
      if (!newsItem) {
        return [];
      }
      
      // Get all reactions for this news grouped by emoji
      const allReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
        createdAt: reactions.createdAt
      })
      .from(reactions)
      .where(eq(reactions.newsId, newsItem.id)); // Use resolved UUID
      
      // Group reactions by emoji and count them
      const reactionsMap: { [key: string]: any[] } = {};
      allReactions.forEach(reaction => {
        if (!reactionsMap[reaction.emoji]) {
          reactionsMap[reaction.emoji] = [];
        }
        reactionsMap[reaction.emoji].push(reaction);
      });
      
      // Format the result
      return Object.entries(reactionsMap).map(([emoji, reactionList]) => ({
        emoji,
        count: reactionList.length
      }));
    } catch (error) {
      console.error("Error getting news reactions:", error);
      return [];
    }
  }
  
  async getReactionsForNews(newsId: string): Promise<any[]> {
    try {
      // First, resolve newsId (could be slug or UUID) to actual UUID
      const newsItem = await this.getNews(newsId);
      if (!newsItem) {
        return [];
      }
      
      // Get all reactions for this news article with user information
      const result = await db.select({
        id: reactions.id,
        userId: reactions.userId,
        newsId: reactions.newsId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt,
        username: users.username,
        fullName: users.fullName
      })
      .from(reactions)
      .leftJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.newsId, newsItem.id)); // Use resolved UUID
      
      // Format the response
      return result.map(reaction => ({
        id: reaction.id,
        userId: reaction.userId,
        newsId: reaction.newsId,
        emoji: reaction.emoji,
        createdAt: reaction.createdAt.toISOString(),
        userFullName: reaction.fullName,
        userUsername: reaction.username
      }));
    } catch (error) {
      console.error("Error getting reactions for news:", error);
      return [];
    }
  }
  
  async getPublishedNews(): Promise<any[]> {
    try {
      // Get published news ordered by creation date (newest first)
      const result = await db.select({
        id: news.id,
        title: news.title,
        titleEn: news.titleEn,
        content: news.content,
        contentEn: news.contentEn,
        slug: news.slug,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        viewCount: news.viewCount,
        commentCount: news.commentCount,
        reactionCount: news.reactionCount,
        imageUrls: news.imageUrls,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(eq(news.published, true))
      .orderBy(desc(news.createdAt));
      
      // Format the response
      return result.map(item => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        content: item.content,
        contentEn: item.contentEn,
        slug: item.slug,
        authorId: item.authorId,
        published: item.published,
        publishedAt: item.publishedAt?.toISOString() || null,
        viewCount: item.viewCount,
        commentCount: item.commentCount,
        reactionCount: item.reactionCount,
        imageUrls: item.imageUrls,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: item.fullName || item.username || 'Anonymous',
        avatarUrl: item.avatarUrl || null
      }));
    } catch (error) {
      console.error("Error getting published news:", error);
      return [];
    }
  }
  
  async getAllNews(): Promise<any[]> {
    try {
      // Get all news ordered by creation date (newest first)
      const result = await db.select({
        id: news.id,
        title: news.title,
        titleEn: news.titleEn,
        content: news.content,
        contentEn: news.contentEn,
        slug: news.slug,
        authorId: news.authorId,
        published: news.published,
        publishedAt: news.publishedAt,
        viewCount: news.viewCount,
        commentCount: news.commentCount,
        reactionCount: news.reactionCount,
        imageUrls: news.imageUrls,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .orderBy(desc(news.createdAt));
        
      // Format the response
      return result.map(item => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        content: item.content,
        contentEn: item.contentEn,
        slug: item.slug,
        authorId: item.authorId,
        published: item.published,
        publishedAt: item.publishedAt?.toISOString() || null,
        viewCount: item.viewCount,
        commentCount: item.commentCount,
        reactionCount: item.reactionCount,
        imageUrls: item.imageUrls,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: item.fullName || item.username || 'Anonymous',
        avatarUrl: item.avatarUrl || null
      }));
    } catch (error) {
      console.error("Error getting all news:", error);
      return [];
    }
  }
  
  async updateNews(id: string, newsData: any): Promise<any> {
    try {
      const result = await db.update(news)
        .set({ ...newsData, updatedAt: new Date() })
        .where(eq(news.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating news:", error);
      throw error;
    }
  }
  
  async deleteNews(id: string): Promise<void> {
    try {
      // First, get all comments on this news item
      const newsComments = await db.select()
        .from(comments)
        .where(eq(comments.newsId, id));
      
      const commentIds = newsComments.map(c => c.id);
      
      // Delete reactions on those comments
      if (commentIds.length > 0) {
        await db.delete(reactions)
          .where(inArray(reactions.commentId, commentIds));
      }
      
      // Delete reactions on the news item itself
      await db.delete(reactions)
        .where(eq(reactions.newsId, id));
      
      // Delete comments on the news item
      await db.delete(comments)
        .where(eq(comments.newsId, id));
      
      // Finally, delete the news item
      await db.delete(news).where(eq(news.id, id));
    } catch (error) {
      console.error("Error deleting news:", error);
      throw error;
    }
  }
  
  async updateAccessLevel(userId: string, accessLevel: string, isBlocked?: boolean, blockReason?: string | null): Promise<User> {
    try {
      const updateData: any = { 
        accessLevel, 
        updatedAt: new Date() 
      };
      
      // Handle blocked status
      if (isBlocked !== undefined) {
        updateData.isBlocked = isBlocked;
        updateData.blockReason = isBlocked ? blockReason : null;
      }
      
      const result = await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
      
      if (result.length === 0) {
        throw new Error('User not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating access level:", error);
      throw error;
    }
  }
  
  async getUsersCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`COUNT(*)`.as('count') })
        .from(users)
        .execute();
        
      return parseInt(String(result[0]?.count) || '0');
    } catch (error) {
      console.error("Error getting users count:", error);
      return 0;
    }
  }

  async getUsersWithStats(limit: number, offset: number): Promise<any[]> {
    try {
      // Get users with basic information
      const usersResult = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        accessLevel: users.accessLevel,
        isBlocked: users.isBlocked,
        blockReason: users.blockReason,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        lastActivityAt: users.lastActivityAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
      
      // For each user, get their statistics
      const usersWithStats = await Promise.all(usersResult.map(async (user) => {
        // Count shelves for the user
        const shelvesResult = await db.execute(sql`SELECT COUNT(*) as count FROM shelves WHERE user_id = ${user.id}`);
        const shelvesCount = parseInt(shelvesResult.rows[0].count as string);
        
        // Count books on shelves for the user
        const booksOnShelvesResult = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM shelf_books 
          WHERE shelf_id IN (
            SELECT id FROM shelves WHERE user_id = ${user.id}
          )
        `);
        const booksOnShelvesCount = parseInt(booksOnShelvesResult.rows[0].count as string);
        
        // Count comments for the user
        const commentsResult = await db.execute(sql`SELECT COUNT(*) as count FROM comments WHERE user_id = ${user.id}`);
        const commentsCount = parseInt(commentsResult.rows[0].count as string);
        
        // Count reviews for the user
        const reviewsResult = await db.execute(sql`SELECT COUNT(*) as count FROM reviews WHERE user_id = ${user.id}`);
        const reviewsCount = parseInt(reviewsResult.rows[0].count as string);
        
        return {
          ...user,
          lastLogin: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          lastActivity: user.lastActivityAt ? user.lastActivityAt.toISOString() : null,
          shelvesCount,
          booksOnShelvesCount,
          commentsCount,
          reviewsCount,
        };
      }));
      
      return usersWithStats;
    } catch (error) {
      console.error("Error getting users with stats:", error);
      throw error;
    }
  }
  
  async getPublicUsers(
    page: number = 1,
    limit: number = 15,
    search?: string,
    sortBy: 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' | 'registered' = 'rating',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ users: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // Build WHERE clause for search
      const whereClause = search
        ? or(
            ilike(users.username, `%${search}%`),
            ilike(users.fullName, `%${search}%`)
          )
        : undefined;
      
      // For registered sorting, we need to use raw SQL to ensure correct ordering
      if (sortBy === 'registered') {
        const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const searchCondition = search 
          ? `WHERE (LOWER(u.username) LIKE LOWER('%${search}%') OR LOWER(u.full_name) LIKE LOWER('%${search}%'))`
          : '';
        
        const rawQuery = `
          SELECT 
            u.id,
            u.username,
            u.full_name as "fullName",
            u.avatar_url as avatar,
            u.profile_rating as "profileRating",
            u.created_at as "registeredAt",
            u.last_activity_at as "lastActivityAt",
            u.bio,
            u.is_blocked as "isBlocked",
            COALESCE(COUNT(DISTINCT s.id), 0)::int as "shelvesCount",
            COALESCE(COUNT(DISTINCT sb.id), 0)::int as "booksCount",
            COALESCE(COUNT(DISTINCT c.id), 0)::int as "commentsCount",
            COALESCE(COUNT(DISTINCT r.id), 0)::int as "reviewsCount"
          FROM users u
          LEFT JOIN shelves s ON s.user_id = u.id
          LEFT JOIN shelf_books sb ON sb.shelf_id = s.id
          LEFT JOIN comments c ON c.user_id = u.id
          LEFT JOIN reviews r ON r.user_id = u.id
          ${searchCondition}
          GROUP BY u.id, u.username, u.full_name, u.avatar_url, u.profile_rating, u.created_at, u.last_activity_at, u.bio, u.is_blocked
          ORDER BY u.created_at ${orderDirection}
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        console.log('REGISTERED SORT SQL:', rawQuery);
        console.log('Order direction:', orderDirection, 'sortOrder:', sortOrder);
        
        const finalResult = await db.execute(sql.raw(rawQuery));
        
        console.log('First 3 results:', finalResult.rows.slice(0, 3).map((r: any) => ({ username: r.username, registeredAt: r.registeredAt })));
        
        // Get total count
        const countQuery = search
          ? `SELECT COUNT(DISTINCT u.id)::int as count FROM users u WHERE (LOWER(u.username) LIKE LOWER('%${search}%') OR LOWER(u.full_name) LIKE LOWER('%${search}%'))`
          : `SELECT COUNT(DISTINCT id)::int as count FROM users`;
        
        const countResult = await db.execute(sql.raw(countQuery));
        const total = countResult.rows[0]?.count || 0;
        
        const formattedUsers = finalResult.rows.map((user: any) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          profileRating: user.profileRating,
          registeredAt: user.registeredAt,
          lastActivityAt: user.lastActivityAt,
          bio: user.bio,
          isBlocked: user.isBlocked,
          commentsCount: user.commentsCount,
          reviewsCount: user.reviewsCount,
          shelvesCount: user.shelvesCount,
          booksCount: user.booksCount,
        }));
        
        return { users: formattedUsers, total };
      }
      
      // For other sorting options, use the ORM
      let orderByClause;
      
      if (sortBy === 'shelves') {
        orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${shelves.id}) ASC` : sql`COUNT(DISTINCT ${shelves.id}) DESC`;
      } else if (sortBy === 'books') {
        orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${shelfBooks.id}) ASC` : sql`COUNT(DISTINCT ${shelfBooks.id}) DESC`;
      } else if (sortBy === 'comments') {
        orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${comments.id}) ASC` : sql`COUNT(DISTINCT ${comments.id}) DESC`;
      } else if (sortBy === 'reviews') {
        orderByClause = sortOrder === 'asc' ? sql`COUNT(DISTINCT ${reviews.id}) ASC` : sql`COUNT(DISTINCT ${reviews.id}) DESC`;
      } else if (sortBy === 'lastActivity') {
        orderByClause = sortOrder === 'asc' ? sql`${users.lastActivityAt} ASC NULLS LAST` : sql`${users.lastActivityAt} DESC NULLS LAST`;
      } else {
        // rating
        orderByClause = sortOrder === 'asc' ? sql`${users.profileRating} ASC NULLS LAST` : sql`${users.profileRating} DESC NULLS LAST`;
      }
      
      // Get users with aggregated statistics in a single query
      const finalResult = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatar: users.avatarUrl,
          profileRating: users.profileRating,
          registeredAt: users.createdAt,
          lastActivityAt: users.lastActivityAt,
          bio: users.bio,
          isBlocked: users.isBlocked,
          shelvesCount: sql<number>`COALESCE(COUNT(DISTINCT ${shelves.id}), 0)`.as('shelves_count'),
          booksCount: sql<number>`COALESCE(COUNT(DISTINCT ${shelfBooks.id}), 0)`.as('books_count'),
          commentsCount: sql<number>`COALESCE(COUNT(DISTINCT ${comments.id}), 0)`.as('comments_count'),
          reviewsCount: sql<number>`COALESCE(COUNT(DISTINCT ${reviews.id}), 0)`.as('reviews_count'),
        })
        .from(users)
        .leftJoin(shelves, eq(shelves.userId, users.id))
        .leftJoin(shelfBooks, eq(shelfBooks.shelfId, shelves.id))
        .leftJoin(comments, eq(comments.userId, users.id))
        .leftJoin(reviews, eq(reviews.userId, users.id))
        .where(whereClause)
        .groupBy(
          users.id,
          users.username,
          users.fullName,
          users.avatarUrl,
          users.profileRating,
          users.createdAt,
          users.lastActivityAt,
          users.bio,
          users.isBlocked
        )
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);
      
      // Get total count for pagination
      const countResult = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${users.id})`.as('count'),
        })
        .from(users)
        .where(whereClause);
      
      const total = Number(countResult[0]?.count || 0);
      
      // Format the response
      const formattedUsers = finalResult.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        profileRating: user.profileRating,
        registeredAt: user.registeredAt,
        lastActivityAt: user.lastActivityAt,
        bio: user.bio,
        isBlocked: user.isBlocked,
        commentsCount: Number(user.commentsCount),
        reviewsCount: Number(user.reviewsCount),
        shelvesCount: Number(user.shelvesCount),
        booksCount: Number(user.booksCount),
      }));
      
      return { users: formattedUsers, total };
    } catch (error) {
      console.error("Error getting public users:", error);
      throw error;
    }
  }

  async getRecentActivity(limit: number = 10): Promise<any[]> {
    try {
      // Get recent comments and reviews together, ordered by creation date
      const recentComments = await db.select({
        id: comments.id,
        type: sql`'comment'`.as('type'),
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userId: comments.userId,
        bookId: comments.bookId,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .orderBy(desc(comments.createdAt))
      .limit(limit);
      
      const recentReviews = await db.select({
        id: reviews.id,
        type: sql`'review'`.as('type'),
        content: reviews.content,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userId: reviews.userId,
        bookId: reviews.bookId,
        rating: reviews.rating,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
      
      // Combine and sort both arrays by creation date
      const allActivity = [
        ...recentComments.map(comment => ({
          id: comment.id,
          type: comment.type,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          userId: comment.userId,
          bookId: comment.bookId,
          author: comment.fullName || comment.username || 'Anonymous',
          avatarUrl: comment.avatarUrl || null,
          rating: null // Comments don't have ratings
        })),
        ...recentReviews.map(review => ({
          id: review.id,
          type: review.type,
          content: review.content,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
          userId: review.userId,
          bookId: review.bookId,
          author: review.fullName || review.username || 'Anonymous',
          avatarUrl: review.avatarUrl || null,
          rating: review.rating
        }))
      ];
      
      // Sort by creation date (newest first)
      allActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Return only the requested limit
      return allActivity.slice(0, limit);
    } catch (error) {
      console.error("Error getting recent activity:", error);
      return [];
    }
  }

  // Admin book operations






  // New messaging system methods
  async getConversation(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(conversations).where(eq(conversations.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting conversation:", error);
      return undefined;
    }
  }

  async findConversationBetweenUsers(userId1: string, userId2: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(conversations).where(
        or(
          and(eq(conversations.user1Id, userId1), eq(conversations.user2Id, userId2)),
          and(eq(conversations.user1Id, userId2), eq(conversations.user2Id, userId1))
        )
      );
      return result[0];
    } catch (error) {
      console.error("Error finding conversation between users:", error);
      return undefined;
    }
  }

  async createConversation(userId1: string, userId2: string): Promise<any> {
    try {
      const result = await db.insert(conversations).values({
        user1Id: userId1,
        user2Id: userId2,
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  async updateConversationLastMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      await db.update(conversations)
        .set({ lastMessageId: messageId, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } catch (error) {
      console.error("Error updating conversation last message:", error);
      throw error;
    }
  }

  async getConversationMessages(conversationId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        readStatus: messages.readStatus,
        senderUsername: users.username,
        senderFullName: users.fullName,
        senderAvatarUrl: users.avatarUrl,
        attachmentMetadata: messages.attachmentMetadata,
        quotedMessageId: messages.quotedMessageId,
        quotedText: messages.quotedText,
      })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Format messages with attachments and quoted sender names
      const formattedMessages = [];
      for (const msg of result) {
        const metadata = msg.attachmentMetadata as any;
        let quotedSenderName = null;
        let quotedMessageContent = null;
        
        // Get quoted sender name and content if quotedMessageId exists
        if (msg.quotedMessageId) {
          const quotedMsg = await db.select({
            senderUsername: users.username,
            senderFullName: users.fullName,
            content: messages.content,
          })
          .from(messages)
          .leftJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.id, msg.quotedMessageId));
          
          if (quotedMsg.length > 0) {
            quotedSenderName = quotedMsg[0].senderFullName || quotedMsg[0].senderUsername;
            quotedMessageContent = quotedMsg[0].content;
          }
        }
        
        formattedMessages.push({
          ...msg,
          attachments: metadata?.attachments || [],
          quotedSenderName,
          quotedMessageContent
        });
      }
      
      return formattedMessages;
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      return [];
    }
  }

  async markConversationMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await db.update(messages)
        .set({ readStatus: true })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.recipientId, userId),
            eq(messages.readStatus, false)
          )
        );
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.recipientId, userId),
            eq(messages.readStatus, false)
          )
        );
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting unread message count:", error);
      return 0;
    }
  }

  // Send unread count update via WebSocket
  async sendUnreadCountUpdate(userId: string, io: any): Promise<void> {
    try {
      const count = await this.getUnreadMessageCount(userId);
      
      // Emit to user's personal room
      const userRoom = `user:${userId}`;
      io.to(userRoom).emit('unread-count:update', { count });
      
      console.log(`[UNREAD COUNT] Sent update to user ${userId}: ${count} unread messages`);
    } catch (error) {
      console.error("Error sending unread count update:", error);
    }
  }

  async getMessage(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(messages).where(eq(messages.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting message:", error);
      return undefined;
    }
  }

  async getUserConversations(userId: string): Promise<any[]> {
    console.log('[getUserConversations] Called with userId:', userId);
    try {
      // Use sql.raw for the query with manual parameter binding
      const queryResult: any = await pool.query(
        `SELECT id, user1_id as "user1Id", user2_id as "user2Id", 
               last_message_id as "lastMessageId", created_at as "createdAt", 
               updated_at as "updatedAt"
        FROM conversations
        WHERE user1_id = $1 OR user2_id = $1
        ORDER BY updated_at DESC`,
        [userId]
      );
      
      const result = queryResult.rows as any[];

      console.log('[getUserConversations] Raw query result:', result.length, 'conversations');
      console.log('[getUserConversations] First conversation:', result[0]);

      // Fetch other user info, last message, and unread count for each conversation
      const conversationsWithDetails = await Promise.all(
        result.map(async (conv) => {
          const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
          console.log('[getUserConversations] Fetching other user:', otherUserId);
          const otherUser = await this.getUser(otherUserId);
          console.log('[getUserConversations] Other user found:', otherUser?.username);
          
          let lastMessage = null;
          if (conv.lastMessageId) {
            lastMessage = await this.getMessage(conv.lastMessageId);
          }

          // Count unread messages where current user is recipient
          const unreadResult: any = await pool.query(
            `SELECT COUNT(*) as count 
             FROM messages 
             WHERE conversation_id = $1 
               AND recipient_id = $2 
               AND read_status = false 
               AND deleted_at IS NULL`,
            [conv.id, userId]
          );
          const unreadCount = parseInt(unreadResult.rows[0]?.count || '0');

          return {
            ...conv,
            otherUser: otherUser ? {
              id: otherUser.id,
              username: otherUser.username,
              fullName: otherUser.fullName,
              avatarUrl: otherUser.avatarUrl,
            } : null,
            lastMessage,
            unreadCount,
          };
        })
      );

      console.log('[getUserConversations] Returning', conversationsWithDetails.length, 'conversations with details');
      return conversationsWithDetails;
    } catch (error) {
      console.error("Error getting user conversations:", error);
      return [];
    }
  }

  async searchUsers(query: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(users)
        .where(
          or(
            ilike(users.username, `%${query}%`),
            ilike(users.fullName, `%${query}%`)
          )
        )
        .limit(20);
      return result;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }

  // Group operations
  async createGroup(groupData: any): Promise<any> {
    try {
      const result = await db.insert(groups).values(groupData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }

  async getGroup(id: string): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(groups)
        .where(
          and(
            eq(groups.id, id),
            isNull(groups.deletedAt)
          )
        );
      return result[0];
    } catch (error) {
      console.error("Error getting group:", error);
      return undefined;
    }
  }

  async getUserGroups(userId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        privacy: groups.privacy,
        creatorId: groups.creatorId,
        createdAt: groups.createdAt,
        role: groupMembers.role,
      })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            eq(groupMembers.userId, userId),
            isNull(groups.deletedAt)
          )
        );
      
      // Add member count and unread count for each group
      const groupsWithCount = await Promise.all(
        result.map(async (group) => {
          const memberCountResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM group_members WHERE group_id = ${group.id}`
          );
          const memberCount = parseInt((memberCountResult.rows[0] as any).count) || 0;
          
          // Count unread messages in all channels of this group
          // Using the new read position tracking system
          const unreadCountResult = await db.execute(
            sql`SELECT COUNT(DISTINCT m.id) as count
                FROM messages m
                INNER JOIN channels c ON m.channel_id = c.id
                LEFT JOIN user_channel_read_positions rp ON rp.channel_id = c.id AND rp.user_id = ${userId}
                WHERE c.group_id = ${group.id}
                  AND m.sender_id != ${userId}
                  AND m.deleted_at IS NULL
                  AND m.created_at > COALESCE(rp.last_read_at, ${group.createdAt})`
          );
          const unreadCount = parseInt((unreadCountResult.rows[0] as any).count) || 0;
          
          return { ...group, memberCount, unreadCount };
        })
      );
      
      return groupsWithCount;
    } catch (error) {
      console.error("Error getting user groups:", error);
      return [];
    }
  }

  async searchGroups(query: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(groups)
        .where(
          and(
            eq(groups.privacy, 'public'),
            isNull(groups.deletedAt),
            or(
              ilike(groups.name, `%${query}%`),
              ilike(groups.description, `%${query}%`)
            )
          )
        )
        .limit(20);
      return result;
    } catch (error) {
      console.error("Error searching groups:", error);
      return [];
    }
  }

  async updateGroup(id: string, groupData: any): Promise<any> {
    try {
      const result = await db.update(groups)
        .set({ ...groupData, updatedAt: new Date() })
        .where(eq(groups.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating group:", error);
      throw error;
    }
  }

  async deleteGroup(id: string): Promise<void> {
    try {
      await db.update(groups)
        .set({ deletedAt: new Date() })
        .where(eq(groups.id, id));
    } catch (error) {
      console.error("Error deleting group:", error);
      throw error;
    }
  }

  // Group membership operations
  async addGroupMember(groupId: string, userId: string, role: string, invitedBy: string | null): Promise<void> {
    try {
      await db.insert(groupMembers).values({
        groupId,
        userId,
        role,
        invitedBy
      });
    } catch (error) {
      console.error("Error adding group member:", error);
      throw error;
    }
  }

  async removeGroupMember(groupId: string, membershipId: string): Promise<void> {
    try {
      await db.delete(groupMembers)
        .where(eq(groupMembers.id, membershipId));
    } catch (error) {
      console.error("Error removing group member:", error);
      throw error;
    }
  }

  async updateGroupMemberRole(groupId: string, userId: string, role: string): Promise<any | null> {
    try {
      // Update the role
      await db.update(groupMembers)
        .set({ role })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      // Fetch and return the updated member with user info
      const result = await db.select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(groupMembers)
        .leftJoin(users, eq(groupMembers.userId, users.id))
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      return result[0] || null;
    } catch (error) {
      console.error("Error updating group member role:", error);
      throw error;
    }
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
        .from(groupMembers)
        .leftJoin(users, eq(groupMembers.userId, users.id))
        .where(eq(groupMembers.groupId, groupId));
      return result;
    } catch (error) {
      console.error("Error getting group members:", error);
      return [];
    }
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
      const result = await db.select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      return result.length > 0;
    } catch (error) {
      console.error("Error checking group membership:", error);
      return false;
    }
  }

  async getGroupMemberRole(groupId: string, userId: string): Promise<string | null> {
    try {
      const result = await db.select({ role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      return result[0]?.role || null;
    } catch (error) {
      console.error("Error getting group member role:", error);
      return null;
    }
  }

  // Channel operations
  async createChannel(channelData: any): Promise<any> {
    try {
      const result = await db.insert(channels).values(channelData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  }

  async getChannel(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(channels).where(eq(channels.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting channel:", error);
      return undefined;
    }
  }

  async getGroupChannels(groupId: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(channels)
        .where(
          and(
            eq(channels.groupId, groupId),
            isNull(channels.archivedAt)
          )
        )
        .orderBy(asc(channels.displayOrder));
      return result;
    } catch (error) {
      console.error("Error getting group channels:", error);
      return [];
    }
  }

  async updateChannel(id: string, channelData: any): Promise<any> {
    try {
      const result = await db.update(channels)
        .set(channelData)
        .where(eq(channels.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  }

  async deleteChannel(id: string): Promise<void> {
    try {
      await db.update(channels)
        .set({ archivedAt: new Date() })
        .where(eq(channels.id, id));
    } catch (error) {
      console.error("Error deleting channel:", error);
      throw error;
    }
  }

  async getChannelMessages(channelId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        content: messages.content,
        createdAt: messages.createdAt,
        parentMessageId: messages.parentMessageId,
        senderUsername: users.username,
        senderFullName: users.fullName,
        senderAvatarUrl: users.avatarUrl,
        attachmentMetadata: messages.attachmentMetadata,
        quotedMessageId: messages.quotedMessageId,
        quotedText: messages.quotedText,
      })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(
          and(
            eq(messages.channelId, channelId),
            isNull(messages.deletedAt)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Format messages with attachments and quoted sender names
      const formattedMessages = [];
      for (const msg of result) {
        const metadata = msg.attachmentMetadata as any;
        let quotedSenderName = null;
        let quotedMessageContent = null;
        
        // Get quoted sender name and content if quotedMessageId exists
        if (msg.quotedMessageId) {
          const quotedMsg = await db.select({
            senderUsername: users.username,
            senderFullName: users.fullName,
            content: messages.content,
          })
          .from(messages)
          .leftJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.id, msg.quotedMessageId));
          
          if (quotedMsg.length > 0) {
            quotedSenderName = quotedMsg[0].senderFullName || quotedMsg[0].senderUsername;
            quotedMessageContent = quotedMsg[0].content;
          }
        }
        
        formattedMessages.push({
          ...msg,
          attachments: metadata?.attachments || [],
          quotedSenderName,
          quotedMessageContent
        });
      }
      
      return formattedMessages;
    } catch (error) {
      console.error("Error getting channel messages:", error);
      return [];
    }
  }

  // Group-book associations
  async addBookToGroup(groupId: string, bookId: string): Promise<void> {
    try {
      await db.insert(groupBooks).values({ groupId, bookId });
    } catch (error) {
      console.error("Error adding book to group:", error);
      throw error;
    }
  }

  async removeBookFromGroup(groupId: string, bookId: string): Promise<void> {
    try {
      await db.delete(groupBooks)
        .where(
          and(
            eq(groupBooks.groupId, groupId),
            eq(groupBooks.bookId, bookId)
          )
        );
    } catch (error) {
      console.error("Error removing book from group:", error);
      throw error;
    }
  }

  async getGroupBooks(groupId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: books.id,
        title: books.title,
        author: books.author,
        coverImageUrl: books.coverImageUrl,
      })
        .from(groupBooks)
        .innerJoin(books, eq(groupBooks.bookId, books.id))
        .where(eq(groupBooks.groupId, groupId));
      return result;
    } catch (error) {
      console.error("Error getting group books:", error);
      return [];
    }
  }

  // Alias methods for consistency
  async addGroupBook(groupId: string, bookId: string): Promise<void> {
    return this.addBookToGroup(groupId, bookId);
  }

  async removeAllGroupBooks(groupId: string): Promise<void> {
    try {
      await db.delete(groupBooks)
        .where(eq(groupBooks.groupId, groupId));
    } catch (error) {
      console.error("Error removing all group books:", error);
      throw error;
    }
  }

  // Message reaction operations
  async addMessageReaction(messageId: string, userId: string, emoji: string): Promise<any> {
    try {
      const result = await db.insert(messageReactions).values({
        messageId,
        userId,
        emoji
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding message reaction:", error);
      throw error;
    }
  }

  async removeMessageReaction(reactionId: string, userId: string): Promise<void> {
    try {
      await db.delete(messageReactions)
        .where(
          and(
            eq(messageReactions.id, reactionId),
            eq(messageReactions.userId, userId)
          )
        );
    } catch (error) {
      console.error("Error removing message reaction:", error);
      throw error;
    }
  }

  async getMessageReactions(messageId: string): Promise<any[]> {
    try {
      const result = await db.select({
        id: messageReactions.id,
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        createdAt: messageReactions.createdAt,
        username: users.username,
        fullName: users.fullName,
      })
        .from(messageReactions)
        .leftJoin(users, eq(messageReactions.userId, users.id))
        .where(eq(messageReactions.messageId, messageId));
      return result;
    } catch (error) {
      console.error("Error getting message reactions:", error);
      return [];
    }
  }

  // Notification operations
  async createNotification(notificationData: any): Promise<any> {
    try {
      const result = await db.insert(notifications).values(notificationData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number): Promise<any[]> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting user notifications:", error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await db.update(notifications)
        .set({ readStatus: true })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await db.update(notifications)
        .set({ readStatus: true })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.readStatus, false)
          )
        );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }
  
  // File upload operations
  async createFileUpload(fileData: any): Promise<any> {
    try {
      const result = await db.insert(fileUploads).values({
        uploaderId: fileData.uploaderId,
        fileUrl: fileData.fileUrl,
        filename: fileData.filename,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        storagePath: fileData.storagePath,
        entityType: fileData.entityType,
        entityId: fileData.entityId,
        thumbnailUrl: fileData.thumbnailUrl || null
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating file upload:", error);
      throw error;
    }
  }
  
  async getFileUpload(id: string): Promise<any | undefined> {
    try {
      const result = await db.select().from(fileUploads).where(eq(fileUploads.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting file upload:", error);
      return undefined;
    }
  }
  
  async updateFileUploadThumbnail(id: string, thumbnailUrl: string): Promise<void> {
    try {
      await db.update(fileUploads)
        .set({ thumbnailUrl })
        .where(eq(fileUploads.id, id));
    } catch (error) {
      console.error("Error updating file upload thumbnail:", error);
      throw error;
    }
  }
  
  async updateFileUploadEntity(id: string, entityType: string, entityId: string): Promise<void> {
    try {
      await db.update(fileUploads)
        .set({ entityType, entityId })
        .where(eq(fileUploads.id, id));
    } catch (error) {
      console.error("Error updating file upload entity:", error);
      throw error;
    }
  }
  
  async verifyFileAccess(uploadId: string, userId: string): Promise<boolean> {
    try {
      const fileUpload = await this.getFileUpload(uploadId);
      if (!fileUpload) return false;
      
      // Uploader always has access
      if (fileUpload.uploaderId === userId) return true;
      
      // If file is temporary (not attached yet), only uploader has access
      if (fileUpload.entityType === 'temp') return false;
      
      // Check access based on entity type
      if (fileUpload.entityType === 'message') {
        // Check if user is part of the conversation
        const message = await db.select().from(messages).where(eq(messages.id, fileUpload.entityId));
        if (message[0]) {
          // Check if it's a private message or group message
          if (message[0].conversationId) {
            const conversation = await db.select().from(conversations)
              .where(eq(conversations.id, message[0].conversationId));
            if (conversation[0]) {
              return conversation[0].user1Id === userId || conversation[0].user2Id === userId;
            }
          } else if (message[0].channelId) {
            // Group message - check if user is a member
            const channel = await db.select().from(channels)
              .where(eq(channels.id, message[0].channelId));
            if (channel[0]) {
              const membership = await db.select().from(groupMembers)
                .where(and(
                  eq(groupMembers.groupId, channel[0].groupId),
                  eq(groupMembers.userId, userId)
                ));
              return membership.length > 0;
            }
          }
        }
      } else if (fileUpload.entityType === 'comment' || fileUpload.entityType === 'review') {
        // Comments and reviews are public if the book is public
        // For now, allow access (can add more granular control later)
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error verifying file access:", error);
      return false;
    }
  }
  
  async softDeleteFileUpload(id: string, deleterId: string): Promise<void> {
    try {
      await db.update(fileUploads)
        .set({ deletedAt: new Date() })
        .where(eq(fileUploads.id, id));
    } catch (error) {
      console.error("Error soft deleting file upload:", error);
      throw error;
    }
  }
  

  
  async getUserShelvesWithBooks(userId: string): Promise<{shelves: any[], books: any[]}> {
    try {
      // Get user's shelves
      const userShelves = await db.select().from(shelves)
        .where(eq(shelves.userId, userId))
        .orderBy(desc(shelves.createdAt));
      
      // Get all books from these shelves
      const shelfIdsList = userShelves.map(s => s.id);
      let shelfBooksData: any[] = [];
      let booksData: any[] = [];
      
      if (shelfIdsList.length > 0) {
        shelfBooksData = await db.select().from(shelfBooks)
          .where(inArray(shelfBooks.shelfId, shelfIdsList));
        
        const bookIdsList = Array.from(new Set(shelfBooksData.map(sb => sb.bookId)));
        if (bookIdsList.length > 0) {
          booksData = await db.select().from(books)
            .where(inArray(books.id, bookIdsList));
        }
      }
      
      // Build shelf -> book mapping
      const shelfBookMap: {[key: string]: string[]} = {};
      shelfBooksData.forEach(sb => {
        if (!shelfBookMap[sb.shelfId]) {
          shelfBookMap[sb.shelfId] = [];
        }
        shelfBookMap[sb.shelfId].push(sb.bookId);
      });
      
      // Format shelves with book count
      const formattedShelves = userShelves.map(shelf => ({
        id: shelf.id,
        name: shelf.name,
        bookCount: shelfBookMap[shelf.id]?.length || 0
      }));
      
      // Format books with shelf associations
      const formattedBooks = booksData.map(book => {
        const associatedShelfIds = shelfBooksData
          .filter(sb => sb.bookId === book.id)
          .map(sb => sb.shelfId);
        
        return {
          id: book.id,
          title: book.title,
          shelfIds: associatedShelfIds
        };
      });
      
      return {
        shelves: formattedShelves,
        books: formattedBooks
      };
    } catch (error) {
      console.error("Error getting user shelves with books:", error);
      return { shelves: [], books: [] };
    }
  }
  

  
  // Activity feed methods
  async getGlobalActivities(limit: number = 50, offset: number = 0, before?: string): Promise<any[]> {
    try {
      // Query the activity_feed table directly and filter out soft-deleted records
      // Also filter out reply activities - only return root comments
      const queryBuilder = db.select({
        id: activityFeed.id,
        activityType: activityFeed.activityType,
        entityId: activityFeed.entityId,
        userId: activityFeed.userId,
        targetUserId: activityFeed.targetUserId,
        bookId: activityFeed.bookId,
        metadata: activityFeed.metadata,
        createdAt: activityFeed.createdAt,
        updatedAt: activityFeed.updatedAt,
        userUsername: users.username,
        userFullName: users.fullName,
        userAvatarUrl: users.avatarUrl
      })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .where(isNull(activityFeed.deletedAt)) // Filter out soft-deleted activities
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit * 2) // Get more to filter out replies
      .offset(offset);
      
      const allActivities = await queryBuilder;
      
      // Get all comment IDs to check if they have parents
      const commentIds = allActivities
        .filter((a: any) => a.activityType === 'comment')
        .map((a: any) => a.entityId);
      
      // Query comments table to find which ones have parents
      const parentCommentIds = new Set<string>();
      if (commentIds.length > 0) {
        const commentsWithParents = await db.select({ id: comments.id })
          .from(comments)
          .where(and(
            inArray(comments.id, commentIds),
            isNotNull(comments.parentCommentId)
          ));
        commentsWithParents.forEach((c: any) => parentCommentIds.add(c.id));
      }
      
      // Filter out reply activities - only show root comments in stream
      const activities = allActivities.filter((activity: any) => {
        if (activity.activityType === 'comment') {
          // Check if this comment has a parent (is a reply)
          if (parentCommentIds.has(activity.entityId)) {
            return false;
          }
        }
        return true;
      }).slice(0, limit);
      
      // Fetch reactions for comments and reviews
      const commentAndReviewIds = activities
        .filter(a => a.activityType === 'comment' || a.activityType === 'review')
        .map(a => ({ id: a.entityId, type: a.activityType }));
      
      const reactionsMap: Record<string, any[]> = {};
      
      for (const item of commentAndReviewIds) {
        try {
          const entityType = item.type === 'comment' ? 'comment' : 'review';
          const rawReactions = await this.getReactions(item.id, entityType);
          
          // Group and aggregate reactions by emoji
          const groupedReactions: Record<string, any[]> = {};
          rawReactions.forEach((reaction: any) => {
            const emoji = reaction.emoji;
            if (!groupedReactions[emoji]) {
              groupedReactions[emoji] = [];
            }
            groupedReactions[emoji].push(reaction);
          });
          
          // Create aggregated reactions array
          const aggregatedReactions: any[] = [];
          Object.entries(groupedReactions).forEach(([emoji, reactionList]: [string, any[]]) => {
            aggregatedReactions.push({
              emoji,
              count: reactionList.length,
              userReacted: false
            });
          });
          
          reactionsMap[item.id] = aggregatedReactions;
        } catch (error) {
          console.error("Error fetching reactions for", item.type, item.id, error);
          reactionsMap[item.id] = [];
        }
      }
      
      // Format the results to match expected structure
      const activitiesWithReplies = await Promise.all(activities.map(async (activity) => {
        // Get reactions for this activity if it's a comment or review
        const activityReactions = (activity.activityType === 'comment' || activity.activityType === 'review')
          ? reactionsMap[activity.entityId] || []
          : [];
        
        // For comments, fetch replies if this is a root comment (no parentCommentId in metadata)
        let replies: any[] = [];
        let replyCount = 0;
        const activityMetadata = (activity.metadata as Record<string, any>) || {};
        const parentCommentId: string | null = activityMetadata.parentCommentId || null;
        
        if (activity.activityType === 'comment' && !parentCommentId) {
          // Don't fetch replies here - will be loaded lazily on demand
          // Just set reply count if available
          try {
            const countResult = await this.countBookCommentReplies(activity.entityId);
            replyCount = countResult || 0;
          } catch (e) {
            console.error("Error counting replies for comment", activity.entityId, e);
          }
        }
        
        // Ensure metadata has required fields for frontend compatibility
        const metadata: Record<string, any> = {
          ...(activityMetadata || {}),
          // For comments
          parentCommentId,
          replies,
          reply_count: replyCount, // frontend expects reply_count
          // For comments and reviews - use fetched reactions
          reactions: activityReactions,
          // For comments
          content_preview: activityMetadata.content_preview || activityMetadata.content || '',
          author_name: activityMetadata.author_name || activity.userFullName || activity.userUsername || 'Unknown',
          author_avatar: activityMetadata.author_avatar || activity.userAvatarUrl || null,
          // For books
          cover_url: activityMetadata.cover_url || activityMetadata.coverUrl || '',
          uploader_name: activityMetadata.uploader_name || activityMetadata.uploaderName || '',
          // For news
          view_count: activityMetadata.view_count || 0,
          comment_count: activityMetadata.comment_count || 0,
          reaction_count: activityReactions.reduce((sum: number, r: any) => sum + (r.count || 0), 0),
          // For news comments
          news_title: activityMetadata.news_title || activityMetadata.newsTitle || '',
          news_id: activityMetadata.news_id || activityMetadata.newsId || '',
          // For book comments and reviews
          book_title: activityMetadata.book_title || activityMetadata.bookTitle || '',
          book_id: activityMetadata.book_id || activityMetadata.bookId || ''
        };
        
        return {
          id: activity.id,
          type: activity.activityType,
          entityId: activity.entityId,
          userId: activity.userId,
          targetUserId: activity.targetUserId,
          bookId: activity.bookId,
          metadata,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
          author_name: activity.userFullName || activity.userUsername || 'Unknown',
          author_avatar: activity.userAvatarUrl || null
        };
      }));
      
      return activitiesWithReplies;
    } catch (error) {
      console.error("Error getting global activities:", error);
      return [];
    }
  }
  
  async getPersonalActivities(userId: string, limit: number = 50, offset: number = 0, before?: string): Promise<any[]> {
    try {
      const activities: any[] = [];
      
      // Get user info once
      const userInfo = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const userData = userInfo[0];
      const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
      const user_avatar = userData?.avatarUrl || null;
      
      // Get user's own news articles
      const userNews = await db.select()
        .from(news)
        .where(and(
          eq(news.authorId, userId),
          eq(news.published, true)
        ))
        .orderBy(desc(news.publishedAt))
        .limit(Math.ceil(limit / 4));
      
      for (const item of userNews) {
        // Get reactions for this news item
        const newsReactions = await this.getReactionsForNews(item.id);
        
        // Group and aggregate reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        newsReactions.forEach((r: any) => {
          if (!groupedReactions[r.emoji]) {
            groupedReactions[r.emoji] = [];
          }
          groupedReactions[r.emoji].push(r);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted: false
          });
        });
        
        activities.push({
          id: item.id,
          type: 'news',
          entityId: item.id,
          userId: item.authorId,
          metadata: {
            title: item.title,
            content_preview: item.content.substring(0, 200),
            view_count: item.viewCount || 0,
            comment_count: item.commentCount || 0,
            reaction_count: item.reactionCount || 0,
            author_name: user_name,
            author_avatar: user_avatar,
            reactions: aggregatedReactions
          },
          createdAt: item.publishedAt || item.createdAt,
          updatedAt: item.updatedAt
        });
      }
      
      // Get user's uploaded books
      const userBooks = await db.select()
        .from(books)
        .where(eq(books.userId, userId))
        .orderBy(desc(books.uploadedAt))
        .limit(Math.ceil(limit / 4));
      
      for (const book of userBooks) {
        activities.push({
          id: book.id,
          type: 'book',
          entityId: book.id,
          userId: book.userId,
          bookId: book.id,
          metadata: {
            title: book.title,
            author: book.author,
            cover_url: book.coverImageUrl,
            genre: book.genre,
            uploader_name: user_name,
            uploader_avatar: user_avatar
          },
          createdAt: book.uploadedAt,
          updatedAt: book.updatedAt
        });
      }
      
      // Get user's comments
      const userComments = await db.select()
        .from(comments)
        .where(eq(comments.userId, userId))
        .orderBy(desc(comments.createdAt))
        .limit(Math.ceil(limit / 4));
      
      // Also get parent comments that the user replied to (to show complete thread structure)
      const userReplies = await db.select({parentCommentId: comments.parentCommentId})
        .from(comments)
        .where(and(
          eq(comments.userId, userId),
          isNull(comments.parentCommentId).not()
        ));
      
      const parentCommentIds = userReplies.map(reply => reply.parentCommentId).filter(Boolean) as string[];
      
      let repliedParentComments: any[] = [];
      if (parentCommentIds.length > 0) {
        repliedParentComments = await db.select()
          .from(comments)
          .where(inArray(comments.id, parentCommentIds))
          .orderBy(desc(comments.createdAt))
          .limit(Math.ceil(limit / 4));
      }
      
      // Combine user's comments and parent comments they replied to
      const allCommentsToShow = [...userComments, ...repliedParentComments];
      
      for (const comment of allCommentsToShow) {
        let book_title = 'Unknown';
        if (comment.bookId) {
          const bookData = await db.select().from(books).where(eq(books.id, comment.bookId)).limit(1);
          book_title = bookData[0] ? bookData[0].title : 'Unknown';
        }
        
        // Get reactions for this comment
        const commentReactions = await this.getReactions(comment.id, 'comment');
        
        // Group and aggregate reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        commentReactions.forEach((r: any) => {
          if (!groupedReactions[r.emoji]) {
            groupedReactions[r.emoji] = [];
          }
          groupedReactions[r.emoji].push(r);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted: false
          });
        });
        
        // Count comment replies
        const replyCount = await this.countCommentReplies(comment.id);
        
        activities.push({
          id: comment.id,
          type: 'comment',
          entityId: comment.id,
          userId: comment.userId,
          bookId: comment.bookId,
          metadata: {
            content: comment.content, // Full content instead of preview
            content_preview: comment.content.substring(0, 200), // Keep preview for compatibility
            book_id: comment.bookId,
            book_title: book_title,
            author_name: user_name,
            author_avatar: user_avatar,
            reactions: aggregatedReactions,
            reaction_count: aggregatedReactions.reduce((sum, r) => sum + r.count, 0),
            replyCount: replyCount
          },
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt
        });
      }
      
      // Get user's reviews
      const userReviews = await db.select()
        .from(reviews)
        .where(eq(reviews.userId, userId))
        .orderBy(desc(reviews.createdAt))
        .limit(Math.ceil(limit / 4));
      
      for (const review of userReviews) {
        const bookData = await db.select().from(books).where(eq(books.id, review.bookId)).limit(1);
        const book_title = bookData[0] ? bookData[0].title : 'Unknown';
        
        // Get reactions for this review
        const reviewReactions = await this.getReactions(review.id, 'review');
        
        // Group and aggregate reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        reviewReactions.forEach((r: any) => {
          if (!groupedReactions[r.emoji]) {
            groupedReactions[r.emoji] = [];
          }
          groupedReactions[r.emoji].push(r);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted: false
          });
        });
        
        // Count review replies
        const replyCount = await this.countReviewReplies(review.id);
        
        activities.push({
          id: review.id,
          type: 'review',
          entityId: review.id,
          userId: review.userId,
          bookId: review.bookId,
          metadata: {
            content: review.content, // Full content instead of preview
            content_preview: review.content.substring(0, 200), // Keep preview for compatibility
            rating: review.rating,
            book_id: review.bookId,
            book_title: book_title,
            author_name: user_name,
            author_avatar: user_avatar,
            reactions: aggregatedReactions,
            reaction_count: aggregatedReactions.reduce((sum, r) => sum + r.count, 0),
            replyCount: replyCount
          },
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        });
      }
      
      // Get user's profile comment actions (profile comments they wrote)
      const profileCommentActions = await db.select()
        .from(userActions)
        .where(and(
          eq(userActions.userId, userId),
          eq(userActions.actionType, 'profile_comment'),
          isNull(userActions.deletedAt)
        ))
        .orderBy(desc(userActions.createdAt))
        .limit(Math.ceil(limit / 4));
      
      for (const action of profileCommentActions) {
        // Get target user info (the profile owner)
        let targetUserInfo = null;
        if (action.targetId) {
          targetUserInfo = await this.getUser(action.targetId);
        }
        
        activities.push({
          id: action.id,
          type: 'user_action',
          action_type: 'profile_comment',
          entityId: action.id,
          userId: action.userId,
          user: {
            id: userId,
            username: user_name,
            avatar_url: user_avatar
          },
          target: {
            type: 'user',
            id: action.targetId,
            username: targetUserInfo?.username || 'Unknown'
          },
          metadata: {
            ...action.metadata,
            author_name: user_name,
            author_avatar: user_avatar,
            comment_preview: action.metadata?.comment_preview || '',
            profile_username: targetUserInfo?.username || 'Unknown'
          },
          createdAt: action.createdAt,
          timestamp: action.createdAt.toISOString()
        });
      }
      
      // Get user's profile comment reply actions
      const profileCommentReplyActions = await db.select()
        .from(userActions)
        .where(and(
          eq(userActions.userId, userId),
          eq(userActions.actionType, 'profile_comment_reply'),
          isNull(userActions.deletedAt)
        ))
        .orderBy(desc(userActions.createdAt))
        .limit(Math.ceil(limit / 4));
      
      for (const action of profileCommentReplyActions) {
        // Get target user info (the profile owner)
        let targetUserInfo = null;
        if (action.targetId) {
          targetUserInfo = await this.getUser(action.targetId);
        }
        
        activities.push({
          id: action.id,
          type: 'user_action',
          action_type: 'profile_comment_reply',
          entityId: action.id,
          userId: action.userId,
          user: {
            id: userId,
            username: user_name,
            avatar_url: user_avatar
          },
          target: {
            type: 'user',
            id: action.targetId,
            username: targetUserInfo?.username || 'Unknown'
          },
          metadata: {
            ...action.metadata,
            author_name: user_name,
            author_avatar: user_avatar,
            comment_preview: action.metadata?.comment_preview || '',
            profile_username: targetUserInfo?.username || 'Unknown'
          },
          createdAt: action.createdAt,
          timestamp: action.createdAt.toISOString()
        });
      }
      
      // NEW: Get activities from subscribed threads
      const userSubscriptions = await this.getUserSubscriptions(userId);
      
      // Get recent activities from subscribed books
      for (const subscription of userSubscriptions) {
        if (subscription.entityType === 'book') {
          // Get recent comments on this subscribed book (excluding user's own comments)
          const recentComments = await db.select()
            .from(comments)
            .where(and(
              eq(comments.bookId, subscription.entityId),
              ne(comments.userId, userId), // Exclude user's own comments
              sql`created_at > ${subscription.lastReadAt}` // Only newer than last read
            ))
            .orderBy(desc(comments.createdAt))
            .limit(5); // Limit to 5 recent comments per subscription
          
          // Get book info
          const bookInfo = await db.select().from(books).where(eq(books.id, subscription.entityId)).limit(1);
          const bookTitle = bookInfo[0]?.title || 'Unknown Book';
          
          for (const comment of recentComments) {
            // Get comment author info
            const authorInfo = await db.select().from(users).where(eq(users.id, comment.userId)).limit(1);
            const authorName = authorInfo[0] ? (authorInfo[0].fullName || authorInfo[0].username) : 'Unknown';
            const authorAvatar = authorInfo[0]?.avatarUrl || null;
            
            // Get reactions for this comment
            const commentReactions = await this.getReactions(comment.id, 'comment');
            
            // Group and aggregate reactions
            const groupedReactions: Record<string, any[]> = {};
            commentReactions.forEach((r: any) => {
              if (!groupedReactions[r.emoji]) {
                groupedReactions[r.emoji] = [];
              }
              groupedReactions[r.emoji].push(r);
            });
            
            const aggregatedReactions: any[] = [];
            Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
              aggregatedReactions.push({
                emoji,
                count: reactionList.length,
                userReacted: false
              });
            });
            
            // Count comment replies
            const replyCount = await this.countCommentReplies(comment.id);
            
            activities.push({
              id: comment.id,
              type: 'subscribed_comment',
              entityId: comment.id,
              userId: comment.userId,
              bookId: comment.bookId,
              subscriptionInfo: {
                subscribedEntityType: subscription.entityType,
                subscribedEntityId: subscription.entityId,
                subscriptionCreatedAt: subscription.createdAt,
                lastReadAt: subscription.lastReadAt
              },
              metadata: {
                content: comment.content,
                content_preview: comment.content.substring(0, 200),
                book_id: comment.bookId,
                book_title: bookTitle,
                author_name: authorName,
                author_avatar: authorAvatar,
                reactions: aggregatedReactions,
                reaction_count: aggregatedReactions.reduce((sum, r) => sum + r.count, 0),
                replyCount: replyCount,
                is_subscribed_activity: true
              },
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt
            });
          }
        }
      }
      
      // Sort by creation date
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply pagination
      return activities.slice(offset, offset + limit);
    } catch (error) {
      console.error("Error getting personal activities:", error);
      return [];
    }
  }
  
  async getShelfActivities(userId: string, shelfIds?: string[], bookIds?: string[], limit: number = 50, offset: number = 0, before?: string): Promise<any[]> {
    try {
      // Get user's shelves
      const userShelves = await db.select().from(shelves).where(eq(shelves.userId, userId));
      const userShelfIds = userShelves.map(s => s.id);
      
      if (userShelfIds.length === 0) {
        return [];
      }
      
      // Get books from shelves
      const shelfBooksData = await db.select().from(shelfBooks)
        .where(inArray(shelfBooks.shelfId, shelfIds || userShelfIds));
      
      let targetBookIds = shelfBooksData.map(sb => sb.bookId);
      
      // Filter by specific book IDs if provided
      if (bookIds && bookIds.length > 0) {
        targetBookIds = targetBookIds.filter(id => bookIds.includes(id));
      }
      
      if (targetBookIds.length === 0) {
        return [];
      }
      
      const activities: any[] = [];
      
      // Get comments for these books
      const commentsData = await db.select()
        .from(comments)
        .where(inArray(comments.bookId, targetBookIds))
        .orderBy(desc(comments.createdAt))
        .limit(Math.ceil(limit / 2));
      
      for (const comment of commentsData) {
        const bookData = await db.select().from(books).where(eq(books.id, comment.bookId!)).limit(1);
        const bookTitle = bookData[0] ? bookData[0].title : 'Unknown';
        
        // Get commenter info
        const commenter = await db.select().from(users).where(eq(users.id, comment.userId)).limit(1);
        const commenterData = commenter[0];
        
        // Get reactions for this comment
        const commentReactions = await this.getReactions(comment.id, 'comment');
        
        // Group and aggregate reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        commentReactions.forEach((r: any) => {
          if (!groupedReactions[r.emoji]) {
            groupedReactions[r.emoji] = [];
          }
          groupedReactions[r.emoji].push(r);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted: false
          });
        });
        
        activities.push({
          id: comment.id,
          type: 'comment',
          entityId: comment.id,
          userId: comment.userId,
          bookId: comment.bookId,
          metadata: {
            content_preview: comment.content.substring(0, 200),
            book_id: comment.bookId,
            book_title: bookTitle,
            author_name: commenterData ? (commenterData.fullName || commenterData.username) : 'Unknown',
            author_avatar: commenterData?.avatarUrl || null,
            reactions: aggregatedReactions,
            reaction_count: aggregatedReactions.reduce((sum, r) => sum + r.count, 0)
          },
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt
        });
      }
      
      // Get reviews for these books
      const reviewsData = await db.select()
        .from(reviews)
        .where(inArray(reviews.bookId, targetBookIds))
        .orderBy(desc(reviews.createdAt))
        .limit(Math.ceil(limit / 2));
      
      for (const review of reviewsData) {
        const bookData = await db.select().from(books).where(eq(books.id, review.bookId)).limit(1);
        const bookTitle = bookData[0] ? bookData[0].title : 'Unknown';
        
        // Get reviewer info
        const reviewer = await db.select().from(users).where(eq(users.id, review.userId)).limit(1);
        const reviewerData = reviewer[0];
        
        // Get reactions for this review
        const reviewReactions = await this.getReactions(review.id, 'review');
        
        // Group and aggregate reactions by emoji
        const groupedReactions: Record<string, any[]> = {};
        reviewReactions.forEach((r: any) => {
          if (!groupedReactions[r.emoji]) {
            groupedReactions[r.emoji] = [];
          }
          groupedReactions[r.emoji].push(r);
        });
        
        // Aggregate reactions
        const aggregatedReactions: any[] = [];
        Object.entries(groupedReactions).forEach(([emoji, reactionList]) => {
          aggregatedReactions.push({
            emoji,
            count: reactionList.length,
            userReacted: false
          });
        });
        
        activities.push({
          id: review.id,
          type: 'review',
          entityId: review.id,
          userId: review.userId,
          bookId: review.bookId,
          metadata: {
            content_preview: review.content.substring(0, 200),
            rating: review.rating,
            book_id: review.bookId,
            book_title: bookTitle,
            author_name: reviewerData ? (reviewerData.fullName || reviewerData.username) : 'Unknown',
            author_avatar: reviewerData?.avatarUrl || null,
            reactions: aggregatedReactions,
            reaction_count: aggregatedReactions.reduce((sum, r) => sum + r.count, 0)
          },
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        });
      }
      
      // Sort by creation date
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply pagination
      return activities.slice(offset, offset + limit);
    } catch (error) {
      console.error("Error getting shelf activities:", error);
      return [];
    }
  }
  
  // User actions operations
  async createUserAction(actionData: any): Promise<any> {
    try {
      const result = await db.insert(userActions).values({
        userId: actionData.userId,
        actionType: actionData.actionType,
        targetType: actionData.targetType || null,
        targetId: actionData.targetId || null,
        metadata: actionData.metadata || {},
        createdAt: new Date()
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user action:", error);
      throw error;
    }
  }
  
  async getLastActions(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      // Get user actions
      const actions = await db
        .select()
        .from(userActions)
        .where(isNull(userActions.deletedAt))
        .orderBy(desc(userActions.createdAt))
        .limit(limit * 2) // Get more to account for merging
        .offset(offset);
      
      // Get global activities from activity feed
      const activities = await this.getGlobalActivities(limit, offset);
      
      // Format user actions to match activity feed structure
      const formattedActions = await Promise.all(actions.map(async (action) => {
        // Get user info
        const user = await this.getUser(action.userId);
        
        let targetInfo: any = {};
        
        // Get target info based on type
        if (action.targetType && action.targetId) {
          switch (action.targetType) {
            case 'user':
              const targetUser = await this.getUser(action.targetId);
              if (targetUser) {
                targetInfo = {
                  type: 'user',
                  id: targetUser.id,
                  username: targetUser.username,
                  full_name: targetUser.fullName || null,
                  avatar_url: targetUser.avatarUrl
                };
              }
              break;
            case 'book':
              const book = await db.select().from(books).where(eq(books.id, action.targetId)).limit(1);
              if (book[0]) {
                targetInfo = {
                  type: 'book',
                  id: book[0].id,
                  title: book[0].title,
                  author: book[0].author,
                  cover_url: book[0].coverImageUrl
                };
              }
              break;
            case 'news':
              const newsItem = await db.select().from(news).where(eq(news.id, action.targetId)).limit(1);
              if (newsItem[0]) {
                targetInfo = {
                  type: 'news',
                  id: newsItem[0].id,
                  title: newsItem[0].title
                };
              }
              break;
            case 'group':
              const group = await db.select().from(groups).where(eq(groups.id, action.targetId)).limit(1);
              if (group[0]) {
                targetInfo = {
                  type: 'group',
                  id: group[0].id,
                  name: group[0].name
                };
              }
              break;
          }
        }
        
        return {
          id: action.id,
          type: 'user_action',
          action_type: action.actionType,
          entityId: action.id,
          userId: action.userId,
          user: {
            id: user?.id,
            username: user?.username,
            avatar_url: user?.avatarUrl
          },
          target: targetInfo,
          metadata: action.metadata || {},
          createdAt: action.createdAt,
          timestamp: action.createdAt.toISOString()
        };
      }));
      
      // Merge activities and formatted actions
      const allItems = [...activities, ...formattedActions];
      
      // Sort by creation date
      allItems.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Apply pagination and limit
      return allItems.slice(0, limit);
    } catch (error) {
      console.error("Error getting last actions:", error);
      return [];
    }
  }
  
  async cleanupOldActions(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      await db
        .update(userActions)
        .set({ deletedAt: new Date() })
        .where(sql`${userActions.createdAt} < ${cutoffDate} AND ${userActions.deletedAt} IS NULL`);
      
      console.log(`Cleaned up user actions older than ${daysToKeep} days`);
    } catch (error) {
      console.error("Error cleaning up old actions:", error);
    }
  }
  
  async deleteUserAction(id: string): Promise<boolean> {
    try {
      // Check if user action exists and is not already deleted
      const existingAction = await db
        .select()
        .from(userActions)
        .where(
          and(
            eq(userActions.id, id),
            isNull(userActions.deletedAt)
          )
        );
      
      if (existingAction.length === 0) {
        console.log(`User action not found or already deleted: ${id}`);
        return false;
      }
      
      // Soft delete the user action
      await db
        .update(userActions)
        .set({ deletedAt: new Date() })
        .where(eq(userActions.id, id));
      
      console.log(`User action soft-deleted: ${id}`);
      return true;
    } catch (error) {
      console.error("Error deleting user action:", error);
      return false;
    }
  }
  
  // Activity feed methods
  async createActivity(activityData: any): Promise<any> {
    try {
      const [result] = await db.insert(activityFeed).values({
        activityType: activityData.activityType,
        entityId: activityData.entityId,
        userId: activityData.userId,
        targetUserId: activityData.targetUserId,
        bookId: activityData.bookId,
        metadata: activityData.metadata
      }).returning();
      
      return result;
    } catch (error) {
      console.error("Error creating activity:", error);
      throw error;
    }
  }
  
  async updateActivityMetadata(entityId: string, metadata: any): Promise<void> {
    try {
      await db
        .update(activityFeed)
        .set({ metadata: sql`metadata || ${JSON.stringify(metadata)}::jsonb`, updatedAt: new Date() })
        .where(eq(activityFeed.entityId, entityId));
    } catch (error) {
      console.error("Error updating activity metadata:", error);
      throw error;
    }
  }
  
  async softDeleteActivity(activityId: string): Promise<void> {
    try {
      await db
        .update(activityFeed)
        .set({ deletedAt: new Date() })
        .where(eq(activityFeed.id, activityId));
    } catch (error) {
      console.error("Error soft deleting activity:", error);
      throw error;
    }
  }
  
  // Subscription operations
  async subscribeToEntity(userId: string, entityType: string, entityId: string): Promise<void> {
    try {
      // Check if subscription already exists
      const existing = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.entityType, entityType),
            eq(subscriptions.entityId, entityId)
          )
        );
      
      if (existing.length === 0) {
        // Create new subscription
        await db
          .insert(subscriptions)
          .values({
            userId,
            entityType,
            entityId,
            createdAt: new Date(),
            lastReadAt: new Date()
          });
        console.log(`User ${userId} subscribed to ${entityType}:${entityId}`);
      } else {
        console.log(`User ${userId} already subscribed to ${entityType}:${entityId}`);
      }
    } catch (error) {
      console.error("Error subscribing to entity:", error);
      throw error;
    }
  }
  
  async unsubscribeFromEntity(userId: string, entityType: string, entityId: string): Promise<void> {
    try {
      await db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.entityType, entityType),
            eq(subscriptions.entityId, entityId)
          )
        );
      console.log(`User ${userId} unsubscribed from ${entityType}:${entityId}`);
    } catch (error) {
      console.error("Error unsubscribing from entity:", error);
      throw error;
    }
  }
  
  async getUserSubscriptions(userId: string): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt));
      
      return result;
    } catch (error) {
      console.error("Error getting user subscriptions:", error);
      return [];
    }
  }
  
  async getUnreadCountForSubscription(userId: string, entityType: string, entityId: string): Promise<number> {
    try {
      // Get the last read time for this subscription
      const subscriptionResult = await db
        .select({ lastReadAt: subscriptions.lastReadAt })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.entityType, entityType),
            eq(subscriptions.entityId, entityId)
          )
        );
      
      if (subscriptionResult.length === 0) {
        return 0; // Not subscribed
      }
      
      const lastReadAt = subscriptionResult[0].lastReadAt;
      
      // Count unread activities based on entity type
      let unreadCount = 0;
      
      if (entityType === 'book') {
        // Count comments and reviews on this book created after last read
        const commentsResult = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM comments 
          WHERE book_id = ${entityId} AND created_at > ${lastReadAt}
        `);
        
        const reviewsResult = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM reviews 
          WHERE book_id = ${entityId} AND created_at > ${lastReadAt}
        `);
        
        unreadCount = parseInt(commentsResult.rows[0].count as string) + 
                     parseInt(reviewsResult.rows[0].count as string);
                      
      } else if (entityType === 'news') {
        // Count comments on this news article
        const commentsResult = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM news_comments 
          WHERE news_id = ${entityId} AND created_at > ${lastReadAt}
        `);
        
        unreadCount = parseInt(commentsResult.rows[0].count as string);
      }
      
      return unreadCount;
    } catch (error) {
      console.error("Error getting unread count for subscription:", error);
      return 0;
    }
  }
  
  // Channel read position operations
  async upsertChannelReadPosition(userId: string, channelId: string): Promise<void> {
    try {
      // Check if a read position already exists
      const existing = await db
        .select()
        .from(userChannelReadPositions)
        .where(
          and(
            eq(userChannelReadPositions.userId, userId),
            eq(userChannelReadPositions.channelId, channelId)
          )
        );
      
      if (existing.length > 0) {
        // Update existing record
        await db
          .update(userChannelReadPositions)
          .set({ 
            lastReadAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(userChannelReadPositions.userId, userId),
              eq(userChannelReadPositions.channelId, channelId)
            )
          );
      } else {
        // Insert new record
        await db
          .insert(userChannelReadPositions)
          .values({
            userId,
            channelId,
            lastReadAt: new Date()
          });
      }
    } catch (error) {
      console.error("Error upserting channel read position:", error);
      throw error;
    }
  }
  
  async getChannelReadPosition(userId: string, channelId: string): Promise<Date | null> {
    try {
      const result = await db
        .select()
        .from(userChannelReadPositions)
        .where(
          and(
            eq(userChannelReadPositions.userId, userId),
            eq(userChannelReadPositions.channelId, channelId)
          )
        );
      
      return result.length > 0 ? result[0].lastReadAt : null;
    } catch (error) {
      console.error("Error getting channel read position:", error);
      return null;
    }
  }
  
  async getArticleBookmarkCount(articleId: string): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(articleReadLater)
        .where(eq(articleReadLater.articleId, articleId));
        
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting article bookmark count:", error);
      return 0;
    }
  }
  
  // Book chat operations
  async createBookChatMessage(messageData: { bookId: string; userId: string; content: string; mentionedUserId?: string; quotedMessageId?: string; attachmentUrls?: string[]; attachmentMetadata?: any }): Promise<any> {
    try {
      const result = await db
        .insert(bookChatMessages)
        .values({
          bookId: messageData.bookId,
          userId: messageData.userId,
          content: messageData.content,
          mentionedUserId: messageData.mentionedUserId || null,
          quotedMessageId: messageData.quotedMessageId || null,
          attachmentUrls: messageData.attachmentUrls ? sql`${JSON.stringify(messageData.attachmentUrls)}::jsonb` : sql`'[]'::jsonb`,
          attachmentMetadata: messageData.attachmentMetadata ? sql`${JSON.stringify(messageData.attachmentMetadata)}::jsonb` : null,
        })
        .returning();
      
      // Get the user info to return with the message
      const user = await this.getUser(messageData.userId);
      
      // Get quoted message if exists
      let quotedMessage = null;
      if (messageData.quotedMessageId) {
        const quotedResult = await db
          .select({
            id: bookChatMessages.id,
            content: bookChatMessages.content,
            userId: bookChatMessages.userId,
            username: users.username,
          })
          .from(bookChatMessages)
          .leftJoin(users, eq(bookChatMessages.userId, users.id))
          .where(eq(bookChatMessages.id, messageData.quotedMessageId));
        
        if (quotedResult.length > 0) {
          const q = quotedResult[0];
          quotedMessage = {
            id: q.id,
            content: q.content,
            user: {
              id: q.userId,
              username: q.username,
            }
          };
        }
      }
      
      return {
        ...result[0],
        quotedMessage,
        attachmentUrls: result[0].attachmentUrls || [],
        attachmentMetadata: result[0].attachmentMetadata || null,
        user: user ? {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        } : null,
      };
    } catch (error) {
      console.error("Error creating book chat message:", error);
      throw error;
    }
  }
  
  async getBookChatMessages(bookId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: bookChatMessages.id,
          bookId: bookChatMessages.bookId,
          userId: bookChatMessages.userId,
          content: bookChatMessages.content,
          mentionedUserId: bookChatMessages.mentionedUserId,
          quotedMessageId: bookChatMessages.quotedMessageId,
          attachmentUrls: bookChatMessages.attachmentUrls,
          attachmentMetadata: bookChatMessages.attachmentMetadata,
          createdAt: bookChatMessages.createdAt,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(bookChatMessages)
        .leftJoin(users, eq(bookChatMessages.userId, users.id))
        .where(
          and(
            eq(bookChatMessages.bookId, bookId),
            isNull(bookChatMessages.deletedAt)
          )
        )
        .orderBy(desc(bookChatMessages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Get all quoted messages in one query for efficiency
      const quotedMessageIds = result
        .filter(msg => msg.quotedMessageId)
        .map(msg => msg.quotedMessageId as string);
      
      let quotedMessages: Map<string, any> = new Map();
      
      if (quotedMessageIds.length > 0) {
        const quotedResult = await db
          .select({
            id: bookChatMessages.id,
            content: bookChatMessages.content,
            userId: bookChatMessages.userId,
            username: users.username,
          })
          .from(bookChatMessages)
          .leftJoin(users, eq(bookChatMessages.userId, users.id))
          .where(inArray(bookChatMessages.id, quotedMessageIds));
        
        quotedResult.forEach(msg => {
          quotedMessages.set(msg.id, {
            id: msg.id,
            content: msg.content,
            user: {
              id: msg.userId,
              username: msg.username,
            }
          });
        });
      }
      
      // Transform to include user object and quoted message
      return result.map(msg => ({
        id: msg.id,
        bookId: msg.bookId,
        userId: msg.userId,
        content: msg.content,
        mentionedUserId: msg.mentionedUserId,
        quotedMessageId: msg.quotedMessageId,
        quotedMessage: msg.quotedMessageId ? quotedMessages.get(msg.quotedMessageId) : null,
        attachmentUrls: msg.attachmentUrls,
        attachmentMetadata: msg.attachmentMetadata,
        createdAt: msg.createdAt,
        user: {
          id: msg.userId,
          username: msg.username,
          avatarUrl: msg.avatarUrl,
        },
      })).reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error("Error getting book chat messages:", error);
      return [];
    }
  }
  
  async deleteBookChatMessage(id: string, userId: string, isAdminOrModer: boolean = false): Promise<boolean> {
    try {
      // Soft delete - allow if user owns the message OR if user is admin/moder
      const whereClause = isAdminOrModer 
        ? eq(bookChatMessages.id, id)
        : and(
            eq(bookChatMessages.id, id),
            eq(bookChatMessages.userId, userId)
          );
      
      const result = await db
        .update(bookChatMessages)
        .set({ deletedAt: new Date() })
        .where(whereClause)
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting book chat message:", error);
      return false;
    }
  }

  // OAuth Account Management
  async createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    email?: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    tokenExpiresAt?: Date;
  }) {
    const [account] = await db.insert(oauthAccounts).values(data).returning();
    return account;
  }

  async getOAuthAccount(provider: string, providerUserId: string) {
    const [account] = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerUserId, providerUserId)
        )
      )
      .limit(1);
    return account;
  }

  async getOAuthAccountsByUserId(userId: string) {
    return await db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId));
  }

  async getUserByOAuthEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async updateOAuthTokens(
    id: number,
    encryptedAccessToken: string,
    encryptedRefreshToken?: string,
    tokenExpiresAt?: Date
  ) {
    const [account] = await db
      .update(oauthAccounts)
      .set({
        encryptedAccessToken,
        encryptedRefreshToken: encryptedRefreshToken || undefined,
        tokenExpiresAt: tokenExpiresAt || undefined,
        updatedAt: new Date(),
      })
      .where(eq(oauthAccounts.id, id))
      .returning();
    return account;
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<boolean> {
    const result = await db
      .delete(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, provider)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async countUserAuthMethods(userId: string): Promise<number> {
    const oauthCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId));
    
    const [user] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const hasPassword = user?.password ? 1 : 0;
    const oauthTotal = Number(oauthCount[0]?.count || 0);
    
    return hasPassword + oauthTotal;
  }

  // ========== Profile Ratings Methods ==========

  async createProfileRating(ratingData: {userId: string, profileId: string, rating: number}): Promise<any> {
    try {
      // Check if rating already exists
      const existing = await this.getUserProfileRating(ratingData.userId, ratingData.profileId);
      
      if (existing) {
        // Update existing rating
        return await this.updateProfileRating(existing.id, ratingData.rating);
      }
      
      // Create new rating
      const result = await db.insert(profileRatings)
        .values({
          userId: ratingData.userId,
          profileId: ratingData.profileId,
          rating: ratingData.rating,
        })
        .returning();
      
      // Update average rating for the profile
      await this.updateProfileAverageRating(ratingData.profileId);
      
      // Get rating with user info
      const ratingWithUser = await db.select({
        id: profileRatings.id,
        userId: profileRatings.userId,
        profileId: profileRatings.profileId,
        rating: profileRatings.rating,
        createdAt: profileRatings.createdAt,
        updatedAt: profileRatings.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(profileRatings)
      .leftJoin(users, eq(profileRatings.userId, users.id))
      .where(eq(profileRatings.id, result[0].id));
      
      return ratingWithUser[0];
    } catch (error) {
      console.error("Error creating profile rating:", error);
      throw error;
    }
  }

  async getProfileRatings(profileId: string): Promise<any[]> {
    try {
      const ratings = await db.select({
        id: profileRatings.id,
        userId: profileRatings.userId,
        profileId: profileRatings.profileId,
        rating: profileRatings.rating,
        createdAt: profileRatings.createdAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(profileRatings)
      .leftJoin(users, eq(profileRatings.userId, users.id))
      .where(eq(profileRatings.profileId, profileId))
      .orderBy(desc(profileRatings.createdAt));
      
      return ratings;
    } catch (error) {
      console.error("Error getting profile ratings:", error);
      throw error;
    }
  }

  async getUserProfileRating(userId: string, profileId: string): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(profileRatings)
        .where(
          and(
            eq(profileRatings.userId, userId),
            eq(profileRatings.profileId, profileId)
          )
        )
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting user profile rating:", error);
      throw error;
    }
  }

  async updateProfileRating(id: string, rating: number): Promise<any> {
    try {
      const result = await db.update(profileRatings)
        .set({ 
          rating,
          updatedAt: new Date()
        })
        .where(eq(profileRatings.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Rating not found');
      }
      
      // Update average rating for the profile
      await this.updateProfileAverageRating(result[0].profileId);
      
      // Get rating with user info
      const ratingWithUser = await db.select({
        id: profileRatings.id,
        userId: profileRatings.userId,
        profileId: profileRatings.profileId,
        rating: profileRatings.rating,
        createdAt: profileRatings.createdAt,
        updatedAt: profileRatings.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(profileRatings)
      .leftJoin(users, eq(profileRatings.userId, users.id))
      .where(eq(profileRatings.id, result[0].id));
      
      return ratingWithUser[0];
    } catch (error) {
      console.error("Error updating profile rating:", error);
      throw error;
    }
  }

  async deleteProfileRating(id: string, userId: string | null): Promise<boolean> {
    try {
      // Get the rating first to check ownership and get profileId
      const rating = await db.select()
        .from(profileRatings)
        .where(eq(profileRatings.id, id))
        .limit(1);
      
      if (rating.length === 0) {
        return false;
      }
      
      // Verify ownership (userId = null means admin/moder bypass)
      if (userId !== null && rating[0].userId !== userId) {
        throw new Error('Unauthorized');
      }
      
      const profileId = rating[0].profileId;
      
      // Find and delete linked comment (CASCADE will handle this, but we need to know for the return)
      const linkedComment = await db.select()
        .from(profileComments)
        .where(eq(profileComments.linkedRatingId, id))
        .limit(1);
      
      if (linkedComment.length > 0) {
        await db.delete(profileComments)
          .where(eq(profileComments.id, linkedComment[0].id));
      }
      
      // Delete the rating
      await db.delete(profileRatings)
        .where(eq(profileRatings.id, id));
      
      // Update average rating
      await this.updateProfileAverageRating(profileId);
      
      return true;
    } catch (error) {
      console.error("Error deleting profile rating:", error);
      throw error;
    }
  }

  async updateProfileAverageRating(profileId: string): Promise<void> {
    try {
      console.log(`Updating average rating for profile ${profileId}`);
      
      // Get user rating configuration
      const configResult = await db.select().from(userRatingConfig).limit(1);
      const dbConfig = configResult[0];
      
      if (!dbConfig) {
        console.error("No user rating configuration found, using defaults");
      }
      
      // Build config object
      const config: UserRatingAlgorithmConfig = dbConfig ? {
        priorMean: Number(dbConfig.priorMean),
        priorStrength: dbConfig.priorStrength,
        confidenceThreshold: dbConfig.confidenceThreshold,
        raterAgeThresholds: {
          youngDays: dbConfig.raterYoungDays,
          youngMult: Number(dbConfig.raterYoungMult),
          mediumDays: dbConfig.raterMediumDays,
          mediumMult: Number(dbConfig.raterMediumMult),
          matureMult: Number(dbConfig.raterMatureMult),
        },
        raterVerifiedMult: Number(dbConfig.raterVerifiedMult),
        raterActivityMult: Number(dbConfig.raterActivityMult),
        raterActivityRules: {
          minReadingMinutes30d: dbConfig.raterMinReadingMinutes30d,
          minBooksAdded30d: dbConfig.raterMinBooksAdded30d,
        },
        raterWeightCap: Number(dbConfig.raterWeightCap),
        raterWeightFloor: Number(dbConfig.raterWeightFloor),
        textEmptyMult: Number(dbConfig.textEmptyMult),
        textLengthRules: {
          shortLength: dbConfig.textShortLength,
          shortMult: Number(dbConfig.textShortMult),
          normalMaxLength: dbConfig.textNormalMaxLength,
          normalMult: Number(dbConfig.textNormalMult),
          longMult: Number(dbConfig.textLongMult),
        },
        textSpamMult: Number(dbConfig.textSpamMult),
        likesEnabled: dbConfig.likesEnabled,
        likesAlpha: Number(dbConfig.likesAlpha),
        likesCap: Number(dbConfig.likesCap),
        timeDecayEnabled: dbConfig.timeDecayEnabled,
        timeDecayHalfLifeDays: dbConfig.timeDecayHalfLifeDays,
        timeDecayMinWeight: Number(dbConfig.timeDecayMinWeight),
      } : DEFAULT_USER_RATING_CONFIG;
      
      // Get all ratings for this profile with comment data
      const ratingsData = await db.select({
        ratingId: profileRatings.id,
        rating: profileRatings.rating,
        userId: profileRatings.userId,
        createdAt: profileRatings.createdAt,
        raterCreatedAt: users.createdAt,
        raterIsVerified: sql<boolean>`CASE WHEN ${users.email} IS NOT NULL THEN true ELSE false END`,
      })
      .from(profileRatings)
      .leftJoin(users, eq(profileRatings.userId, users.id))
      .where(eq(profileRatings.profileId, profileId));
      
      console.log(`Found ${ratingsData.length} ratings for profile ${profileId}`);
      
      if (ratingsData.length === 0) {
        // No ratings, set to null
        await db.update(users)
          .set({ profileRating: null })
          .where(eq(users.id, profileId));
        
        // Update or create aggregate record
        await db.insert(userRatingAgg)
          .values({
            userId: profileId,
            sumW: '0',
            sumWX: '0',
            countActive: 0,
            ratingOverall: null,
            confidence: '0',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userRatingAgg.userId,
            set: {
              sumW: '0',
              sumWX: '0',
              countActive: 0,
              ratingOverall: null,
              confidence: '0',
              updatedAt: new Date(),
            }
          });
        
        console.log(`Set profile ${profileId} rating to null (no ratings)`);
        return;
      }
      
      // Get profile comments linked to these ratings to get text content
      const comments = await db.select({
        linkedRatingId: profileComments.linkedRatingId,
        content: profileComments.content,
      })
      .from(profileComments)
      .where(
        and(
          eq(profileComments.profileId, profileId),
          isNull(profileComments.linkedRatingId) === false
        )
      );
      
      const commentMap = new Map<string, string>();
      for (const comment of comments) {
        if (comment.linkedRatingId) {
          commentMap.set(comment.linkedRatingId, comment.content);
        }
      }
      
      // Calculate weights and prepare data for rating calculation
      const ratingsWithWeights: Array<{
        rating: UserRatingParams;
        rater: RaterUserData;
        weight: number;
      }> = [];
      
      for (const ratingData of ratingsData) {
        const content = commentMap.get(ratingData.ratingId) || '';
        const isSpam = detectSpamInComment(content);
        
        const ratingParams: UserRatingParams = {
          id: ratingData.ratingId,
          rating: ratingData.rating,
          content: content,
          createdAt: ratingData.createdAt,
          likes: 0, // We'll add this later if needed
          raterUserId: ratingData.userId,
          status: 'active',
        };
        
        const raterData: RaterUserData = {
          id: ratingData.userId,
          createdAt: ratingData.raterCreatedAt,
          isVerified: ratingData.raterIsVerified,
        };
        
        const weight = calculateUserRatingWeight(ratingParams, raterData, config, isSpam);
        
        ratingsWithWeights.push({
          rating: ratingParams,
          rater: raterData,
          weight,
        });
      }
      
      // Calculate overall rating
      const { rating: calculatedRating, confidence, effectiveN } = calculateUserRatingOverall(
        ratingsWithWeights,
        config
      );
      
      console.log(`Calculated rating: ${calculatedRating} (confidence: ${confidence}, effectiveN: ${effectiveN}) for profile ${profileId}`);
      
      // Update user's profile rating
      await db.update(users)
        .set({
          profileRating: calculatedRating !== null ? sql`${calculatedRating}` : null
        })
        .where(eq(users.id, profileId));
      
      // Calculate aggregate sums for storage
      let sumW = 0;
      let sumWX = 0;
      for (const { rating, weight } of ratingsWithWeights) {
        sumW += weight;
        sumWX += weight * rating.rating;
      }
      
      // Update aggregate table
      await db.insert(userRatingAgg)
        .values({
          userId: profileId,
          sumW: sql`${sumW}`,
          sumWX: sql`${sumWX}`,
          countActive: ratingsData.length,
          ratingOverall: calculatedRating !== null ? sql`${calculatedRating}` : null,
          confidence: sql`${confidence}`,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userRatingAgg.userId,
          set: {
            sumW: sql`${sumW}`,
            sumWX: sql`${sumWX}`,
            countActive: ratingsData.length,
            ratingOverall: calculatedRating !== null ? sql`${calculatedRating}` : null,
            confidence: sql`${confidence}`,
            updatedAt: new Date(),
          }
        });
      
      console.log(`Updated profile ${profileId} rating to ${calculatedRating}`);
    } catch (error) {
      console.error("Error updating profile average rating:", error);
      throw error;
    }
  }

  // ========== Profile Comments Methods ==========

  async createProfileComment(commentData: {userId: string, profileId: string, content: string, attachments?: any, parentCommentId?: string, quotedText?: string}): Promise<any> {
    try {
      // Get user's rating if exists to link it
      const userRating = await this.getUserProfileRating(commentData.userId, commentData.profileId);
      
      // Always create new comment (allow multiple comments per user)
      const result = await db.insert(profileComments)
        .values({
          userId: commentData.userId,
          profileId: commentData.profileId,
          content: commentData.content,
          attachmentMetadata: commentData.attachments || null,
          linkedRatingId: userRating?.id || null,
          parentCommentId: commentData.parentCommentId || null,
          quotedText: commentData.quotedText || null,
        })
        .returning();
      
      // Get comment with user info
      const commentWithUser = await db.select({
        id: profileComments.id,
        userId: profileComments.userId,
        profileId: profileComments.profileId,
        content: profileComments.content,
        attachmentMetadata: profileComments.attachmentMetadata,
        linkedRatingId: profileComments.linkedRatingId,
        parentCommentId: profileComments.parentCommentId,
        quotedText: profileComments.quotedText,
        createdAt: profileComments.createdAt,
        updatedAt: profileComments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(profileComments)
      .leftJoin(users, eq(profileComments.userId, users.id))
      .where(eq(profileComments.id, result[0].id));
      
      return commentWithUser[0];
    } catch (error) {
      console.error("Error creating profile comment:", error);
      throw error;
    }
  }

  async getProfileComments(profileId: string, options: {limit: number, offset: number, currentUserId?: string}): Promise<{comments: any[], total: number}> {
    try {
      // Get total count of root comments only (no parent)
      const countResult = await db.select({
        count: sql<number>`COUNT(*)`
      })
      .from(profileComments)
      .where(and(
        eq(profileComments.profileId, profileId),
        isNull(profileComments.parentCommentId)
      ));
      
      const total = Number(countResult[0].count);
      
      // Get only root comments (parentCommentId is null), ordered by most recent first
      const rootComments = await db.select({
        id: profileComments.id,
        userId: profileComments.userId,
        profileId: profileComments.profileId,
        content: profileComments.content,
        attachmentMetadata: profileComments.attachmentMetadata,
        linkedRatingId: profileComments.linkedRatingId,
        parentCommentId: profileComments.parentCommentId,
        quotedText: profileComments.quotedText,
        createdAt: profileComments.createdAt,
        updatedAt: profileComments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        rating: profileRatings.rating,
      })
      .from(profileComments)
      .leftJoin(users, eq(profileComments.userId, users.id))
      .leftJoin(profileRatings, eq(profileComments.linkedRatingId, profileRatings.id))
      .where(and(
        eq(profileComments.profileId, profileId),
        isNull(profileComments.parentCommentId)
      ))
      .orderBy(desc(profileComments.createdAt))
      .limit(options.limit)
      .offset(options.offset);
      
      // Get reactions and reply counts for all root comments
      const commentsWithReactions = await Promise.all(rootComments.map(async (comment) => {
        const reactions = await this.getProfileCommentReactions(comment.id, options.currentUserId);
        
        // Count all descendants (replies to this comment and their replies)
        const replyCountResult = await this.countCommentReplies(comment.id);
        
        return {
          ...comment,
          isOwnComment: options.currentUserId ? comment.userId === options.currentUserId : false,
          reactions,
          replyCount: replyCountResult,
        };
      }));
      
      return {
        comments: commentsWithReactions,
        total
      };
    } catch (error) {
      console.error("Error getting profile comments:", error);
      throw error;
    }
  }

  async countCommentReplies(commentId: string): Promise<number> {
    // Recursively count all replies (direct and nested)
    const directReplies = await db.select({
      id: profileComments.id
    })
    .from(profileComments)
    .where(eq(profileComments.parentCommentId, commentId));
    
    let total = directReplies.length;
    
    for (const reply of directReplies) {
      total += await this.countCommentReplies(reply.id);
    }
    
    return total;
  }

  async getCommentReplies(commentId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Get direct replies to this comment
      const replies = await db.select({
        id: profileComments.id,
        userId: profileComments.userId,
        profileId: profileComments.profileId,
        content: profileComments.content,
        attachmentMetadata: profileComments.attachmentMetadata,
        linkedRatingId: profileComments.linkedRatingId,
        parentCommentId: profileComments.parentCommentId,
        quotedText: profileComments.quotedText,
        createdAt: profileComments.createdAt,
        updatedAt: profileComments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        rating: profileRatings.rating,
      })
      .from(profileComments)
      .leftJoin(users, eq(profileComments.userId, users.id))
      .leftJoin(profileRatings, eq(profileComments.linkedRatingId, profileRatings.id))
      .where(eq(profileComments.parentCommentId, commentId))
      .orderBy(profileComments.createdAt); // Oldest first for replies
      
      // Get reactions, parent info, and nested replies for each reply
      const repliesWithData = await Promise.all(replies.map(async (reply) => {
        const reactions = await this.getProfileCommentReactions(reply.id, currentUserId);
        
        // Get parent comment author name
        let parentCommentAuthor = null;
        if (reply.parentCommentId) {
          const parentComment = await db.select({
            username: users.username,
            fullName: users.fullName,
          })
          .from(profileComments)
          .leftJoin(users, eq(profileComments.userId, users.id))
          .where(eq(profileComments.id, reply.parentCommentId))
          .limit(1);
          
          if (parentComment[0]) {
            parentCommentAuthor = parentComment[0].fullName || parentComment[0].username;
          }
        }
        
        // Recursively get nested replies
        const nestedReplies = await this.getCommentReplies(reply.id, currentUserId);
        
        // Count all nested replies (direct + their children)
        const replyCount = await this.countCommentReplies(reply.id);
        
        return {
          ...reply,
          isOwnComment: currentUserId ? reply.userId === currentUserId : false,
          reactions,
          parentCommentAuthor,
          replies: nestedReplies,
          replyCount,
        };
      }));
      
      return repliesWithData;
    } catch (error) {
      console.error("Error getting comment replies:", error);
      throw error;
    }
  }

  async getUserProfileComment(userId: string, profileId: string): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(profileComments)
        .where(
          and(
            eq(profileComments.userId, userId),
            eq(profileComments.profileId, profileId)
          )
        )
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting user profile comment:", error);
      throw error;
    }
  }

  async updateProfileComment(id: string, content: string): Promise<any> {
    try {
      const result = await db.update(profileComments)
        .set({ 
          content,
          updatedAt: new Date()
        })
        .where(eq(profileComments.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Comment not found');
      }
      
      // Get comment with user info
      const commentWithUser = await db.select({
        id: profileComments.id,
        userId: profileComments.userId,
        profileId: profileComments.profileId,
        content: profileComments.content,
        attachmentMetadata: profileComments.attachmentMetadata,
        linkedRatingId: profileComments.linkedRatingId,
        createdAt: profileComments.createdAt,
        updatedAt: profileComments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(profileComments)
      .leftJoin(users, eq(profileComments.userId, users.id))
      .where(eq(profileComments.id, result[0].id));
      
      return commentWithUser[0];
    } catch (error) {
      console.error("Error updating profile comment:", error);
      throw error;
    }
  }

  async deleteProfileComment(id: string, userId: string | null): Promise<boolean> {
    try {
      // Get the comment first to check ownership and get linked rating
      const comment = await db.select()
        .from(profileComments)
        .where(eq(profileComments.id, id))
        .limit(1);
      
      if (comment.length === 0) {
        return false;
      }
      
      // Verify ownership or profile ownership (userId = null means admin/moder bypass)
      // Allow deletion if user is comment author OR if user owns the profile where comment is posted
      if (userId !== null && comment[0].userId !== userId && comment[0].profileId !== userId) {
        throw new Error('Unauthorized');
      }
      
      const linkedRatingId = comment[0].linkedRatingId;
      const profileId = comment[0].profileId;
      
      // Delete the comment
      await db.delete(profileComments)
        .where(eq(profileComments.id, id));
      
      // Delete linked rating if exists
      if (linkedRatingId) {
        await db.delete(profileRatings)
          .where(eq(profileRatings.id, linkedRatingId));
        
        // Update average rating after rating deletion
        await this.updateProfileAverageRating(profileId);
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting profile comment:", error);
      throw error;
    }
  }

  // ========== Profile Comment Reactions Methods ==========

  async addProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<any> {
    try {
      // Check if reaction already exists
      const existing = await db.select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.profileCommentId, commentId),
            eq(reactions.emoji, emoji)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        return existing[0]; // Already reacted with this emoji
      }
      
      // Add new reaction
      const result = await db.insert(reactions)
        .values({
          userId,
          profileCommentId: commentId,
          emoji,
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error adding profile comment reaction:", error);
      throw error;
    }
  }

  async removeProfileCommentReaction(userId: string, commentId: string, emoji: string): Promise<boolean> {
    try {
      const result = await db.delete(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.profileCommentId, commentId),
            eq(reactions.emoji, emoji)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error removing profile comment reaction:", error);
      throw error;
    }
  }

  async getProfileCommentReactions(commentId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]> {
    try {
      // Get all reactions for this comment grouped by emoji
      const allReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.profileCommentId, commentId));
      
      // Group by emoji and count
      const emojiCounts: Record<string, {count: number, userReacted: boolean}> = {};
      
      for (const reaction of allReactions) {
        if (!emojiCounts[reaction.emoji]) {
          emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
        }
        emojiCounts[reaction.emoji].count++;
        if (currentUserId && reaction.userId === currentUserId) {
          emojiCounts[reaction.emoji].userReacted = true;
        }
      }
      
      // Convert to array
      return Object.entries(emojiCounts).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      }));
    } catch (error) {
      console.error("Error getting profile comment reactions:", error);
      return [];
    }
  }

  async getCommentReactions(commentId: string, currentUserId?: string): Promise<{emoji: string, count: number, userReacted: boolean}[]> {
    try {
      // Get all reactions for this book comment grouped by emoji
      const allReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.commentId, commentId));
      
      // Group by emoji and count
      const emojiCounts: Record<string, {count: number, userReacted: boolean}> = {};
      
      for (const reaction of allReactions) {
        if (!emojiCounts[reaction.emoji]) {
          emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
        }
        emojiCounts[reaction.emoji].count++;
        if (currentUserId && reaction.userId === currentUserId) {
          emojiCounts[reaction.emoji].userReacted = true;
        }
      }
      
      // Convert to array
      return Object.entries(emojiCounts).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      }));
    } catch (error) {
      console.error("Error getting comment reactions:", error);
      return [];
    }
  }

  async addBookCommentReaction(userId: string, commentId: string, emoji: string): Promise<any> {
    try {
      // Check if reaction already exists
      const existing = await db.select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.commentId, commentId),
            eq(reactions.emoji, emoji)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        return existing[0]; // Already reacted with this emoji
      }
      
      // Add new reaction
      const result = await db.insert(reactions)
        .values({
          userId,
          commentId,
          emoji,
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error adding book comment reaction:", error);
      throw error;
    }
  }

  async removeBookCommentReaction(userId: string, commentId: string, emoji: string): Promise<boolean> {
    try {
      const result = await db.delete(reactions)
        .where(
          and(
            eq(reactions.userId, userId),
            eq(reactions.commentId, commentId),
            eq(reactions.emoji, emoji)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error removing book comment reaction:", error);
      throw error;
    }
  }

  // Rating system configuration methods
  async getRatingSystemConfig(): Promise<any> {
    try {
      const result = await db.select().from(ratingSystemConfig).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error("Error getting rating system config:", error);
      return null;
    }
  }

  async updateRatingSystemConfig(configData: {
    algorithmType?: string;
    priorMean?: number;
    priorWeight?: number;
    likesAlpha?: number;
    likesMaxWeight?: number;
    minTextWeight?: number;
    timeDecayEnabled?: boolean;
    timeDecayHalfLife?: number;
  }): Promise<any> {
    try {
      // Get existing config
      const existing = await db.select().from(ratingSystemConfig).limit(1);
      
      if (existing.length === 0) {
        // Create new config
        const result = await db.insert(ratingSystemConfig)
          .values({
            ...configData,
            updatedAt: new Date(),
          })
          .returning();
        return result[0];
      } else {
        // Update existing config
        const result = await db.update(ratingSystemConfig)
          .set({
            ...configData,
            updatedAt: new Date(),
          })
          .where(eq(ratingSystemConfig.id, existing[0].id))
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error updating rating system config:", error);
      throw error;
    }
  }

  async recalculateAllBookRatings(): Promise<{ success: boolean; booksUpdated: number }> {
    try {
      console.log("Starting recalculation of all book ratings...");
      
      // Get all books that have reviews
      const booksWithReviews = await db.select({
        bookId: reviews.bookId,
      })
      .from(reviews)
      .groupBy(reviews.bookId);
      
      console.log(`Found ${booksWithReviews.length} books with reviews`);
      
      let updatedCount = 0;
      
      // Update rating for each book
      for (const book of booksWithReviews) {
        await this.updateBookAverageRating(book.bookId);
        updatedCount++;
      }
      
      // Also reset rating to null for books without reviews
      const allBooks = await db.select({ id: books.id }).from(books);
      const bookIdsWithReviews = new Set(booksWithReviews.map(b => b.bookId));
      
      for (const book of allBooks) {
        if (!bookIdsWithReviews.has(book.id)) {
          await db.update(books)
            .set({ rating: null })
            .where(eq(books.id, book.id));
        }
      }
      
      console.log(`Recalculation complete. Updated ${updatedCount} books.`);
      
      return { success: true, booksUpdated: updatedCount };
    } catch (error) {
      console.error("Error recalculating all book ratings:", error);
      throw error;
    }
  }

  // User rating system methods
  async getUserRatingConfig(): Promise<any> {
    try {
      const result = await db.select().from(userRatingConfig).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error("Error getting user rating config:", error);
      return null;
    }
  }

  async updateUserRatingConfig(configData: Partial<typeof userRatingConfig.$inferInsert>): Promise<any> {
    try {
      // Get existing config
      const existing = await db.select().from(userRatingConfig).limit(1);
      
      if (existing.length === 0) {
        // Create new config
        const result = await db.insert(userRatingConfig)
          .values({
            ...configData,
            updatedAt: new Date(),
          })
          .returning();
        return result[0];
      } else {
        // Update existing config
        const result = await db.update(userRatingConfig)
          .set({
            ...configData,
            updatedAt: new Date(),
          })
          .where(eq(userRatingConfig.id, existing[0].id))
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error updating user rating config:", error);
      throw error;
    }
  }

  async recalculateAllUserRatings(): Promise<{ success: boolean; usersUpdated: number }> {
    try {
      console.log("Starting recalculation of all user profile ratings...");
      
      // Get all users that have ratings
      const usersWithRatings = await db.select({
        profileId: profileRatings.profileId,
      })
      .from(profileRatings)
      .groupBy(profileRatings.profileId);
      
      console.log(`Found ${usersWithRatings.length} users with ratings`);
      
      let updatedCount = 0;
      
      // Update rating for each user
      for (const user of usersWithRatings) {
        await this.updateProfileAverageRating(user.profileId);
        updatedCount++;
      }
      
      // Also reset rating to null for users without ratings
      const allUsers = await db.select({ id: users.id }).from(users);
      const userIdsWithRatings = new Set(usersWithRatings.map(u => u.profileId));
      
      for (const user of allUsers) {
        if (!userIdsWithRatings.has(user.id)) {
          await db.update(users)
            .set({ profileRating: null })
            .where(eq(users.id, user.id));
        }
      }
      
      console.log(`Recalculation complete. Updated ${updatedCount} user profiles.`);
      
      return { success: true, usersUpdated: updatedCount };
    } catch (error) {
      console.error("Error recalculating all user ratings:", error);
      throw error;
    }
  }
  
  async incrementProfileViewCount(userId: string): Promise<any> {
    try {
      const result = await db.update(users)
        .set({ 
          profileViewCount: sql`COALESCE(${users.profileViewCount}, 0) + 1`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (result.length === 0) {
        throw new Error('User not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error incrementing profile view count:", error);
      throw error;
    }
  }
  
  // ==================== ARTICLE METHODS ====================
  
  
  // Article category methods
  async createArticleCategory(categoryData: InsertArticleCategory): Promise<ArticleCategory> {
    try {
      const result = await db.insert(articleCategories).values(categoryData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating article category:", error);
      throw error;
    }
  }
  
  async getArticleCategories(): Promise<ArticleCategory[]> {
    try {
      // First get all categories
      const allCategories = await db.select()
        .from(articleCategories)
        .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.title));
      
      // Create a map to store the total counts for each category
      const categoryTotals: Record<string, { count: number; newCount: number }> = {};
      
      // Initialize all categories with zero counts
      allCategories.forEach(category => {
        categoryTotals[category.slug] = { count: 0, newCount: 0 };
      });
      
      // Get all published articles with their sections
      const allPublishedArticles = await db
        .select({
          section: articles.section,
          publishedAt: articles.publishedAt
        })
        .from(articles)
        .where(eq(articles.status, 'published'));
      
      // For each article, find its category and propagate counts up the hierarchy
      allPublishedArticles.forEach(article => {
        if (article.section) {
          const category = allCategories.find(cat => cat.slug === article.section);
          if (category) {
            // Increment count for the direct category
            if (categoryTotals[article.section]) {
              categoryTotals[article.section].count += 1;
              
              // Check if the article is recent (within 7 days)
              if (article.publishedAt) {
                const publishedDate = new Date(article.publishedAt);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                
                if (publishedDate >= sevenDaysAgo) {
                  categoryTotals[article.section].newCount += 1;
                }
              }
            }
            
            // Propagate count up the hierarchy to parent categories
            let parentId = category.parentId;
            while (parentId) {
              const parentCategory = allCategories.find(cat => cat.id === parentId);
              if (parentCategory) {
                if (categoryTotals[parentCategory.slug]) {
                  categoryTotals[parentCategory.slug].count += 1;
                  
                  // Also increment new count for parent if the article is recent
                  if (article.publishedAt) {
                    const publishedDate = new Date(article.publishedAt);
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    if (publishedDate >= sevenDaysAgo) {
                      categoryTotals[parentCategory.slug].newCount += 1;
                    }
                  }
                }
                parentId = parentCategory.parentId;
              } else {
                break;
              }
            }
          }
        }
      });
      
      // Extend categories with their counts
      const categoriesWithCounts = allCategories.map(category => {
        const counts = categoryTotals[category.slug] || { count: 0, newCount: 0 };
        return {
          ...category,
          articleCount: counts.count,
          newArticleCount: counts.newCount
        };
      });
      
      return categoriesWithCounts;
    } catch (error) {
      console.error("Error getting article categories:", error);
      throw error;
    }
  }
  
  async getArticleCategoryById(id: string): Promise<ArticleCategory | undefined> {
    try {
      const result = await db.select().from(articleCategories).where(eq(articleCategories.id, id));
      return result[0];
    } catch (error) {
      console.error("Error getting article category by ID:", error);
      return undefined;
    }
  }
  
  async updateArticleCategory(id: string, categoryData: Partial<InsertArticleCategory>): Promise<ArticleCategory> {
    try {
      const result = await db.update(articleCategories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(articleCategories.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Category not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error updating article category:", error);
      throw error;
    }
  }
  
  async deleteArticleCategory(id: string): Promise<boolean> {
    try {
      const result = await db.delete(articleCategories)
        .where(eq(articleCategories.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting article category:", error);
      return false;
    }
  }
  
  // Article tag methods
  async createArticleTag(tagData: InsertArticleTag): Promise<ArticleTag> {
    try {
      const result = await db.insert(articleTags).values(tagData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating article tag:", error);
      throw error;
    }
  }
  
  async getArticleTags(): Promise<ArticleTag[]> {
    try {
      return await db.select()
        .from(articleTags)
        .orderBy(asc(articleTags.name));
    } catch (error) {
      console.error("Error getting article tags:", error);
      throw error;
    }
  }
  
  async getOrCreateArticleTag(name: string): Promise<ArticleTag> {
    try {
      // Normalize tag name
      const normalizedName = name.trim().toLowerCase();
      const slug = normalizedName.replace(/[^a-z0-9]+/g, '-');
      
      // Try to find existing tag
      const existing = await db.select()
        .from(articleTags)
        .where(eq(articleTags.name, normalizedName))
        .limit(1);
      
      if (existing.length > 0) {
        return existing[0];
      }
      
      // Create new tag
      const result = await db.insert(articleTags)
        .values({
          name: normalizedName,
          slug
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error getting or creating article tag:", error);
      throw error;
    }
  }
  
  // Article view methods
  async recordArticleView(articleId: string, userId?: string, ip?: string, userAgent?: string): Promise<void> {
    try {
      // Create hashes for IP and user agent for privacy
      const ipHash = ip ? require('crypto').createHash('sha256').update(ip).digest('hex').substring(0, 32) : null;
      const userAgentHash = userAgent ? require('crypto').createHash('sha256').update(userAgent).digest('hex').substring(0, 32) : null;
      
      // Insert view record
      await db.insert(articleViews)
        .values({
          articleId,
          userId: userId || null,
          ipHash,
          userAgentHash
        });
      
      // Increment view count
      await db.update(articles)
        .set({
          views: sql`COALESCE(${articles.views}, 0) + 1`
        })
        .where(eq(articles.id, articleId));
    } catch (error) {
      console.error("Error recording article view:", error);
      // Don't throw - view recording shouldn't break the main functionality
    }
  }
  
  async getArticleViewCount(articleId: string): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(articleViews)
        .where(eq(articleViews.articleId, articleId));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting article view count:", error);
      return 0;
    }
  }
  
  // Read later methods
  async addArticleToReadLater(userId: string, articleId: string): Promise<void> {
    try {
      await db.insert(articleReadLater)
        .values({
          userId,
          articleId,
          createdAt: new Date()
        })
        .onConflictDoNothing(); // Prevent duplicates
    } catch (error) {
      console.error("Error adding article to read later:", error);
      throw error;
    }
  }
  
  async removeArticleFromReadLater(userId: string, articleId: string): Promise<boolean> {
    try {
      const result = await db.delete(articleReadLater)
        .where(and(
          eq(articleReadLater.userId, userId),
          eq(articleReadLater.articleId, articleId)
        ));
      
      return true;
    } catch (error) {
      console.error("Error removing article from read later:", error);
      return false;
    }
  }
  
  async getUserReadLaterArticles(params: {
    userId: string;
    page: number;
    limit: number;
    sortBy?: "savedAt" | "publishedAt" | "createdAt" | "views";
    sortOrder?: "asc" | "desc";
  }): Promise<{
    articles: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 12));
    const offset = (page - 1) * limit;

    const sortBy = params.sortBy ?? "savedAt";
    const sortOrder = params.sortOrder ?? "desc";

    // 1) Where: only articles that are in read-later for the user
    const where = eq(articleReadLater.userId, params.userId);

    // 2) OrderBy
    // savedAt = time added to read-later
    let sortColumn: any;
    switch (sortBy) {
      case "publishedAt":
        sortColumn = articles.publishedAt;
        break;
      case "createdAt":
        sortColumn = articles.createdAt;
        break;
      case "views":
        sortColumn = articles.views;
        break;
      case "savedAt":
      default:
        sortColumn = articleReadLater.createdAt;
        break;
    }

    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    // 3) Get the base rows: article + author + savedAt
    const rows = await db
      .select({
        // article fields (card)
        id: articles.id,
        authorUserId: articles.authorUserId,
        section: articles.section,
        format: articles.format,
        status: articles.status,
        lang: articles.lang,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        coverImageUrl: articles.coverImageUrl,
        views: articles.views,
        commentsCount: articles.commentsCount,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,

        // author
        authorId: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,

        // read-later metadata
        savedAt: articleReadLater.createdAt,
      })
      .from(articleReadLater)
      .innerJoin(articles, eq(articles.id, articleReadLater.articleId))
      .leftJoin(users, eq(users.id, articles.authorUserId))
      .where(where)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    const articleIds = rows.map(r => r.id);

    // 4) Batch: tags for all articleIds
    const tagsByArticleId = new Map<string, any[]>();

    if (articleIds.length) {
      const tagRows = await db
        .select({
          articleId: articleTagLinks.articleId,
          id: articleTags.id,
          axis: articleTags.axis,
          name: articleTags.name,
          slug: articleTags.slug,
        })
        .from(articleTagLinks)
        .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
        .where(inArray(articleTagLinks.articleId, articleIds))
        .orderBy(asc(articleTags.name));

      for (const tr of tagRows) {
        const arr = tagsByArticleId.get(tr.articleId) ?? [];
        arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
        tagsByArticleId.set(tr.articleId, arr);
      }
    }

    // 5) DTO: like in the feed + isReadLater=true
    const dto = rows.map(r => ({
      id: r.id,
      authorUserId: r.authorUserId,
      section: r.section,
      format: r.format,
      status: r.status,
      lang: r.lang,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverImageUrl: r.coverImageUrl,
      views: r.views,
      commentsCount: r.commentsCount,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,

      author: r.authorId
        ? {
            id: r.authorId,
            username: r.username,
            fullName: r.fullName,
            avatarUrl: r.avatarUrl,
          }
        : undefined,

      tags: tagsByArticleId.get(r.id) ?? [],
      isReadLater: true,

      // can return savedAt, if want to show "added at that time"
      savedAt: r.savedAt,
    }));

    // 6) total + totalPages (important: count can be bigint)
    const countRes = await db
      .select({ count: count() })
      .from(articleReadLater)
      .where(eq(articleReadLater.userId, params.userId));

    const total = Number(countRes[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { articles: dto, total, page, limit, totalPages };
  }
  
  // Article-book associations
  async getArticlesByBook(params: {
    bookId: string;
    page: number;
    limit: number;
    role?: "primary" | "in_list" | "mentioned";
    sortBy?: "publishedAt" | "createdAt" | "views" | "sortOrder";
    sortOrder?: "asc" | "desc";
    userId?: string;
  }): Promise<{
    articles: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 12));
    const offset = (page - 1) * limit;

    const sortBy = params.sortBy ?? "publishedAt";
    const sortOrder = params.sortOrder ?? "desc";

    const conditions: any[] = [
      eq(articleBooks.bookId, params.bookId),
      eq(articles.status, "published"),
    ];
    if (params.role) conditions.push(eq(articleBooks.role, params.role));

    const where = and(...conditions);

    let sortColumn: any;
    switch (sortBy) {
      case "views":
        sortColumn = articles.views;
        break;
      case "createdAt":
        sortColumn = articles.createdAt;
        break;
      case "sortOrder":
        sortColumn = articleBooks.sortOrder;
        break;
      case "publishedAt":
      default:
        sortColumn = articles.publishedAt;
        break;
    }

    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    // 1) Base rows: article_books -> articles -> users
    const rows = await db
      .select({
        id: articles.id,
        authorUserId: articles.authorUserId,
        section: articles.section,
        format: articles.format,
        status: articles.status,
        lang: articles.lang,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        coverImageUrl: articles.coverImageUrl,
        views: articles.views,
        commentsCount: articles.commentsCount,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,

        authorId: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,

        linkRole: articleBooks.role,
        linkSortOrder: articleBooks.sortOrder,
      })
      .from(articleBooks)
      .innerJoin(articles, eq(articles.id, articleBooks.articleId))
      .leftJoin(users, eq(users.id, articles.authorUserId))
      .where(where)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    const articleIds = rows.map(r => r.id);

    // 2) Tags batch
    const tagsByArticleId = new Map<string, any[]>();
    if (articleIds.length) {
      const tagRows = await db
        .select({
          articleId: articleTagLinks.articleId,
          id: articleTags.id,
          axis: articleTags.axis,
          name: articleTags.name,
          slug: articleTags.slug,
        })
        .from(articleTagLinks)
        .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
        .where(inArray(articleTagLinks.articleId, articleIds))
        .orderBy(asc(articleTags.name));

      for (const tr of tagRows) {
        const arr = tagsByArticleId.get(tr.articleId) ?? [];
        arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
        tagsByArticleId.set(tr.articleId, arr);
      }
    }

    // 3) isReadLater batch
    let readLaterSet: Set<string> | null = null;
    if (params.userId && articleIds.length) {
      const rlRows = await db
        .select({ articleId: articleReadLater.articleId })
        .from(articleReadLater)
        .where(
          and(
            eq(articleReadLater.userId, params.userId),
            inArray(articleReadLater.articleId, articleIds)
          )
        );

      readLaterSet = new Set(rlRows.map(r => r.articleId));
    }

    // 4) DTO
    const articlesDto = rows.map(r => ({
      id: r.id,
      authorUserId: r.authorUserId,
      section: r.section,
      format: r.format,
      status: r.status,
      lang: r.lang,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverImageUrl: r.coverImageUrl,
      views: r.views,
      commentsCount: r.commentsCount,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,

      author: r.authorId
        ? { id: r.authorId, username: r.username, fullName: r.fullName, avatarUrl: r.avatarUrl }
        : undefined,

      tags: tagsByArticleId.get(r.id) ?? [],
      isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,

      bookLink: { role: r.linkRole, sortOrder: r.linkSortOrder },
    }));

    // 5) Count (important: Number(...) because of bigint)
    const countRes = await db
      .select({ count: count() })
      .from(articleBooks)
      .innerJoin(articles, eq(articles.id, articleBooks.articleId))
      .where(where);

    const total = Number(countRes[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { articles: articlesDto, total, page, limit, totalPages };
  }
  
  async attachBooksToArticle(articleId: string, bookIds: string[], roles?: string[]): Promise<void> {
    try {
      // Remove existing associations
      await db.delete(articleBooks)
        .where(eq(articleBooks.articleId, articleId));
      
      // Add new associations
      if (bookIds.length > 0) {
        const values = bookIds.map((bookId, index) => ({
          articleId,
          bookId,
          role: roles && roles[index] ? roles[index] : 'mentioned', // Default to 'mentioned' if no role provided
          sortOrder: index
        }));
        
        await db.insert(articleBooks).values(values);
      }
    } catch (error) {
      console.error("Error attaching books to article:", error);
      throw error;
    }
  }
  
  async getArticleAttachedBooks(articleId: string): Promise<any[]> {
    try {
      return await db.select({
        id: books.id,
        title: books.title,
        author: books.author,
        coverImageUrl: books.coverImageUrl,
        role: articleBooks.role,
        sortOrder: articleBooks.sortOrder
      })
      .from(articleBooks)
      .innerJoin(books, eq(articleBooks.bookId, books.id))
      .where(eq(articleBooks.articleId, articleId))
      .orderBy(asc(articleBooks.sortOrder));
    } catch (error) {
      console.error("Error getting article attached books:", error);
      return [];
    }
  }
  
  // Article-tag associations
  async attachTagsToArticle(articleId: string, tagNames: string[]): Promise<void> {
    try {
      // Remove existing associations
      await db.delete(articleTagLinks)
        .where(eq(articleTagLinks.articleId, articleId));
      
      // Process each tag
      for (const tagName of tagNames) {
        if (tagName.trim()) {
          const tag = await this.getOrCreateArticleTag(tagName);
          
          await db.insert(articleTagLinks)
            .values({
              articleId,
              tagId: tag.id
            })
            .onConflictDoNothing(); // Prevent duplicates
        }
      }
    } catch (error) {
      console.error("Error attaching tags to article:", error);
      throw error;
    }
  }
  
  async getArticleTagsByArticleId(articleId: string): Promise<ArticleTag[]> {
    try {
      return await db.select({
        id: articleTags.id,
        name: articleTags.name,
        slug: articleTags.slug,
        createdAt: articleTags.createdAt
      })
      .from(articleTagLinks)
      .innerJoin(articleTags, eq(articleTagLinks.tagId, articleTags.id))
      .where(eq(articleTagLinks.articleId, articleId))
      .orderBy(asc(articleTags.name));
    } catch (error) {
      console.error("Error getting article tags:", error);
      return [];
    }
  }
  
  // Core Article Methods
  async createArticle(articleData: InsertArticle): Promise<Article> {
    try {
      // Extract tags and books from articleData before inserting
      const { tags, bookIds, bookRoles, ...articleDataWithoutRelations } = articleData as any;
      
      // Generate slug if not provided
      let slug = articleDataWithoutRelations.slug;
      if (!slug) {
        slug = articleDataWithoutRelations.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        // Ensure uniqueness
        let uniqueSlug = slug;
        let counter = 1;
        while (true) {
          const existing = await db.select()
            .from(articles)
            .where(eq(articles.slug, uniqueSlug))
            .limit(1);
          
          if (existing.length === 0) break;
          uniqueSlug = `${slug}-${counter++}`;
        }
        slug = uniqueSlug;
      }
      
      const result = await db.insert(articles)
        .values({
          ...articleDataWithoutRelations,
          slug
        })
        .returning();
      
      const article = result[0];
      
      // Attach tags and books if provided
      if (tags && tags.length > 0) {
        await this.attachTagsToArticle(article.id, tags);
      }
      if (bookIds && bookIds.length > 0) {
        await this.attachBooksToArticle(article.id, bookIds, bookRoles);
      }
      
      return article;
    } catch (error) {
      console.error("Error creating article:", error);
      throw error;
    }
  }
  
  async getArticleById(id: string, currentUserId?: string): Promise<Article | undefined> {
    try {
      const result = await db.select()
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);
      
      if (result.length === 0) return undefined;
      return result[0];
    } catch (error) {
      console.error("Error getting article by ID:", error);
      return undefined;
    }
  }
  
  async getArticleBySlug(slug: string, currentUserId?: string): Promise<Article | undefined> {
    try {
      const result = await db.select()
        .from(articles)
        .where(eq(articles.slug, slug))
        .limit(1);
      
      if (result.length === 0) return undefined;
      return result[0];
    } catch (error) {
      console.error("Error getting article by slug:", error);
      return undefined;
    }
  }
  
  async getArticles(options?: { 
    page?: number; 
    limit?: number; 
    section?: string; 
    format?: string; 
    tagId?: string; 
    authorId?: string; 
    status?: string; 
    search?: string; 
    sortBy?: string;
    sortDirection?: 'asc' | 'desc'
  }): Promise<{ articles: any[]; total: number }> {
    try {
      const opts = {
        page: options?.page || 1,
        limit: options?.limit || 20,
        section: options?.section,
        format: options?.format,
        tagId: options?.tagId,
        authorId: options?.authorId,
        status: options?.status,
        search: options?.search,
        sortBy: options?.sortBy || 'createdAt',
        sortDirection: options?.sortDirection || 'desc'
      };
      
      const offset = (opts.page - 1) * opts.limit;
      
      // Build conditions array to properly combine filters
      const conditions: any[] = [eq(articles.status, 'published')];
      
      if (opts.section) {
        // Match exact section OR sections that start with the section + dot (subcategories)
        conditions.push(
          or(
            eq(articles.section, opts.section),
            like(articles.section, `${opts.section}.%`)
          )
        );
      }
      
      if (opts.format) {
        conditions.push(eq(articles.format, opts.format));
      }
      
      if (opts.authorId) {
        conditions.push(eq(articles.authorUserId, opts.authorId));
      }
      
      if (opts.status) {
        conditions.push(eq(articles.status, opts.status));
      }
      
      if (opts.search) {
        conditions.push(
          or(
            ilike(articles.title, `%${opts.search}%`),
            ilike(articles.excerpt, `%${opts.search}%`)
          )
        );
      }
      
      const whereClause = and(...conditions);
      
      // Build query with proper where clause and author information
      let query = db.select({
        id: articles.id,
        authorUserId: articles.authorUserId,
        section: articles.section,
        format: articles.format,
        status: articles.status,
        lang: articles.lang,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        coverImageUrl: articles.coverImageUrl,
        views: articles.views,
        commentsCount: articles.commentsCount,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        
        authorId: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      }).from(articles).leftJoin(users, eq(articles.authorUserId, users.id)).where(whereClause);
      
      // Apply sorting
      const sortColumn = opts.sortBy === 'publishedAt' ? articles.publishedAt : articles.createdAt;
      query = opts.sortDirection === 'asc' ? query.orderBy(asc(sortColumn)) : query.orderBy(desc(sortColumn));
      
      // Get total count
      let countQuery = db.select({ count: count() }).from(articles);
      
      // Apply same filters to count query
      const countConditions = [eq(articles.status, 'published')];
      
      if (opts.section) {
        // Match exact section OR sections that start with the section + dot (subcategories)
        countConditions.push(
          or(
            eq(articles.section, opts.section),
            like(articles.section, `${opts.section}.%`)
          )
        );
      }
      
      if (opts.format) {
        countConditions.push(eq(articles.format, opts.format));
      }
      
      if (opts.authorId) {
        countConditions.push(eq(articles.authorUserId, opts.authorId));
      }
      
      if (opts.status) {
        countConditions.push(eq(articles.status, opts.status));
      }
      
      if (opts.search) {
        countConditions.push(
          or(
            ilike(articles.title, `%${opts.search}%`),
            ilike(articles.excerpt, `%${opts.search}%`)
          )
        );
      }
      
      if (countConditions.length > 0) {
        countQuery = countQuery.where(and(...countConditions));
      }
      
      const countResult = await countQuery;
      const total = countResult[0]?.count || 0;
      
      // Get articles with pagination
      const baseArticles = await query.limit(opts.limit).offset(offset);
      
      // Get article IDs for batch processing
      const articleIds = baseArticles.map(r => r.id);
      
      // Batch: tags for all articles
      const tagsByArticleId = new Map<string, any[]>();
      if (articleIds.length > 0) {
        const tagRows = await db
          .select({
            articleId: articleTagLinks.articleId,
            id: articleTags.id,
            axis: articleTags.axis,
            name: articleTags.name,
            slug: articleTags.slug,
          })
          .from(articleTagLinks)
          .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
          .where(inArray(articleTagLinks.articleId, articleIds))
          .orderBy(asc(articleTags.name));

        for (const tr of tagRows) {
          const arr = tagsByArticleId.get(tr.articleId) ?? [];
          arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
          tagsByArticleId.set(tr.articleId, arr);
        }
      }

      // Batch: isReadLater
      let readLaterSet: Set<string> | null = null;
      if (opts.authorId && articleIds.length > 0) {
        const rlRows = await db
          .select({ articleId: articleReadLater.articleId })
          .from(articleReadLater)
          .where(and(
            eq(articleReadLater.userId, opts.authorId),
            inArray(articleReadLater.articleId, articleIds)
          ));

        readLaterSet = new Set(rlRows.map(r => r.articleId));
      }

      // Format DTO "like in detail"
      const dto = baseArticles.map(r => ({
        id: r.id,
        authorUserId: r.authorUserId,
        section: r.section,
        format: r.format,
        status: r.status,
        lang: r.lang,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        coverImageUrl: r.coverImageUrl,
        views: r.views,
        commentsCount: r.commentsCount,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,

        author: r.authorId ? {
          id: r.authorId,
          username: r.username,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
        } : undefined,

        tags: tagsByArticleId.get(r.id) ?? [],
        isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,
      }));
      
      return { articles: dto, total };
    } catch (error) {
      console.error("Error getting articles:", error);
      throw error;
    }
  }
  
  async updateArticle(id: string, articleData: Partial<InsertArticle>): Promise<Article> {
    try {
      // Extract tags and books from articleData before updating
      const { tags, bookIds, bookRoles, ...articleDataWithoutRelations } = articleData as any;
      
      const result = await db.update(articles)
        .set({ ...articleDataWithoutRelations, updatedAt: new Date() })
        .where(eq(articles.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Article not found');
      }
      
      const article = result[0];
      
      // Update tags and books if provided
      if (tags !== undefined) {
        // Clear existing tags and add new ones
        await db.delete(articleTagLinks).where(eq(articleTagLinks.articleId, article.id));
        if (tags && tags.length > 0) {
          await this.attachTagsToArticle(article.id, tags);
        }
      }
      if (bookIds !== undefined) {
        // Clear existing books and add new ones
        await db.delete(articleBooks).where(eq(articleBooks.articleId, article.id));
        if (bookIds && bookIds.length > 0) {
          await this.attachBooksToArticle(article.id, bookIds, bookRoles);
        }
      }
      
      return article;
    } catch (error) {
      console.error("Error updating article:", error);
      throw error;
    }
  }
  
  async deleteArticle(id: string, userId: string | null): Promise<boolean> {
    try {
      const conditions = [eq(articles.id, id)];
      if (userId) {
        conditions.push(eq(articles.authorUserId, userId));
      }
      
      const result = await db.delete(articles)
        .where(and(...conditions))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting article:", error);
      return false;
    }
  }
  

  
  async publishArticle(id: string): Promise<Article> {
    try {
      const result = await db.update(articles)
        .set({ 
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(articles.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Article not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error publishing article:", error);
      throw error;
    }
  }
  
  async unpublishArticle(id: string): Promise<Article> {
    try {
      const result = await db.update(articles)
        .set({ 
          status: 'draft',
          publishedAt: null,
          updatedAt: new Date()
        })
        .where(eq(articles.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Article not found');
      }
      
      return result[0];
    } catch (error) {
      console.error("Error unpublishing article:", error);
      throw error;
    }
  }
  
  // Additional helper methods for API routes
  async getArticle(identifier: string, userId?: string): Promise<ArticleWithRelations | undefined> {
    try {
      // Try by ID first, then by slug
      let article = await this.getArticleById(identifier, userId);
      if (!article) {
        article = await this.getArticleBySlug(identifier, userId);
      }
      
      if (!article) return undefined;
      
      // Get author information
      let author: User | undefined;
      if (article.authorUserId) {
        author = await this.getUser(article.authorUserId);
      }
      
      // Get tags
      const tags = await this.getArticleTagsByArticleId(article.id);
      
      // Get attached books
      const attachedBooks = await this.getArticleAttachedBooks(article.id);
      
      // Check if article is in read later for the user
      let isReadLater = false;
      if (userId) {
        const readLaterResult = await db.select({ count: count() })
          .from(articleReadLater)
          .where(and(
            eq(articleReadLater.userId, userId),
            eq(articleReadLater.articleId, article.id)
          ));
        isReadLater = (readLaterResult[0]?.count || 0) > 0;
      }
      
      // Get bookmark count
      const bookmarkCount = await this.getArticleBookmarkCount(article.id);
      
      // Combine article with relations
      const articleWithRelations: ArticleWithRelations = {
        ...article,
        author,
        tags,
        attachedBooks,
        isReadLater,
        bookmarkCount
      };
      
      // Increment view count when article is retrieved
      try {
        // Use the article's ID to increment the view count
        this.registerArticleView(article.id, undefined, undefined, undefined).catch(err => {
          console.error('Error incrementing view count:', err);
          // Don't throw - view counting shouldn't break the main functionality
        });
      } catch (viewError) {
        console.error('Error preparing view count increment:', viewError);
      }
      
      return articleWithRelations;
    } catch (error) {
      console.error("Error getting article with relations:", error);
      return undefined;
    }
  }
  
  async listArticlesByMultipleSections(params: {
    page: number;
    limit: number;
    sections: string[];
    format?: string; // New enum field
    searchQuery?: string;
    sortBy: 'publishedAt' | 'createdAt' | 'views';
    sortOrder: 'asc' | 'desc';
    userId?: string;
  }): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(50, Math.max(1, params.limit ?? 12));
      const offset = (page - 1) * limit;

      // 1) Conditions (important: where should not be overridden)
      const conditions: any[] = [eq(articles.status, 'published')];

      if (params.sections && params.sections.length > 0) {
        // For each section, match exact section OR sections that start with the section + dot (subcategories)
        const sectionConditions = [];
        for (const section of params.sections) {
          sectionConditions.push(
            or(
              eq(articles.section, section),
              like(articles.section, `${section}.%`)
            )
          );
        }
        conditions.push(or(...sectionConditions));
      }
      if (params.format) conditions.push(eq(articles.format, params.format));

      if (params.searchQuery?.trim()) {
        const q = `%${params.searchQuery.trim()}%`;
        conditions.push(
          or(
            ilike(articles.title, q),
            ilike(articles.excerpt, q),
            ilike(articles.searchText, q),
          )
        );
      }

      const where = and(...conditions);

      // 2) Sort
      let sortColumn: any;
      switch (params.sortBy) {
        case 'publishedAt':
          sortColumn = articles.publishedAt;
          break;
        case 'views':
          sortColumn = articles.views;
          break;
        default:
          sortColumn = articles.createdAt;
      }

      const orderByExpr = params.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // 3) Base list: article + author (without heavy fields)
      const rows = await db
        .select({
          id: articles.id,
          authorUserId: articles.authorUserId,
          section: articles.section,
          format: articles.format,
          status: articles.status,
          lang: articles.lang,
          title: articles.title,
          slug: articles.slug,
          excerpt: articles.excerpt,
          coverImageUrl: articles.coverImageUrl,
          views: articles.views,
          commentsCount: articles.commentsCount,
          publishedAt: articles.publishedAt,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,

          // author (IMPORTANT: get id, otherwise author is always undefined)
          authorId: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        })
        .from(articles)
        .leftJoin(users, eq(users.id, articles.authorUserId))
        .where(where)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset(offset);

      const articleIds = rows.map(r => r.id);

      // 4) Batch: tags
      const tagsByArticleId = new Map<string, any[]>();
      if (articleIds.length) {
        const tagRows = await db
          .select({
            articleId: articleTagLinks.articleId,
            id: articleTags.id,
            axis: articleTags.axis,
            name: articleTags.name,
            slug: articleTags.slug,
          })
          .from(articleTagLinks)
          .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
          .where(inArray(articleTagLinks.articleId, articleIds))
          .orderBy(asc(articleTags.name));

        for (const tr of tagRows) {
          const arr = tagsByArticleId.get(tr.articleId) ?? [];
          arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
          tagsByArticleId.set(tr.articleId, arr);
        }
      }

      // 5) Batch: isReadLater
      let readLaterSet: Set<string> | null = null;
      if (params.userId && articleIds.length) {
        const rlRows = await db
          .select({ articleId: articleReadLater.articleId })
          .from(articleReadLater)
          .where(
            and(
              eq(articleReadLater.userId, params.userId),
              inArray(articleReadLater.articleId, articleIds)
            )
          );

        readLaterSet = new Set(rlRows.map(r => r.articleId));
      }
      
      // 6) Batch: bookmark counts for each article
      let bookmarkCounts: Record<string, number> = {};
      if (articleIds.length) {
        const bookmarkCountRows = await db
          .select({
            articleId: articleReadLater.articleId,
            count: count()
          })
          .from(articleReadLater)
          .where(inArray(articleReadLater.articleId, articleIds))
          .groupBy(articleReadLater.articleId);
          
        for (const row of bookmarkCountRows) {
          bookmarkCounts[row.articleId] = Number(row.count);
        }
      }
      
      // 7) DTO
      const dto = rows.map(r => ({
        id: r.id,
        authorUserId: r.authorUserId,
        section: r.section,
        format: r.format,
        status: r.status,
        lang: r.lang,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        coverImageUrl: r.coverImageUrl,
        views: r.views,
        commentsCount: r.commentsCount,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,

        author: r.authorId
          ? {
              id: r.authorId,
              username: r.username,
              fullName: r.fullName,
              avatarUrl: r.avatarUrl,
            }
          : undefined,

        tags: tagsByArticleId.get(r.id) ?? [],
        isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,
        bookmarkCount: bookmarkCounts[r.id] || 0,
      }));

      // 6) total + totalPages (important: count can be bigint)
      const countQuery = db.select({ count: count() }).from(articles).where(eq(articles.status, 'published'));
      
      if (params.sections && params.sections.length > 0) {
        countQuery.where(and(eq(articles.status, 'published'), inArray(articles.section, params.sections)));
      }
      
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return { articles: dto, total, page, limit, totalPages };
    } catch (error) {
      console.error("Error listing articles by multiple sections:", error);
      throw error;
    }
  }
  
  async listArticles(params: {
    page: number;
    limit: number;
    section?: string; // New enum field
    format?: string; // New enum field
    searchQuery?: string;
    sortBy: 'publishedAt' | 'createdAt' | 'views';
    sortOrder: 'asc' | 'desc';
    userId?: string;
  }): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(50, Math.max(1, params.limit ?? 12));
      const offset = (page - 1) * limit;

      // 1) Conditions (important: where should not be overridden)
      const conditions: any[] = [eq(articles.status, 'published')];

      if (params.section) {
        // Match exact section OR sections that start with the section + dot (subcategories)
        conditions.push(
          or(
            eq(articles.section, params.section),
            like(articles.section, `${params.section}.%`)
          )
        );
      }
      if (params.format) conditions.push(eq(articles.format, params.format));

      if (params.searchQuery?.trim()) {
        const q = `%${params.searchQuery.trim()}%`;
        conditions.push(
          or(
            ilike(articles.title, q),
            ilike(articles.excerpt, q),
            ilike(articles.searchText, q),
          )
        );
      }

      const where = and(...conditions);

      // 2) Sort
      let sortColumn: any;
      switch (params.sortBy) {
        case 'publishedAt':
          sortColumn = articles.publishedAt;
          break;
        case 'views':
          sortColumn = articles.views;
          break;
        default:
          sortColumn = articles.createdAt;
      }

      const orderByExpr = params.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // 3) Base list: article + author (without heavy fields)
      const rows = await db
        .select({
          id: articles.id,
          authorUserId: articles.authorUserId,
          section: articles.section,
          format: articles.format,
          status: articles.status,
          lang: articles.lang,
          title: articles.title,
          slug: articles.slug,
          excerpt: articles.excerpt,
          coverImageUrl: articles.coverImageUrl,
          views: articles.views,
          commentsCount: articles.commentsCount,
          publishedAt: articles.publishedAt,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,

          // author (IMPORTANT: get id, otherwise author is always undefined)
          authorId: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        })
        .from(articles)
        .leftJoin(users, eq(users.id, articles.authorUserId))
        .where(where)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset(offset);

      const articleIds = rows.map(r => r.id);

      // 4) Batch: tags
      const tagsByArticleId = new Map<string, any[]>();
      if (articleIds.length) {
        const tagRows = await db
          .select({
            articleId: articleTagLinks.articleId,
            id: articleTags.id,
            axis: articleTags.axis,
            name: articleTags.name,
            slug: articleTags.slug,
          })
          .from(articleTagLinks)
          .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
          .where(inArray(articleTagLinks.articleId, articleIds))
          .orderBy(asc(articleTags.name));

        for (const tr of tagRows) {
          const arr = tagsByArticleId.get(tr.articleId) ?? [];
          arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
          tagsByArticleId.set(tr.articleId, arr);
        }
      }

      // 5) Batch: isReadLater
      let readLaterSet: Set<string> | null = null;
      if (params.userId && articleIds.length) {
        const rlRows = await db
          .select({ articleId: articleReadLater.articleId })
          .from(articleReadLater)
          .where(
            and(
              eq(articleReadLater.userId, params.userId),
              inArray(articleReadLater.articleId, articleIds)
            )
          );

        readLaterSet = new Set(rlRows.map(r => r.articleId));
      }
      
      // 6) Batch: bookmark counts for each article
      let bookmarkCounts: Record<string, number> = {};
      if (articleIds.length) {
        const bookmarkCountRows = await db
          .select({
            articleId: articleReadLater.articleId,
            count: count()
          })
          .from(articleReadLater)
          .where(inArray(articleReadLater.articleId, articleIds))
          .groupBy(articleReadLater.articleId);
          
        for (const row of bookmarkCountRows) {
          bookmarkCounts[row.articleId] = Number(row.count);
        }
      }

      // 7) DTO: exactly what front needs (author + tags + isReadLater + bookmarkCount)
      const dto = rows.map(r => ({
        id: r.id,
        authorUserId: r.authorUserId,
        section: r.section,
        format: r.format,
        status: r.status,
        lang: r.lang,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        coverImageUrl: r.coverImageUrl,
        views: r.views,
        commentsCount: r.commentsCount,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,

        author: r.authorId
          ? {
              id: r.authorId,
              username: r.username,
              fullName: r.fullName,
              avatarUrl: r.avatarUrl,
            }
          : undefined,

        tags: tagsByArticleId.get(r.id) ?? [],
        isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,
        bookmarkCount: bookmarkCounts[r.id] || 0,
      }));

      // 7) total + totalPages (count can be bigint)
      const countRes = await db
        .select({ count: count() })
        .from(articles)
        .where(where);

      const total = Number(countRes[0]?.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return { articles: dto, total, page, limit, totalPages };
    } catch (error) {
      console.error("Error listing articles:", error);
      throw error;
    }
  }
  
  async listFavoriteArticles(params: {
    page: number;
    limit: number;
    userId: string;
    searchQuery?: string;
    sortBy: 'publishedAt' | 'createdAt' | 'views';
    sortOrder: 'asc' | 'desc';
  }): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(50, Math.max(1, params.limit ?? 12));
      const offset = (page - 1) * limit;

      // Join articles with read later table to get only favorited articles
      const conditions: any[] = [
        eq(articles.status, 'published'),
        eq(articleReadLater.userId, params.userId)
      ];

      if (params.searchQuery?.trim()) {
        const q = `%${params.searchQuery.trim()}%`;
        conditions.push(
          or(
            ilike(articles.title, q),
            ilike(articles.excerpt, q),
            ilike(articles.searchText, q),
          )
        );
      }

      const where = and(...conditions);

      // Sort
      let sortColumn: any;
      switch (params.sortBy) {
        case 'publishedAt':
          sortColumn = articles.publishedAt;
          break;
        case 'views':
          sortColumn = articles.views;
          break;
        default:
          sortColumn = articles.createdAt;
      }

      const orderByExpr = params.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Query articles joined with read later table
      const rows = await db
        .select({
          id: articles.id,
          authorUserId: articles.authorUserId,
          section: articles.section,
          format: articles.format,
          status: articles.status,
          lang: articles.lang,
          title: articles.title,
          slug: articles.slug,
          excerpt: articles.excerpt,
          coverImageUrl: articles.coverImageUrl,
          views: articles.views,
          commentsCount: articles.commentsCount,
          publishedAt: articles.publishedAt,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,

          // author
          authorId: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        })
        .from(articles)
        .innerJoin(articleReadLater, eq(articleReadLater.articleId, articles.id))
        .leftJoin(users, eq(users.id, articles.authorUserId))
        .where(where)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset(offset);

      const articleIds = rows.map(r => r.id);

      // Batch: tags
      const tagsByArticleId = new Map<string, any[]>();
      if (articleIds.length) {
        const tagRows = await db
          .select({
            articleId: articleTagLinks.articleId,
            id: articleTags.id,
            axis: articleTags.axis,
            name: articleTags.name,
            slug: articleTags.slug,
          })
          .from(articleTagLinks)
          .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
          .where(inArray(articleTagLinks.articleId, articleIds))
          .orderBy(asc(articleTags.name));

        for (const tr of tagRows) {
          const arr = tagsByArticleId.get(tr.articleId) ?? [];
          arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
          tagsByArticleId.set(tr.articleId, arr);
        }
      }

      // For favorites, all articles are marked as read later by the current user
      const readLaterSet = new Set(articleIds);
      
      // Batch: bookmark counts for each article
      let bookmarkCounts: Record<string, number> = {};
      if (articleIds.length) {
        const bookmarkCountRows = await db
          .select({
            articleId: articleReadLater.articleId,
            count: count()
          })
          .from(articleReadLater)
          .where(inArray(articleReadLater.articleId, articleIds))
          .groupBy(articleReadLater.articleId);
          
        for (const row of bookmarkCountRows) {
          bookmarkCounts[row.articleId] = Number(row.count);
        }
      }

      // DTO
      const dto = rows.map(r => ({
        id: r.id,
        authorUserId: r.authorUserId,
        section: r.section,
        format: r.format,
        status: r.status,
        lang: r.lang,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        coverImageUrl: r.coverImageUrl,
        views: r.views,
        commentsCount: r.commentsCount,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,

        author: r.authorId
          ? {
              id: r.authorId,
              username: r.username,
              fullName: r.fullName,
              avatarUrl: r.avatarUrl,
            }
          : undefined,

        tags: tagsByArticleId.get(r.id) ?? [],
        isReadLater: true, // All returned articles are in read later for this user
        bookmarkCount: bookmarkCounts[r.id] || 0,
      }));

      // Total count
      const countRes = await db
        .select({ count: count() })
        .from(articles)
        .innerJoin(articleReadLater, eq(articleReadLater.articleId, articles.id))
        .where(where);

      const total = Number(countRes[0]?.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return { articles: dto, total, page, limit, totalPages };
    } catch (error) {
      console.error("Error listing favorite articles:", error);
      throw error;
    }
  }
  
  async registerArticleView(id: string, userAgent: string, referrer: string): Promise<void> {
    try {
      // Record the view
      await this.recordArticleView(id, undefined, undefined, userAgent);
    } catch (error) {
      console.error("Error registering article view:", error);
      // Don't throw - view registration shouldn't break the main functionality
    }
  }
  
  async createArticleReply(replyData: InsertArticle): Promise<Article> {
    try {
      // Ensure it's marked as a reply
      const articleData = {
        ...replyData,
        status: 'published',
        publishedAt: new Date()
      } as InsertArticle;
      
      return await this.createArticle(articleData);
    } catch (error) {
      console.error("Error creating article reply:", error);
      throw error;
    }
  }
  
  async getArticleReplies(articleId: string, page: number, limit: number, userId?: string): Promise<{ articles: Article[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // Get total count - for v1, we're removing reply functionality
      const countResult = await db.select({ count: count() })
        .from(articles)
        .where(and(
          eq(articles.status, 'published')
        ));
      
      const total = countResult[0]?.count || 0;
      
      // Get articles - for v1, we're removing reply functionality
      const articlesResult = await db.select()
        .from(articles)
        .where(and(
          eq(articles.status, 'published')
        ))
        .orderBy(desc(articles.publishedAt))
        .limit(limit)
        .offset(offset);
      
      return { articles: articlesResult, total };
    } catch (error) {
      console.error("Error getting article replies:", error);
      throw error;
    }
  }
  

  
  
  
  async getAllArticleCategories(): Promise<ArticleCategory[]> {
    try {
      return await db.select()
        .from(articleCategories)
        .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.title));
    } catch (error) {
      console.error("Error getting all article categories:", error);
      throw error;
    }
  }
  
  async getArticleStatsByCategory(): Promise<any[]> {
    try {
      // First, get all categories to understand the hierarchy
      const allCategories = await db
        .select()
        .from(articleCategories)
        .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.title));
      
      // Get article counts by section
      let rawStats: { section: string; count: number; newCount: number }[] = [];
      
      try {
        const rawResult = await db.execute(
          sql`SELECT 
            section, 
            COUNT(*) as count,
            SUM(CASE WHEN "publishedAt" >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as newCount
          FROM articles 
          WHERE status = 'published' AND section IS NOT NULL
          GROUP BY section`
        );
        
        // Handle the result based on its type
        let rows = [];
        if (Array.isArray(rawResult)) {
          rows = rawResult;
        } else if (rawResult && typeof rawResult === 'object' && 'rows' in rawResult) {
          rows = (rawResult as any).rows || [];
        }
        
        // Process the results
        rawStats = rows.map((row: any) => ({
          section: row.section,
          count: parseInt(row.count) || 0,
          newCount: parseInt(row.newCount) || 0
        }));
      } catch (queryError) {
        console.error('Error executing article count query:', queryError);
        rawStats = []; // Default to empty array if query fails
      }
      
      // Create a map to store the total counts for each category
      const categoryTotals: Record<string, { count: number; newCount: number }> = {};
      
      // Initialize all categories with zero counts
      allCategories.forEach(category => {
        categoryTotals[category.slug] = { count: 0, newCount: 0 };
      });
      
      // Add article counts to matching categories
      rawStats.forEach(stat => {
        if (stat.section) {
          // Find the category that corresponds to this section
          const category = allCategories.find(cat => cat.slug === stat.section);
          if (category) {
            // Add to this category
            if (categoryTotals[stat.section]) {
              categoryTotals[stat.section].count += stat.count;
              categoryTotals[stat.section].newCount += stat.newCount;
            }
            
            // Then, traverse up the hierarchy to add to parent categories
            let parentId = category.parentId;
            while (parentId) {
              const parentCategory = allCategories.find(cat => cat.id === parentId);
              if (parentCategory) {
                if (categoryTotals[parentCategory.slug]) {
                  categoryTotals[parentCategory.slug].count += stat.count;
                  categoryTotals[parentCategory.slug].newCount += stat.newCount;
                }
                parentId = parentCategory.parentId;
              } else {
                break;
              }
            }
          }
        }
      });
      
      // Convert to the expected format (include all categories, even those with 0 counts)
      const finalStats = Object.entries(categoryTotals)
        .map(([section, counts]) => ({
          section,
          count: counts.count,
          newCount: counts.newCount
        }));
      
      return finalStats;
    } catch (error) {
      console.error("Error getting article stats by category:", error);
      // Return empty array in case of error
      return [];
    }
  }
  
  // Get article comments
  async getArticleComments(articleId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Direct query approach to avoid Drizzle syntax issues
      const result = await db.execute(sql`
        SELECT 
          c.id,
          c.user_id as "userId",
          c.article_id as "articleId",
          c.content,
          c.parent_comment_id as "parentCommentId",
          c.quoted_text as "quotedText",
          c.created_at as "createdAt",
          u.username,
          u.full_name as "fullName",
          u.avatar_url as "avatarUrl"
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.article_id = ${articleId} AND c.parent_comment_id IS NULL
        ORDER BY c.created_at DESC
      `);
      
      const commentsWithData = [];
      
      for (const row of result.rows) {
        // Get reactions for this comment
        const reactions = await this.getCommentReactions(row.id, currentUserId);
        // Safely calculate reaction sum
        const reactionSum = reactions && Array.isArray(reactions) 
          ? reactions.reduce((sum, r) => sum + (r.count || 0), 0) 
          : 0;
        
        // Get replies for this comment
        const replies = await this.getArticleCommentReplies(row.id, currentUserId);
        const replyCount = await this.countArticleCommentReplies(row.id);
        
        commentsWithData.push({
          id: row.id,
          userId: row.userId,
          articleId: row.articleId,
          content: row.content,
          author: row.fullName || row.username || 'Anonymous',
          username: row.username || null,
          createdAt: new Date(row.createdAt).toISOString(),
          reactions: reactions || [],
          userLiked: reactions && Array.isArray(reactions) ? reactions.some(r => r.userReacted) : false,
          likes: reactionSum,
          userAvatar: row.avatarUrl || null,
          attachments: [],
          isOwnComment: currentUserId === row.userId,
          parentCommentId: row.parentCommentId,
          quotedText: row.quotedText,
          parentCommentAuthor: row.parentCommentAuthor || null,
          replyCount: replyCount || 0,
          replies: replies || [],
          metadata: null
        });
      }
      
      return commentsWithData;
    } catch (error) {
      console.error("Error getting article comments:", error);
      throw error;
    }
  }
  
  // Add article comment
  async addArticleComment(params: {
    articleId: string;
    userId: string;
    content: string;
    parentCommentId?: string | null;
    quotedText?: string | null;
  }): Promise<any> {
    try {
      const result = await db.insert(comments)
        .values({
          userId: params.userId,
          articleId: params.articleId,
          content: params.content,
          parentCommentId: params.parentCommentId || null,
          quotedText: params.quotedText || null
        })
        .returning();
      
      const comment = result[0];
      
      // Get user info for the comment
      const userResult = await db.select({
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(users)
      .where(eq(users.id, params.userId));
      
      const userInfo = userResult[0];
      
      return {
        id: comment.id,
        userId: comment.userId,
        articleId: comment.articleId,
        content: comment.content,
        parentCommentId: comment.parentCommentId,
        quotedText: comment.quotedText,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        userName: userInfo.fullName || userInfo.username || 'Anonymous',
        userAvatar: userInfo.avatarUrl || null,
        likes: 0,
        userLiked: false,
        replies: [],
        replyCount: 0
      };
    } catch (error) {
      console.error("Error adding article comment:", error);
      throw error;
    }
  }
  
  // Toggle article like/reaction
  async toggleArticleLike(params: {
    articleId: string;
    userId: string;
    emoji: string;
  }): Promise<any> {
    try {
      // Check if user already reacted
      const existingReaction = await db.select()
        .from(reactions)
        .where(and(
          eq(reactions.userId, params.userId),
          eq(reactions.articleId, params.articleId),
          eq(reactions.emoji, params.emoji)
        ));
      
      // Perform the add/remove operation
      if (existingReaction.length > 0) {
        // Remove reaction if it exists
        await db.delete(reactions)
          .where(eq(reactions.id, existingReaction[0].id));
      } else {
        // Add reaction if it doesn't exist
        await db.insert(reactions)
          .values({
            userId: params.userId,
            articleId: params.articleId,
            emoji: params.emoji
          });
      }
      
      // Get all reactions for this article grouped by emoji (after the add/remove operation)
      const allArticleReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.articleId, params.articleId));
      
      // Group reactions by emoji and calculate counts
      const reactionMap = new Map<string, { count: number, userReacted: boolean }>();
      
      allArticleReactions.forEach(reaction => {
        if (!reactionMap.has(reaction.emoji)) {
          reactionMap.set(reaction.emoji, { count: 0, userReacted: false });
        }
        
        const reactionData = reactionMap.get(reaction.emoji)!;
        reactionData.count += 1;
        
        // Mark if this user has reacted with this specific emoji
        if (reaction.userId === params.userId) {
          reactionData.userReacted = true;
        }
      });
      
      // Handle the case where user removed their reaction
      if (existingReaction.length > 0) {
        // User just removed a reaction, need to update userReacted for that specific emoji
        const removedEmoji = existingReaction[0].emoji;
        if (reactionMap.has(removedEmoji)) {
          const emojiData = reactionMap.get(removedEmoji)!;
          // Need to check if any other reactions by this user remain for this emoji
          const userReactionsForEmoji = allArticleReactions.filter(r => 
            r.userId === params.userId && r.emoji === removedEmoji
          );
          emojiData.userReacted = userReactionsForEmoji.length > 0;
        }
      }
      
      // Convert to the expected format
      const reactionsArray = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted
      }));
      
      return {
        articleId: params.articleId,
        reactions: reactionsArray,
        userLiked: existingReaction.length === 0  // If we just added it, userLiked is true
      };
    } catch (error) {
      console.error("Error toggling article like:", error);
      throw error;
    }
  }
  
  // Get article reactions with all emoji types
  async getArticleReactions(articleId: string, currentUserId?: string): Promise<any> {
    try {
      // Get all reactions for this article grouped by emoji
      const allReactions = await db.select({
        emoji: reactions.emoji,
        userId: reactions.userId,
      })
      .from(reactions)
      .where(eq(reactions.articleId, articleId));
      
      // Group by emoji and count
      const emojiCounts: Record<string, {count: number, userReacted: boolean}> = {};
      
      for (const reaction of allReactions) {
        if (!emojiCounts[reaction.emoji]) {
          emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
        }
        emojiCounts[reaction.emoji].count++;
        if (currentUserId && reaction.userId === currentUserId) {
          emojiCounts[reaction.emoji].userReacted = true;
        }
      }
      
      // Calculate total likes (for 👍 only, to maintain backward compatibility)
      const totalLikes = emojiCounts['👍']?.count || 0;
      const userLiked = emojiCounts['👍']?.userReacted || false;
      
      // Convert to array format for all emojis
      const reactionsArray = Object.entries(emojiCounts).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      }));
      
      return {
        articleId,
        likes: totalLikes,  // Keep for backward compatibility
        userLiked,         // Keep for backward compatibility
        reactions: reactionsArray  // New format with all reactions
      };
    } catch (error) {
      console.error("Error getting article reactions:", error);
      throw error;
    }
  }
  
  // Toggle comment like
  async toggleCommentLike(params: {
    commentId: string;
    userId: string;
    emoji: string;
  }): Promise<any> {
    try {
      // Check if user already reacted
      const existingReaction = await db.select()
        .from(reactions)
        .where(and(
          eq(reactions.userId, params.userId),
          eq(reactions.commentId, params.commentId),
          eq(reactions.emoji, params.emoji)
        ));
      
      if (existingReaction.length > 0) {
        // Remove reaction if it exists
        await db.delete(reactions)
          .where(eq(reactions.id, existingReaction[0].id));
      } else {
        // Add reaction if it doesn't exist
        await db.insert(reactions)
          .values({
            userId: params.userId,
            commentId: params.commentId,
            emoji: params.emoji
          });
      }
      
      // Return updated reaction count
      const reactionCount = await db.select({ count: count() })
        .from(reactions)
        .where(and(
          eq(reactions.commentId, params.commentId),
          eq(reactions.emoji, params.emoji)
        ));
      
      const count = Number(reactionCount[0]?.count ?? 0);
      
      return {
        commentId: params.commentId,
        likes: count,
        userLiked: existingReaction.length === 0  // If we just added it, userLiked is true
      };
    } catch (error) {
      console.error("Error toggling comment like:", error);
      throw error;
    }
  }
  
  async updateArticleCommentsCount(articleId: string, count: number): Promise<void> {
    try {
      await db.update(articles)
        .set({ commentsCount: count })
        .where(eq(articles.id, articleId));
    } catch (error) {
      console.error("Error updating article comments count:", error);
      throw error;
    }
  }
  
  async getArticleCommentReplies(commentId: string, currentUserId?: string): Promise<any[]> {
    try {
      // Get replies for a specific comment with user information
      const result = await db.select({
        id: comments.id,
        userId: comments.userId,
        articleId: comments.articleId,
        content: comments.content,
        parentCommentId: comments.parentCommentId,
        quotedText: comments.quotedText,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.parentCommentId, commentId))
      .orderBy(desc(comments.createdAt));
      
      // Get reactions and nested replies for each reply
      const repliesWithData = await Promise.all(result.map(async (reply) => {
        const reactions = await this.getCommentReactions(reply.id, currentUserId);
        // Safely calculate reaction sum
        const reactionSum = reactions && Array.isArray(reactions) 
          ? reactions.reduce((sum, r) => sum + (r.count || 0), 0) 
          : 0;
        
        // Get nested replies
        const nestedReplies = await this.getArticleCommentReplies(reply.id, currentUserId);
        const replyCount = await this.countArticleCommentReplies(reply.id);
        
        return {
          id: reply.id,
          userId: reply.userId,
          articleId: reply.articleId,
          content: reply.content,
          author: reply.fullName || reply.username || 'Anonymous',
          username: reply.username || null,
          createdAt: reply.createdAt.toISOString(),
          reactions: reactions || [],
          userLiked: reactions && Array.isArray(reactions) ? reactions.some(r => r.userReacted) : false,
          likes: reactionSum,
          userAvatar: reply.avatarUrl || null,
          attachments: [],
          isOwnComment: currentUserId === reply.userId,
          parentCommentId: reply.parentCommentId,
          quotedText: reply.quotedText,
          parentCommentAuthor: reply.parentCommentAuthor || null,
          replyCount: replyCount || 0,
          replies: nestedReplies || [],
          metadata: null
        };
      }));
      
      return repliesWithData;
    } catch (error) {
      console.error("Error getting article comment replies:", error);
      throw error;
    }
  }
  
  async countArticleCommentReplies(commentId: string): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(comments)
        .where(eq(comments.parentCommentId, commentId));
      
      return Number(result[0]?.count ?? 0);
    } catch (error) {
      console.error("Error counting article comment replies:", error);
      throw error;
    }
  }
}
export const storage = new DBStorage();