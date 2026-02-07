import { User, InsertUser } from "@shared/schema";
import { ArticlesServiceInterface } from "./modules/articles.storage";
import { CollectionsServiceInterface } from "./modules/collections.storage";
import { AdminStorage } from "./modules/admin.storage";

export interface Storage extends ArticlesServiceInterface, CollectionsServiceInterface, AdminStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameCaseInsensitive(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(userId: string): Promise<void>;
  updateUserLastActivity(userId: string): Promise<void>;
  getUsersWithStats(limit: number, offset: number): Promise<any[]>;
  searchUsers(query: string): Promise<any[]>;
  getUsersCount(): Promise<number>;
  
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
  updateShelf(id: string, shelfData: any): Promise<any>;
  deleteShelf(id: string): Promise<void>;
  addBookToShelf(shelfId: string, bookId: string): Promise<void>;
  removeBookFromShelf(shelfId: string, bookId: string): Promise<void>;
  getUserShelvesWithBooks(userId: string): Promise<{shelves: any[], books: any[]}>;
  
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
  getUserComments(userId: string, limit?: number, offset?: number): Promise<any[]>;
  
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
  
  // Logging configuration methods
  getLogConfig(): Promise<any>;
  updateLogConfig(config: any): Promise<any>;
}