import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, numeric, uniqueIndex, index, foreignKey } from "drizzle-orm/pg-core";
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
  isBlocked: boolean("is_blocked").default(false), // Whether user is blocked
  blockReason: text("block_reason"), // Reason for blocking (supports markdown/links)
  profileRating: numeric("profile_rating", { precision: 3, scale: 1 }), // Average profile rating from profile_ratings
  profileViewCount: integer("profile_view_count").default(0), // Number of times profile has been viewed
  language: varchar("language", { length: 10 }).default('en'), // User's preferred language
  lastLoginAt: timestamp("last_login_at"), // Last successful login timestamp
  lastActivityAt: timestamp("last_activity_at"), // Last user activity (any action on site)
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
  videoCoverUrl: text("video_cover_url"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  language: varchar("language", { length: 10 }).default('en'), // Original book language (ISO 639-1: 'en', 'ru', 'es', etc.)
  genre: text("genre"),
  publishedYear: integer("published_year"),
  rating: numeric("rating", { precision: 3, scale: 1 }),
  userId: varchar("user_id").notNull().references(() => users.id), // Added userId field to track uploader
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(), // When the book was uploaded to our system
  publishedAt: timestamp("published_at"), // Publication date of the book
  isActive: boolean("is_active").default(true).notNull(), // Whether book is visible on public pages
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookTranslations = pgTable("book_translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id, { onDelete: 'cascade' }),
  language: varchar("language", { length: 10 }).notNull(), // ISO 639-1 codes: 'en', 'ru', 'es', etc.
  translationType: varchar("translation_type", { length: 20 }).notNull(), // 'automated' | 'manual'
  translationService: varchar("translation_service", { length: 50 }), // 'ollama' | 'libretranslate' | 'google' | 'deepl' | null
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // 'pdf' | 'epub' | 'fb2' | 'txt'
  status: varchar("status", { length: 20 }).notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  progress: integer("progress").default(0), // 0-100 for automated translations
  statusDetails: jsonb("status_details"), // Detailed status: { step: string, currentChunk: number, totalChunks: number, message: string }
  errorMessage: text("error_message"),
  translatedBy: varchar("translated_by").references(() => users.id),
  partialFilePath: text("partial_file_path"), // Path to temporary file with partial translation
  lastCompletedChunk: integer("last_completed_chunk").default(0), // Index of last successfully translated chunk
  totalChunks: integer("total_chunks").default(0), // Total number of chunks for this translation
  totalCharacters: integer("total_characters").default(0), // Total characters in original text
  translatedCharacters: integer("translated_characters").default(0), // Characters translated so far
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
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
  chapterIndex: integer("chapter_index"),
  settings: jsonb("settings"),
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
  chapterIndex: integer("chapter_index"),
  title: text("title").notNull(),
  selectedText: text("selected_text"),
  pageInChapter: integer("page_in_chapter"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  clickCount: integer("click_count").default(0), // Number of times bookmark has been clicked
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bookmark collections for thematic grouping
export const bookmarkCollections = pgTable("bookmark_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  color: varchar("color").default("#3b82f6"),
  isPublic: boolean("is_public").default(false),
  coverImageUrl: text("cover_image_url"), // URL of the cover image for the collection
  bookId: varchar("book_id").references(() => books.id, { onDelete: "set null" }), // Deprecated: Use collection_books table instead
  viewCount: integer("view_count").default(0), // Number of times collection has been viewed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction table for collection-book relationships (many-to-many)
export const collectionBooks = pgTable("collection_books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => bookmarkCollections.id, { onDelete: "cascade" }),
  bookId: varchar("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex("collection_book_unique_idx").on(table.collectionId, table.bookId),
}));

// Many-to-many relationship between bookmarks and collections
export const bookmarkCollectionItems = pgTable("bookmark_collection_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => bookmarkCollections.id, { onDelete: "cascade" }),
  bookmarkId: varchar("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex("collection_bookmark_unique_idx").on(table.collectionId, table.bookmarkId),
}));

// Table for book comments
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").references(() => books.id),  // Optional - for book comments
  newsId: varchar("news_id").references(() => news.id),  // Optional - for news comments
  articleId: varchar("article_id").references(() => articles.id),  // Optional - for article comments
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  parentCommentId: varchar("parent_comment_id"),
  quotedText: text("quoted_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for book reviews
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: varchar("book_id").notNull().references(() => books.id),
  rating: integer("rating"), // Rating from 1-10 (nullable for replies)
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  parentReviewId: varchar("parent_review_id"), // Reply to another review (self-reference added via migration)
  quotedText: text("quoted_text"), // Quoted text from parent review
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for profile ratings
export const profileRatings = pgTable("profile_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // The rater
  profileId: varchar("profile_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // The profile being rated
  rating: integer("rating").notNull(), // Rating from 1-10
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for profile comments
export const profileComments = pgTable("profile_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // The commenter
  profileId: varchar("profile_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // The profile being commented on
  content: text("content").notNull(),
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  linkedRatingId: varchar("linked_rating_id").references(() => profileRatings.id, { onDelete: 'cascade' }), // Links comment to rating
  parentCommentId: varchar("parent_comment_id"), // Reply to another comment (self-reference added via migration)
  quotedText: text("quoted_text"), // Quoted text from parent comment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for reactions (likes, etc.) on comments, reviews, news, and books
export const reactions = pgTable("reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Exactly one of these IDs should be set
  commentId: varchar("comment_id").references(() => comments.id),
  reviewId: varchar("review_id").references(() => reviews.id),
  newsId: varchar("news_id").references(() => news.id),
  bookId: varchar("book_id").references(() => books.id),
  articleId: varchar("article_id").references(() => articles.id),
  profileCommentId: varchar("profile_comment_id").references(() => profileComments.id, { onDelete: 'cascade' }),
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

// Table for tracking user channel read positions
export const userChannelReadPositions = pgTable("user_channel_read_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for user subscriptions to threads/entities
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar("entity_type").notNull(), // 'book', 'news', 'comment_thread', 'review_thread', etc.
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
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
  titleEn: text("title_en"),
  content: text("content").notNull(),
  contentEn: text("content_en"),
  slug: varchar("slug", { length: 255 }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  published: boolean("published").default(false),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  reactionCount: integer("reaction_count").default(0).notNull(),
  imageUrls: jsonb("image_urls").default(sql`'[]'::jsonb`),
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

// Table for user actions (navigation and interaction tracking)
export const userActions = pgTable("user_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionType: text("action_type").notNull(), // 'navigate_home', 'navigate_stream', etc.
  targetType: text("target_type"), // 'user', 'book', 'news', 'group'
  targetId: varchar("target_id"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Table for book chat messages (real-time chat within book reader)
export const bookChatMessages = pgTable("book_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  mentionedUserId: varchar("mentioned_user_id").references(() => users.id), // For direct @mentions
  quotedMessageId: varchar("quoted_message_id").references(() => bookChatMessages.id), // For replies
  attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
  attachmentMetadata: jsonb("attachment_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// OAuth Accounts Table
export const oauthAccounts = pgTable("oauth_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// OAuth State Management Table
export const oauthStates = pgTable("oauth_states", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  stateToken: varchar("state_token", { length: 255 }).notNull().unique(),
  provider: varchar("provider", { length: 50 }).notNull(),
  codeVerifier: varchar("code_verifier", { length: 255 }),
  language: varchar("language", { length: 10 }), // Store user's selected language
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Table for system-wide rating algorithm configuration (for book ratings)
export const ratingSystemConfig = pgTable("rating_system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  algorithmType: varchar("algorithm_type", { length: 50 }).notNull().default('simple_average'), // 'simple_average', 'bayesian_average', 'weighted_bayesian', 'confidence_weighted'
  priorMean: numeric("prior_mean", { precision: 3, scale: 1 }).default('7.4'), // μ0 - Average rating across service
  priorWeight: integer("prior_weight").default(30), // m - Number of "virtual votes"
  likesAlpha: numeric("likes_alpha", { precision: 2, scale: 1 }).default('0.4'), // α - Likes weight coefficient
  likesMaxWeight: numeric("likes_max_weight", { precision: 2, scale: 1 }).default('3.0'), // Max weight from likes
  minTextWeight: numeric("min_text_weight", { precision: 2, scale: 1 }).default('0.3'), // Min weight for short reviews
  timeDecayEnabled: boolean("time_decay_enabled").default(false), // Enable time decay
  timeDecayHalfLife: integer("time_decay_half_life").default(180), // Half-life in days
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for user rating system configuration
export const userRatingConfig = pgTable("user_rating_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priorMean: numeric("prior_mean", { precision: 3, scale: 1 }).default('7.5'),
  priorStrength: integer("prior_strength").default(20),
  confidenceThreshold: integer("confidence_threshold").default(30),
  
  // Rater weight config
  raterYoungDays: integer("rater_young_days").default(7),
  raterYoungMult: numeric("rater_young_mult", { precision: 2, scale: 1 }).default('0.3'),
  raterMediumDays: integer("rater_medium_days").default(30),
  raterMediumMult: numeric("rater_medium_mult", { precision: 2, scale: 1 }).default('0.6'),
  raterMatureMult: numeric("rater_mature_mult", { precision: 2, scale: 1 }).default('1.0'),
  raterVerifiedMult: numeric("rater_verified_mult", { precision: 3, scale: 2 }).default('1.10'),
  raterActivityMult: numeric("rater_activity_mult", { precision: 3, scale: 2 }).default('1.05'),
  raterMinReadingMinutes30d: integer("rater_min_reading_minutes_30d").default(60),
  raterMinBooksAdded30d: integer("rater_min_books_added_30d").default(3),
  raterWeightCap: numeric("rater_weight_cap", { precision: 2, scale: 1 }).default('1.2'),
  raterWeightFloor: numeric("rater_weight_floor", { precision: 2, scale: 1 }).default('0.2'),
  
  // Text quality weight config
  textEmptyMult: numeric("text_empty_mult", { precision: 2, scale: 1 }).default('0.85'),
  textShortLength: integer("text_short_length").default(20),
  textShortMult: numeric("text_short_mult", { precision: 2, scale: 1 }).default('0.6'),
  textNormalMaxLength: integer("text_normal_max_length").default(1200),
  textNormalMult: numeric("text_normal_mult", { precision: 2, scale: 1 }).default('1.0'),
  textLongMult: numeric("text_long_mult", { precision: 2, scale: 1 }).default('0.9'),
  textSpamMult: numeric("text_spam_mult", { precision: 2, scale: 1 }).default('0.3'),
  
  // Likes weight config
  likesEnabled: boolean("likes_enabled").default(true),
  likesAlpha: numeric("likes_alpha", { precision: 2, scale: 1 }).default('0.3'),
  likesCap: numeric("likes_cap", { precision: 2, scale: 1 }).default('2.0'),
  
  // Time decay config
  timeDecayEnabled: boolean("time_decay_enabled").default(false),
  timeDecayHalfLifeDays: integer("time_decay_half_life_days").default(180),
  timeDecayMinWeight: numeric("time_decay_min_weight", { precision: 2, scale: 1 }).default('3.0'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for user rating aggregates (for efficient incremental updates)
export const userRatingAgg = pgTable("user_rating_agg", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  sumW: numeric("sum_w", { precision: 10, scale: 4 }).default('0'),
  sumWX: numeric("sum_wx", { precision: 10, scale: 4 }).default('0'),
  countActive: integer("count_active").default(0),
  recentSumW: numeric("recent_sum_w", { precision: 10, scale: 4 }).default('0'),
  recentSumWX: numeric("recent_sum_wx", { precision: 10, scale: 4 }).default('0'),
  ratingOverall: numeric("rating_overall", { precision: 3, scale: 1 }),
  ratingRecent: numeric("rating_recent", { precision: 3, scale: 1 }),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add likes count to reviews table for weighted rating calculations
// Note: This will be tracked via reactions table count

// =====================================================================
// TTS (TEXT-TO-SPEECH) SYSTEM TABLES
// =====================================================================

// Global TTS configuration managed via admin panel
export const ttsConfig = pgTable("tts_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ttsEnabled: boolean("tts_enabled").default(true).notNull(),
  
  enabledProviders: jsonb("enabled_providers").default(sql`'["rhvoice","piper"]'::jsonb`).notNull(),
  defaultProvider: text("default_provider").default('piper').notNull(),
  
  defaultLang: varchar("default_lang", { length: 10 }).default('en').notNull(),
  defaultVoiceRu: text("default_voice_ru"),
  defaultVoiceEn: text("default_voice_en"),
  
  defaultRate: numeric("default_rate", { precision: 3, scale: 2 }).default('1.00').notNull(),
  minRate: numeric("min_rate", { precision: 3, scale: 2 }).default('0.80').notNull(),
  maxRate: numeric("max_rate", { precision: 3, scale: 2 }).default('1.25').notNull(),
  
  chunkMinChars: integer("chunk_min_chars").default(400).notNull(),
  chunkMaxChars: integer("chunk_max_chars").default(1800).notNull(),
  
  audioFormat: text("audio_format").default('mp3').notNull(), // 'mp3' | 'ogg'
  mp3Bitrate: integer("mp3_bitrate").default(64).notNull(),
  
  queueConcurrency: integer("queue_concurrency").default(1).notNull(),
  
  cacheMaxGb: integer("cache_max_gb").default(20).notNull(),
  cacheTtlDays: integer("cache_ttl_days").default(90).notNull(),
  
  rhvoiceBinPath: text("rhvoice_bin_path").default('/usr/bin/RHVoice-test'),
  piperBinPath: text("piper_bin_path").default('/usr/local/bin/piper'),
  piperModelsDir: text("piper_models_dir").default('/opt/piper/models'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cache of synthesized audio files to avoid re-synthesis
export const ttsCache = pgTable("tts_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  bookId: varchar("book_id").notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterIndex: integer("chapter_index"), // nullable if no chapters
  chunkIndex: integer("chunk_index").notNull(),
  
  provider: text("provider").notNull(), // 'rhvoice' | 'piper'
  lang: varchar("lang", { length: 10 }).notNull(), // 'ru' | 'en'
  voice: text("voice").notNull(),
  rate: numeric("rate", { precision: 3, scale: 2 }).default('1.00').notNull(),
  format: text("format").notNull(), // 'mp3' | 'ogg'
  
  textHash: text("text_hash").notNull().unique(), // SHA256 hash for deterministic caching
  
  audioPath: text("audio_path").notNull(),
  audioSize: integer("audio_size"),
  durationMs: integer("duration_ms"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
});

// Optional job tracking for synthesis processes (for debugging)
export const ttsJobs = pgTable("tts_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  textHash: text("text_hash").notNull(),
  status: text("status").notNull(), // 'queued' | 'processing' | 'ready' | 'failed'
  provider: text("provider").notNull(),
  lang: varchar("lang", { length: 10 }).notNull(),
  voice: text("voice").notNull(),
  rate: numeric("rate", { precision: 3, scale: 2 }).notNull(),
  format: text("format").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TtsConfig = typeof ttsConfig.$inferSelect;
export type InsertTtsConfig = typeof ttsConfig.$inferInsert;

export type TtsCache = typeof ttsCache.$inferSelect;
export type InsertTtsCache = typeof ttsCache.$inferInsert;

export type TtsJob = typeof ttsJobs.$inferSelect;
export type InsertTtsJob = typeof ttsJobs.$inferInsert;

// =====================================================================
// ARTICLES SYSTEM TABLES
// =====================================================================

// Article categories (hierarchical)
export const articleCategories = pgTable("article_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id"), // Self-reference defined in relations
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  descriptionEn: text("description_en"),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  parentReference: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id]
  })
}));

// Article tags
export const articleTags = pgTable("article_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  axis: text("axis").default('other'), // Will use article_tag_axis_enum
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex("article_tags_axis_slug_uq").on(t.axis, t.slug),
  axisIdx: index("article_tags_axis_idx").on(t.axis),
}));

// Articles
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Section and format using enums (matching senior's recommendations)
  section: text("section"), // Will use article_section_enum
  format: text("format"), // Will use article_format_enum
  status: text("status").notNull().default('draft'), // Will use article_status_enum
  
  lang: text("lang").notNull().default("ru"), // ru/en etc
  
  title: text("title").notNull(),
  slug: text("slug").notNull(), // unique per lang usually
  excerpt: text("excerpt"),
  coverImageUrl: text("cover_image_url"),
  
  // Content options
  contentJson: jsonb("content_json"),
  
  // For search (can be updated trigger/code when saving)
  searchText: text("search_text"),
  
  // Counters
  views: integer("views").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
}, (t) => ({
  slugLangUnique: uniqueIndex("articles_slug_lang_uq").on(t.slug, t.lang),
  statusIdx: index("articles_status_idx").on(t.status),
  sectionIdx: index("articles_section_idx").on(t.section),
  formatIdx: index("articles_format_idx").on(t.format),
  publishedAtIdx: index("articles_published_at_idx").on(t.publishedAt),
}));

// Article-Book relationships
export const articleBooks = pgTable("article_books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  bookId: varchar("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // primary|in_list|mentioned
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({
  articleBookUnique: uniqueIndex("article_books_article_book_uq").on(t.articleId, t.bookId),
  bookIdx: index("article_books_book_idx").on(t.bookId),
}));

// Article-Tag links
export const articleTagLinks = pgTable("article_tag_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => articleTags.id, { onDelete: "cascade" }),
}, (t) => ({
  articleTagUnique: uniqueIndex("article_tag_links_article_tag_uq").on(t.articleId, t.tagId),
}));







// Article views tracking (for unique view counting)
export const articleViews = pgTable("article_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueViewIdx: uniqueIndex("article_views_unique_idx").on(
    table.articleId, 
    table.userId, 
    table.ipHash, 
    table.userAgentHash
  ),
}));

// Read later tracking
export const articleReadLater = pgTable("article_read_later", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex("article_read_later_pk").on(table.userId, table.articleId),
}));

// Export types
export type ArticleCategory = typeof articleCategories.$inferSelect;
export type InsertArticleCategory = typeof articleCategories.$inferInsert;

export type ArticleTag = typeof articleTags.$inferSelect;
export type InsertArticleTag = typeof articleTags.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

export type ArticleTagLinks = typeof articleTagLinks.$inferSelect;
export type InsertArticleTagLinks = typeof articleTagLinks.$inferInsert;

export type ArticleBook = typeof articleBooks.$inferSelect;
export type InsertArticleBook = typeof articleBooks.$inferInsert;


export type ArticleView = typeof articleViews.$inferSelect;
export type InsertArticleView = typeof articleViews.$inferInsert;

export type ArticleReadLater = typeof articleReadLater.$inferSelect;
export type InsertArticleReadLater = typeof articleReadLater.$inferInsert;


// =====================================================================
// GLOBAL CATALOG SYSTEM TABLES
// =====================================================================

// Table for canonical list of all books in the world (global catalog)
export const globalWorks = pgTable("global_works", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  normalizedTitle: text("normalized_title").notNull(),
  authorName: text("author_name").notNull(),
  year: integer("year"),
  language: varchar("language", { length: 10 }),
  wikidataQid: varchar("wikidata_qid", { length: 20 }), // Wikidata entity ID
  openlibraryWorkId: varchar("openlibrary_work_id"), // OpenLibrary work ID
  created_at: timestamp("created_at").defaultNow().notNull(),
  discovered_at: timestamp("discovered_at"), // When first discovered in our system
  discovery_source: text("discovery_source"), // openlibrary / wikidata / google / user_search
  status: text("status").default('pending').notNull(), // pending / processing / processed / failed
  bootstrap_source: text("bootstrap_source"), // Source of initial bootstrap (wikidata, openlibrary)
  bootstrap_at: timestamp("bootstrap_at"), // When it was bootstrapped
  externalIds: jsonb("external_ids"), // Additional external identifiers (ISBN, etc.)
});

// Table for specific book editions
export const editions = pgTable("editions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workId: varchar("work_id").notNull().references(() => globalWorks.id, { onDelete: 'cascade' }),
  isbn10: varchar("isbn10", { length: 10 }),
  isbn13: varchar("isbn13", { length: 13 }),
  publisher: text("publisher"),
  year: integer("year"),
  language: varchar("language", { length: 10 }),
  source: text("source").notNull(), // Where this edition info came from
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Queue for discovery tasks
export const discoveryQueue = pgTable("discovery_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(), // The search query or identifier
  type: text("type").notNull(), // user_search | global_fill
  priority: integer("priority").default(0).notNull(), // Higher number = higher priority
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  status: text("status").default('pending').notNull(), // pending / found / failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Log of search misses (user searches that returned no results)
export const searchMissLog = pgTable("search_miss_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rawQuery: text("raw_query").notNull(), // The original user query
  normalizedQuery: text("normalized_query").notNull(), // Normalized version of the query
  userId: varchar("user_id").references(() => users.id), // Who searched (nullable for anonymous)
  count: integer("count").default(1).notNull(), // How many times this query was made
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track bootstrap progress
export const bootstrapProgress = pgTable("bootstrap_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchIdentifier: varchar("batch_identifier").notNull(), // Identifier for the batch (e.g., last QID processed)
  source: text("source").notNull(), // wikidata, openlibrary, etc.
  recordsProcessed: integer("records_processed").default(0).notNull(),
  status: text("status").default('running').notNull(), // running / completed / failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"), // Additional metadata about the bootstrap run
});

// Worker statistics table
export const workerStats = pgTable("worker_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerName: text("worker_name").notNull(), // Name of the worker (discovery_worker)
  totalProcessed: integer("total_processed").default(0).notNull(), // Total items processed
  totalErrors: integer("total_errors").default(0).notNull(), // Total errors occurred
  lastProcessedAt: timestamp("last_processed_at"), // Last time an item was processed
  activeSince: timestamp("active_since"), // When worker became active
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Export types for global catalog
export type GlobalWork = typeof globalWorks.$inferSelect;
export type InsertGlobalWork = typeof globalWorks.$inferInsert;

export type Edition = typeof editions.$inferSelect;
export type InsertEdition = typeof editions.$inferInsert;

export type DiscoveryQueue = typeof discoveryQueue.$inferSelect;
export type InsertDiscoveryQueue = typeof discoveryQueue.$inferInsert;

export type SearchMissLog = typeof searchMissLog.$inferSelect;
export type InsertSearchMissLog = typeof searchMissLog.$inferInsert;

export type BootstrapProgress = typeof bootstrapProgress.$inferSelect;
export type InsertBootstrapProgress = typeof bootstrapProgress.$inferInsert;

export type WorkerStat = typeof workerStats.$inferSelect;
export type InsertWorkerStat = typeof workerStats.$inferInsert;

// Create unique constraint for conversations to prevent duplicate user pairs
// Note: We'll handle this in the migration file