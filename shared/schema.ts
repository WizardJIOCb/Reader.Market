import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  accessLevel: text("access_level").default('user'), // 'admin', 'moder', 'user'
  language: varchar("language", { length: 10 }).default('en'), // User's preferred language
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  bio: true,
  avatarUrl: true,
  language: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  genre: text("genre"),
  publishedYear: integer("published_year"),
  rating: numeric("rating", { precision: 3, scale: 1 }),
  userId: varchar("user_id").notNull().references(() => users.id), // Added userId field to track uploader
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(), // When the book was uploaded to our system
  publishedAt: timestamp("published_at"), // Publication date of the book
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shelves = pgTable("shelves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shelfBooks = pgTable("shelf_books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shelfId: varchar("shelf_id").notNull().references(() => shelves.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const readingProgress = pgTable("reading_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  currentPage: integer("current_page"),
  totalPages: integer("total_pages"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  lastReadAt: timestamp("last_read_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// New table for tracking reading statistics
export const readingStatistics = pgTable("reading_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  wordsRead: integer("words_read").notNull().default(0),
  lettersRead: integer("letters_read").notNull().default(0),
  timeSpentReading: integer("time_spent_reading").notNull().default(0), // in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// New table for overall user statistics
export const userStatistics = pgTable("user_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalBooksRead: integer("total_books_read").notNull().default(0),
  totalWordsRead: integer("total_words_read").notNull().default(0),
  totalLettersRead: integer("total_letters_read").notNull().default(0),
  totalTimeSpentReading: integer("total_time_spent_reading").notNull().default(0), // in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  chapterId: varchar("chapter_id"),
  title: text("title").notNull(),
  content: text("content"),
  position: integer("position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table for book comments
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").references(() => books.id),  // Optional - for book comments
  newsId: varchar("news_id").references(() => news.id),  // Optional - for news comments
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for book reviews
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  rating: integer("rating").notNull(), // Rating from 1-10
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for reactions (likes, etc.) on comments, reviews, and news
export const reactions = pgTable("reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Exactly one of these IDs should be set
  commentId: varchar("comment_id").references(() => comments.id),
  reviewId: varchar("review_id").references(() => reviews.id),
  newsId: varchar("news_id").references(() => news.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table for conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  lastMessageId: varchar("last_message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for groups
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  privacy: text("privacy").notNull().default('public'), // 'public' or 'private'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Table for group members
export const groupMembers = pgTable("group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default('member'), // 'administrator', 'moderator', 'member'
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Table for group-book associations
export const groupBooks = pgTable("group_books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Table for channels within groups
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
});

// Table for private messages (updated)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").references(() => users.id), // nullable for group messages
  conversationId: varchar("conversation_id").references(() => conversations.id),
  channelId: varchar("channel_id").references(() => channels.id),
  parentMessageId: varchar("parent_message_id"),
  quotedMessageId: varchar("quoted_message_id").references(() => messages.id),
  quotedText: text("quoted_text"),
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  readStatus: boolean("read_status").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by").references(() => users.id),
});

// Table for message reactions
export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table for notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'new_message', 'group_invite', 'mention', etc.
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  content: jsonb("content"), // stores notification details
  readStatus: boolean("read_status").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table for book view statistics
export const bookViewStatistics = pgTable("book_view_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id),
  viewType: text("view_type").notNull(), // 'card_view' or 'reader_open'
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for news articles
export const news = pgTable("news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  published: boolean("published").default(false),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  reactionCount: integer("reaction_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for file uploads
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploaderId: varchar("uploader_id").notNull().references(() => users.id),
  fileUrl: text("file_url").notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  entityType: text("entity_type").notNull(), // 'message', 'comment', 'review'
  entityId: varchar("entity_id"),
  thumbnailUrl: text("thumbnail_url"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Table for activity feed
export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  activityType: text("activity_type").notNull(), // 'news', 'book', 'comment', 'review'
  entityId: varchar("entity_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").references(() => users.id),
  bookId: varchar("book_id").references(() => books.id),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Create unique constraint for conversations to prevent duplicate user pairs
// Note: We'll handle this in the migration file