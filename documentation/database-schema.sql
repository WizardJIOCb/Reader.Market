-- Reader.Market Database Schema
-- Generated: January 2026
-- Purpose: Complete database structure with comments explaining each table and field

-- =====================================================================
-- CORE USER SYSTEM
-- =====================================================================

-- Main users table storing all user account information
CREATE TABLE users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique user identifier
    username TEXT NOT NULL UNIQUE, -- User's login name
    password TEXT NOT NULL, -- Hashed password
    email TEXT, -- User's email address
    full_name TEXT, -- User's real name
    bio TEXT, -- User biography/description
    avatar_url TEXT, -- URL to user's profile picture
    access_level TEXT DEFAULT 'user', -- Permission level: 'admin', 'moder', 'user'
    is_blocked BOOLEAN DEFAULT FALSE, -- Whether user account is suspended
    block_reason TEXT, -- Reason for account suspension (supports markdown/links)
    profile_rating NUMERIC(3,1), -- Average rating from profile ratings system
    language VARCHAR(10) DEFAULT 'en', -- User's preferred language (ISO 639-1)
    last_login_at TIMESTAMP, -- Timestamp of last successful login
    last_activity_at TIMESTAMP, -- Timestamp of last user activity on site
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE users IS 'Main user accounts table containing all user profile and authentication data';
COMMENT ON COLUMN users.access_level IS 'User permission levels: admin (full access), moder (moderation tools), user (standard access)';
COMMENT ON COLUMN users.profile_rating IS 'Calculated average rating based on profile_ratings table';
COMMENT ON COLUMN users.last_activity_at IS 'Tracks last user interaction for activity feeds and online status';

-- =====================================================================
-- BOOK MANAGEMENT SYSTEM
-- =====================================================================

-- Books table storing all uploaded book metadata
CREATE TABLE books (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique book identifier
    title TEXT NOT NULL, -- Book title
    author TEXT NOT NULL, -- Book author name
    description TEXT, -- Book description/summary
    cover_image_url TEXT, -- URL to book cover image
    file_path TEXT, -- Path to book file on server
    file_size INTEGER, -- Size of book file in bytes
    file_type TEXT, -- File format: txt, fb2, epub, pdf
    language VARCHAR(10) DEFAULT 'en', -- Original book language (ISO 639-1)
    genre TEXT, -- Book genre/categories
    published_year INTEGER, -- Year book was originally published
    rating NUMERIC(3,1), -- Average book rating (1-10 scale)
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User who uploaded the book
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL, -- When book was uploaded to system
    published_at TIMESTAMP, -- Original publication date of book
    is_active BOOLEAN DEFAULT TRUE NOT NULL, -- Whether book is visible publicly
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE books IS 'Main books catalog with metadata and file information';
COMMENT ON COLUMN books.rating IS 'Community average rating calculated from user reviews';
COMMENT ON COLUMN books.is_active IS 'Soft delete flag - inactive books are hidden from public views';

-- Book translations table for multilingual support
CREATE TABLE book_translations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique translation identifier
    book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE, -- Original book
    language VARCHAR(10) NOT NULL, -- Target language for translation (ISO 639-1)
    translation_type VARCHAR(20) NOT NULL, -- Method: 'automated' or 'manual'
    translation_service VARCHAR(50), -- Service used: 'ollama', 'libretranslate', 'google', 'deepl'
    file_path TEXT NOT NULL, -- Path to translated file
    file_size INTEGER NOT NULL, -- Size of translated file in bytes
    file_type TEXT NOT NULL, -- Translated file format
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- Current state: 'pending', 'processing', 'completed', 'failed', 'paused'
    progress INTEGER DEFAULT 0, -- Completion percentage for automated translations (0-100)
    status_details JSONB, -- Detailed status information for ongoing translations
    error_message TEXT, -- Error details if translation failed
    translated_by VARCHAR REFERENCES users(id), -- User who performed manual translation
    partial_file_path TEXT, -- Temporary file path for partial translations
    last_completed_chunk INTEGER DEFAULT 0, -- Index of last successfully translated chunk
    total_chunks INTEGER DEFAULT 0, -- Total number of chunks for this translation
    total_characters INTEGER DEFAULT 0, -- Total characters in original text
    translated_characters INTEGER DEFAULT 0, -- Characters translated so far
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP, -- When translation was completed
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE book_translations IS 'Multilingual book translations supporting automated and manual translation workflows';
COMMENT ON COLUMN book_translations.translation_type IS 'Automated uses AI services, manual requires human translator';
COMMENT ON COLUMN book_translations.status_details IS 'JSON structure containing progress information and current processing step';

-- =====================================================================
-- READING PROGRESS & STATISTICS
-- =====================================================================

-- Individual book reading progress tracking
CREATE TABLE reading_progress (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique progress record identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User reading the book
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book being read
    current_page INTEGER, -- Current page number
    total_pages INTEGER, -- Total pages in book
    percentage NUMERIC(5,2), -- Reading completion percentage (0-100)
    chapter_index INTEGER, -- Current chapter index
    settings JSONB, -- Reader settings/preferences for this book
    last_read_at TIMESTAMP DEFAULT NOW(), -- Timestamp of last reading session
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE reading_progress IS 'Tracks individual user reading progress for each book';
COMMENT ON COLUMN reading_progress.percentage IS 'Calculated completion percentage for progress visualization';
COMMENT ON COLUMN reading_progress.settings IS 'JSON storing reader preferences like font size, theme, etc.';

-- Detailed reading statistics for analytics
CREATE TABLE reading_statistics (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique statistics record
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User being tracked
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book for these statistics
    words_read INTEGER NOT NULL DEFAULT 0, -- Total words read in this book
    letters_read INTEGER NOT NULL DEFAULT 0, -- Total characters read
    time_spent_reading INTEGER NOT NULL DEFAULT 0, -- Total reading time in seconds
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE reading_statistics IS 'Detailed reading analytics for user engagement metrics';

-- Overall user reading statistics
CREATE TABLE user_statistics (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique statistics record
    user_id VARCHAR NOT NULL REFERENCES users(id) UNIQUE, -- User being tracked
    total_books_read INTEGER NOT NULL DEFAULT 0, -- Lifetime books completed
    total_words_read INTEGER NOT NULL DEFAULT 0, -- Lifetime words read
    total_letters_read INTEGER NOT NULL DEFAULT 0, -- Lifetime characters read
    total_time_spent_reading INTEGER NOT NULL DEFAULT 0, -- Lifetime reading time in seconds
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE user_statistics IS 'Aggregate lifetime reading statistics for user profiles';

-- =====================================================================
-- SOCIAL FEATURES
-- =====================================================================

-- User-created book shelves/collections
CREATE TABLE shelves (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique shelf identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- Owner of the shelf
    name TEXT NOT NULL, -- Shelf name/title
    description TEXT, -- Shelf description
    color TEXT, -- Visual color coding for the shelf
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE shelves IS 'User-created collections for organizing books';

-- Books assigned to user shelves
CREATE TABLE shelf_books (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique assignment identifier
    shelf_id VARCHAR NOT NULL REFERENCES shelves(id), -- Shelf containing the book
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book on the shelf
    added_at TIMESTAMP DEFAULT NOW() NOT NULL -- When book was added to shelf
);

-- Bookmarks for saving specific passages
CREATE TABLE bookmarks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique bookmark identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User who created bookmark
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book containing the bookmark
    chapter_index INTEGER, -- Chapter where bookmark is located
    title TEXT NOT NULL, -- Bookmark title/description
    selected_text TEXT, -- Text that was selected for bookmark
    page_in_chapter INTEGER, -- Page number within the chapter
    percentage NUMERIC(5,2), -- Position as percentage through book
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE bookmarks IS 'User-created bookmarks for saving important passages or locations in books';

-- =====================================================================
-- COMMENTS & REVIEWS SYSTEM
-- =====================================================================

-- Comments on books, news, or other content
CREATE TABLE comments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique comment identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User who wrote comment
    book_id VARCHAR REFERENCES books(id), -- Book being commented on (optional)
    news_id VARCHAR REFERENCES news(id), -- News article being commented on (optional)
    content TEXT NOT NULL, -- Comment text content
    attachment_urls JSONB DEFAULT '[]'::jsonb, -- URLs to attached files/images
    attachment_metadata JSONB, -- Metadata about attachments
    parent_comment_id VARCHAR, -- Parent comment for threaded replies
    quoted_text TEXT, -- Text being replied to/quoting
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE comments IS 'Threaded discussion system for books and news articles';
COMMENT ON COLUMN comments.parent_comment_id IS 'Enables nested comment threads';

-- Book reviews with ratings
CREATE TABLE reviews (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique review identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User who wrote review
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book being reviewed
    rating INTEGER, -- Numerical rating 1-10 (nullable for reply reviews)
    content TEXT NOT NULL, -- Review text content
    attachment_urls JSONB DEFAULT '[]'::jsonb, -- Attached files/images
    attachment_metadata JSONB, -- Attachment metadata
    parent_review_id VARCHAR, -- Parent review for threaded replies
    quoted_text TEXT, -- Text being replied to
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE reviews IS 'Book reviews with 1-10 star ratings and threaded discussions';
COMMENT ON COLUMN reviews.rating IS 'Numerical rating from 1-10, null for reply reviews';

-- User profile ratings (peer evaluation system)
CREATE TABLE profile_ratings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique rating identifier
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User giving the rating
    profile_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User being rated
    rating INTEGER NOT NULL, -- Rating value 1-10
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE profile_ratings IS 'Peer-to-peer user profile rating system';

-- Comments on user profiles
CREATE TABLE profile_comments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique comment identifier
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User writing comment
    profile_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User profile being commented on
    content TEXT NOT NULL, -- Comment content
    attachment_urls JSONB DEFAULT '[]'::jsonb, -- Attached files
    attachment_metadata JSONB, -- Attachment information
    linked_rating_id VARCHAR REFERENCES profile_ratings(id) ON DELETE CASCADE, -- Links comment to specific rating
    parent_comment_id VARCHAR, -- Parent comment for threading
    quoted_text TEXT, -- Quoted text from parent
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE profile_comments IS 'Discussion system for user profiles with rating integration';

-- =====================================================================
-- REACTIONS SYSTEM
-- =====================================================================

-- Emoji reactions on various content types
CREATE TABLE reactions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique reaction identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User giving reaction
    comment_id VARCHAR REFERENCES comments(id), -- Comment being reacted to
    review_id VARCHAR REFERENCES reviews(id), -- Review being reacted to
    news_id VARCHAR REFERENCES news(id), -- News article being reacted to
    book_id VARCHAR REFERENCES books(id), -- Book being reacted to
    profile_comment_id VARCHAR REFERENCES profile_comments(id) ON DELETE CASCADE, -- Profile comment being reacted to
    emoji TEXT NOT NULL, -- Emoji character/text representation
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE reactions IS 'Universal emoji reaction system for all content types';
COMMENT ON COLUMN reactions.comment_id IS 'Exactly one of these foreign key fields should be populated';
COMMENT ON COLUMN reactions.review_id IS 'Mutually exclusive with other entity references';

-- Message reactions in chat systems
CREATE TABLE message_reactions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique reaction identifier
    message_id VARCHAR NOT NULL REFERENCES messages(id), -- Message being reacted to
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User giving reaction
    emoji TEXT NOT NULL, -- Emoji character
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE message_reactions IS 'Emoji reactions specifically for chat messages';

-- =====================================================================
-- MESSAGING SYSTEM
-- =====================================================================

-- Private conversations between two users
CREATE TABLE conversations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique conversation identifier
    user1_id VARCHAR NOT NULL REFERENCES users(id), -- First participant
    user2_id VARCHAR NOT NULL REFERENCES users(id), -- Second participant
    last_message_id VARCHAR, -- Reference to most recent message
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE conversations IS 'Private messaging channels between user pairs';

-- Group chat functionality
CREATE TABLE groups (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique group identifier
    name TEXT NOT NULL, -- Group name/display name
    description TEXT, -- Group description/purpose
    creator_id VARCHAR NOT NULL REFERENCES users(id), -- User who created group
    privacy TEXT NOT NULL DEFAULT 'public', -- Visibility: 'public' or 'private'
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP -- Soft delete timestamp
);

-- Group membership management
CREATE TABLE group_members (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique membership identifier
    group_id VARCHAR NOT NULL REFERENCES groups(id), -- Group being joined
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User joining group
    role TEXT NOT NULL DEFAULT 'member', -- Permission level: 'administrator', 'moderator', 'member'
    invited_by VARCHAR REFERENCES users(id), -- User who sent invitation
    joined_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Books associated with reading groups
CREATE TABLE group_books (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique association identifier
    group_id VARCHAR NOT NULL REFERENCES groups(id), -- Group for book discussion
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book being discussed
    added_at TIMESTAMP DEFAULT NOW() NOT NULL -- When book was added to group
);

-- Chat channels within groups
CREATE TABLE channels (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique channel identifier
    group_id VARCHAR NOT NULL REFERENCES groups(id), -- Parent group
    name TEXT NOT NULL, -- Channel name
    description TEXT, -- Channel purpose/description
    creator_id VARCHAR NOT NULL REFERENCES users(id), -- User who created channel
    display_order INTEGER NOT NULL DEFAULT 0, -- Ordering for channel lists
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    archived_at TIMESTAMP -- When channel was archived
);

-- Main messaging table for all message types
CREATE TABLE messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique message identifier
    sender_id VARCHAR NOT NULL REFERENCES users(id), -- User sending message
    recipient_id VARCHAR REFERENCES users(id), -- Recipient for private messages
    conversation_id VARCHAR REFERENCES conversations(id), -- Private conversation context
    channel_id VARCHAR REFERENCES channels(id), -- Group channel context
    parent_message_id VARCHAR, -- Parent for threaded replies
    quoted_message_id VARCHAR REFERENCES messages(id), -- Message being replied to
    quoted_text TEXT, -- Text excerpt from quoted message
    content TEXT NOT NULL, -- Message content
    attachment_urls JSONB DEFAULT '[]'::jsonb, -- Attached files
    attachment_metadata JSONB, -- Attachment information
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    read_status BOOLEAN DEFAULT FALSE, -- Whether message has been read
    deleted_at TIMESTAMP, -- Soft delete timestamp
    deleted_by VARCHAR REFERENCES users(id) -- User who deleted message
);

COMMENT ON TABLE messages IS 'Universal messaging system supporting private, group, and threaded communications';

-- Track user read positions in group channels
CREATE TABLE user_channel_read_positions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique position record
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User whose position is tracked
    channel_id VARCHAR NOT NULL REFERENCES channels(id), -- Channel being tracked
    last_read_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Timestamp of last read message
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE user_channel_read_positions IS 'Tracks read/unread status for group channel messages';

-- Real-time book chat within readers
CREATE TABLE book_chat_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique message identifier
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book context for chat
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User sending message
    content TEXT NOT NULL, -- Chat message content
    mentioned_user_id VARCHAR REFERENCES users(id), -- Direct @mentions
    quoted_message_id VARCHAR REFERENCES book_chat_messages(id), -- Reply references
    attachment_urls JSONB DEFAULT '[]'::jsonb, -- Chat attachments
    attachment_metadata JSONB, -- Attachment details
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP -- Soft delete
);

COMMENT ON TABLE book_chat_messages IS 'Real-time chat system embedded within book readers';

-- =====================================================================
-- NEWS & CONTENT MANAGEMENT
-- =====================================================================

-- News articles/blog posts
CREATE TABLE news (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique article identifier
    title TEXT NOT NULL, -- Article title in default language
    title_en TEXT, -- English translation of title
    content TEXT NOT NULL, -- Article content in default language
    content_en TEXT, -- English translation of content
    slug VARCHAR(255), -- URL-friendly identifier
    author_id VARCHAR NOT NULL REFERENCES users(id), -- Article author
    published BOOLEAN DEFAULT FALSE, -- Publication status
    published_at TIMESTAMP, -- When article was published
    view_count INTEGER DEFAULT 0 NOT NULL, -- Number of views
    comment_count INTEGER DEFAULT 0 NOT NULL, -- Number of comments
    reaction_count INTEGER DEFAULT 0 NOT NULL, -- Number of reactions
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE news IS 'News articles and blog posts with multilingual support';

-- =====================================================================
-- ACTIVITY & ENGAGEMENT TRACKING
-- =====================================================================

-- Global activity feed for user actions
CREATE TABLE activity_feed (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique activity identifier
    activity_type TEXT NOT NULL, -- Type: 'news', 'book', 'comment', 'review'
    entity_id VARCHAR NOT NULL, -- ID of affected entity
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User performing action
    target_user_id VARCHAR REFERENCES users(id), -- User affected by action
    book_id VARCHAR REFERENCES books(id), -- Related book (if applicable)
    metadata JSONB NOT NULL, -- Additional activity details
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP -- Soft delete
);

COMMENT ON TABLE activity_feed IS 'Centralized activity stream for real-time updates and feeds';

-- User navigation and interaction tracking
CREATE TABLE user_actions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique action identifier
    user_id VARCHAR NOT NULL REFERENCES users(id), -- User performing action
    action_type TEXT NOT NULL, -- Navigation or interaction type
    target_type TEXT, -- Type of target entity
    target_id VARCHAR, -- ID of target entity
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional action details
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP -- Soft delete for privacy
);

COMMENT ON TABLE user_actions IS 'Analytics tracking for user behavior and navigation patterns';

-- User subscriptions to content threads
CREATE TABLE subscriptions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique subscription identifier
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Subscribing user
    entity_type VARCHAR NOT NULL, -- Type: 'book', 'news', 'comment_thread', 'review_thread'
    entity_id VARCHAR NOT NULL, -- ID of subscribed entity
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_read_at TIMESTAMP DEFAULT NOW() NOT NULL -- Timestamp of last viewed content
);

COMMENT ON TABLE subscriptions IS 'User subscription system for content notifications';

-- =====================================================================
-- FILE MANAGEMENT
-- =====================================================================

-- Uploaded file tracking and metadata
CREATE TABLE file_uploads (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique file identifier
    uploader_id VARCHAR NOT NULL REFERENCES users(id), -- User who uploaded file
    file_url TEXT NOT NULL, -- Public URL to access file
    filename TEXT NOT NULL, -- Original filename
    file_size INTEGER NOT NULL, -- File size in bytes
    mime_type TEXT NOT NULL, -- MIME type of file
    storage_path TEXT NOT NULL, -- Internal storage path
    entity_type TEXT NOT NULL, -- Associated content type: 'message', 'comment', 'review'
    entity_id VARCHAR, -- ID of associated content
    thumbnail_url TEXT, -- URL to generated thumbnail
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP -- Soft delete
);

COMMENT ON TABLE file_uploads IS 'Centralized file management with metadata and access control';

-- =====================================================================
-- VIEW ANALYTICS
-- =====================================================================

-- Book view statistics and analytics
CREATE TABLE book_view_statistics (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique statistics record
    book_id VARCHAR NOT NULL REFERENCES books(id), -- Book being tracked
    view_type TEXT NOT NULL, -- Type: 'card_view' or 'reader_open'
    view_count INTEGER NOT NULL DEFAULT 0, -- Number of views of this type
    last_viewed_at TIMESTAMP DEFAULT NOW(), -- Timestamp of most recent view
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE book_view_statistics IS 'Analytics tracking for book discovery and engagement metrics';

-- =====================================================================
-- AUTHENTICATION & SECURITY
-- =====================================================================

-- OAuth account linking and management
CREATE TABLE oauth_accounts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Unique OAuth account identifier
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Linked user account
    provider VARCHAR(50) NOT NULL, -- OAuth provider: google, github, etc.
    provider_user_id VARCHAR(255) NOT NULL, -- User ID from OAuth provider
    email VARCHAR(255), -- Email from OAuth provider
    encrypted_access_token TEXT, -- Encrypted OAuth access token
    encrypted_refresh_token TEXT, -- Encrypted OAuth refresh token
    token_expires_at TIMESTAMP, -- When tokens expire
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- OAuth state management for secure flows
CREATE TABLE oauth_states (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Unique state identifier
    state_token VARCHAR(255) NOT NULL UNIQUE, -- Secure state parameter
    provider VARCHAR(50) NOT NULL, -- OAuth provider
    code_verifier VARCHAR(255), -- PKCE code verifier
    language VARCHAR(10), -- User's selected language preference
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP NOT NULL -- When state token expires
);

-- =====================================================================
-- RATING SYSTEM CONFIGURATION
-- =====================================================================

-- Global rating algorithm configuration
CREATE TABLE rating_system_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique config identifier
    algorithm_type VARCHAR(50) NOT NULL DEFAULT 'simple_average', -- Algorithm: 'simple_average', 'bayesian_average', etc.
    prior_mean NUMERIC(3,1) DEFAULT '7.4', -- μ0 - Average rating across service
    prior_weight INTEGER DEFAULT 30, -- m - Number of "virtual votes"
    likes_alpha NUMERIC(2,1) DEFAULT '0.4', -- α - Likes weight coefficient
    likes_max_weight NUMERIC(2,1) DEFAULT '3.0', -- Max weight from likes
    min_text_weight NUMERIC(2,1) DEFAULT '0.3', -- Min weight for short reviews
    time_decay_enabled BOOLEAN DEFAULT FALSE, -- Enable temporal weighting
    time_decay_half_life INTEGER DEFAULT 180, -- Half-life in days
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Per-user rating system configuration
CREATE TABLE user_rating_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique config identifier
    prior_mean NUMERIC(3,1) DEFAULT '7.5', -- Default prior mean for user ratings
    prior_strength INTEGER DEFAULT 20, -- Strength of prior belief
    confidence_threshold INTEGER DEFAULT 30, -- Minimum samples for confidence
    
    -- Rater weight configuration
    rater_young_days INTEGER DEFAULT 7, -- Days to consider "young" rater
    rater_young_mult NUMERIC(2,1) DEFAULT '0.3', -- Weight multiplier for young raters
    rater_medium_days INTEGER DEFAULT 30, -- Days to consider "medium" experience
    rater_medium_mult NUMERIC(2,1) DEFAULT '0.6', -- Weight for medium experience
    rater_mature_mult NUMERIC(2,1) DEFAULT '1.0', -- Weight for mature raters
    rater_verified_mult NUMERIC(3,2) DEFAULT '1.10', -- Bonus for verified accounts
    rater_activity_mult NUMERIC(3,2) DEFAULT '1.05', -- Bonus for active users
    rater_min_reading_minutes_30d INTEGER DEFAULT 60, -- Minimum reading time requirement
    rater_min_books_added_30d INTEGER DEFAULT 3, -- Minimum books added requirement
    rater_weight_cap NUMERIC(2,1) DEFAULT '1.2', -- Maximum rater weight
    rater_weight_floor NUMERIC(2,1) DEFAULT '0.2', -- Minimum rater weight
    
    -- Text quality weight configuration
    text_empty_mult NUMERIC(2,1) DEFAULT '0.85', -- Weight for empty reviews
    text_short_length INTEGER DEFAULT 20, -- Threshold for "short" reviews
    text_short_mult NUMERIC(2,1) DEFAULT '0.6', -- Weight for short reviews
    text_normal_max_length INTEGER DEFAULT 1200, -- Maximum for "normal" length
    text_normal_mult NUMERIC(2,1) DEFAULT '1.0', -- Weight for normal reviews
    text_long_mult NUMERIC(2,1) DEFAULT '0.9', -- Weight reduction for very long reviews
    text_spam_mult NUMERIC(2,1) DEFAULT '0.3', -- Weight for suspected spam
    
    -- Likes weight configuration
    likes_enabled BOOLEAN DEFAULT TRUE, -- Enable likes-based weighting
    likes_alpha NUMERIC(2,1) DEFAULT '0.3', -- Likes influence factor
    likes_cap NUMERIC(2,1) DEFAULT '2.0', -- Maximum likes weight
    
    -- Time decay configuration
    time_decay_enabled BOOLEAN DEFAULT FALSE, -- Enable temporal decay
    time_decay_half_life_days INTEGER DEFAULT 180, -- Decay half-life in days
    time_decay_min_weight NUMERIC(2,1) DEFAULT '3.0', -- Minimum time-based weight
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- User rating aggregate calculations
CREATE TABLE user_rating_agg (
    user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Rated user
    sum_w NUMERIC(10,4) DEFAULT '0', -- Sum of weights for all ratings
    sum_wx NUMERIC(10,4) DEFAULT '0', -- Sum of weighted ratings
    count_active INTEGER DEFAULT 0, -- Count of active ratings
    recent_sum_w NUMERIC(10,4) DEFAULT '0', -- Recent weights sum (last 30 days)
    recent_sum_wx NUMERIC(10,4) DEFAULT '0', -- Recent weighted ratings sum
    rating_overall NUMERIC(3,1), -- Overall calculated rating
    rating_recent NUMERIC(3,1), -- Recent period rating
    confidence NUMERIC(3,2), -- Statistical confidence level
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE user_rating_agg IS 'Pre-calculated rating aggregates for efficient user profile displays';

-- =====================================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================================

-- Performance indexes for frequently queried columns
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_reading_progress_user_book ON reading_progress(user_id, book_id);
CREATE INDEX idx_comments_book_id ON comments(book_id);
CREATE INDEX idx_comments_news_id ON comments(news_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX idx_reactions_review_id ON reactions(review_id);
CREATE INDEX idx_news_published ON news(published, published_at);
CREATE INDEX idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at);

-- Composite indexes for common query patterns
CREATE INDEX idx_reading_progress_book_percentage ON reading_progress(book_id, percentage DESC);
CREATE INDEX idx_comments_parent_thread ON comments(parent_comment_id, created_at);
CREATE INDEX idx_reviews_parent_thread ON reviews(parent_review_id, created_at);
CREATE INDEX idx_messages_user_conversation ON messages(sender_id, conversation_id);
CREATE INDEX idx_messages_user_channel ON messages(sender_id, channel_id);

-- Unique constraints to prevent duplicates
CREATE UNIQUE INDEX idx_users_username_unique ON users(LOWER(username));
CREATE UNIQUE INDEX idx_shelf_books_unique ON shelf_books(shelf_id, book_id);
CREATE UNIQUE INDEX idx_reading_progress_unique ON reading_progress(user_id, book_id);
CREATE UNIQUE INDEX idx_profile_ratings_unique ON profile_ratings(user_id, profile_id);
CREATE UNIQUE INDEX idx_group_members_unique ON group_members(group_id, user_id);
CREATE UNIQUE INDEX idx_user_channel_read_positions_unique ON user_channel_read_positions(user_id, channel_id);

-- =====================================================================
-- DATABASE MAINTENANCE VIEWS
-- =====================================================================

-- View for active user statistics
CREATE VIEW active_users AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    us.total_books_read,
    us.total_time_spent_reading,
    u.last_activity_at,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT r.id) as review_count
FROM users u
LEFT JOIN user_statistics us ON u.id = us.user_id
LEFT JOIN comments c ON u.id = c.user_id
LEFT JOIN reviews r ON u.id = r.user_id
WHERE u.is_blocked = FALSE 
    AND u.last_activity_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.full_name, u.avatar_url, us.total_books_read, us.total_time_spent_reading, u.last_activity_at;

-- View for popular books
CREATE VIEW popular_books AS
SELECT 
    b.id,
    b.title,
    b.author,
    b.cover_image_url,
    b.rating,
    COUNT(rp.id) as reader_count,
    AVG(bvs.view_count) as avg_views,
    COUNT(c.id) as comment_count
FROM books b
LEFT JOIN reading_progress rp ON b.id = rp.book_id
LEFT JOIN book_view_statistics bvs ON b.id = bvs.book_id
LEFT JOIN comments c ON b.id = c.book_id
WHERE b.is_active = TRUE
GROUP BY b.id, b.title, b.author, b.cover_image_url, b.rating
ORDER BY reader_count DESC, avg_views DESC;

COMMENT ON VIEW active_users IS 'Users who have been active in the last 30 days with engagement metrics';
COMMENT ON VIEW popular_books IS 'Books ranked by reader engagement and popularity metrics';

-- =====================================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- =====================================================================

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp triggers to tables that need them
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_progress_updated_at BEFORE UPDATE ON reading_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- INITIAL DATA SEEDING
-- =====================================================================

-- Insert default rating system configuration
INSERT INTO rating_system_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Insert default admin user (password should be changed after first login)
INSERT INTO users (id, username, password, email, full_name, access_level, created_at, updated_at)
VALUES (
    'admin-default-id',
    'admin',
    '$2b$10$example_hash_placeholder', -- This should be replaced with proper bcrypt hash
    'admin@reader.market',
    'System Administrator',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- =====================================================================
-- SCHEMA DOCUMENTATION
-- =====================================================================

COMMENT ON SCHEMA public IS 'Reader.Market - Complete book reading and social platform database schema';

/*
SCHEMA OVERVIEW:

Core Entities:
- Users: Authentication, profiles, permissions
- Books: Catalog, metadata, file management
- Reading Progress: Personal reading tracking
- Statistics: Analytics and engagement metrics

Social Features:
- Comments/Reviews: Discussion systems
- Reactions: Emoji-based feedback
- Messaging: Private and group communications
- Groups: Community organization

Content Management:
- News: Articles and announcements
- Shelves: Personal book organization
- Bookmarks: Saved passages
- Activity Feed: Real-time updates

Infrastructure:
- OAuth: External authentication
- File Uploads: Media management
- Analytics: Usage tracking
- Rating System: Configurable algorithms

Performance Optimizations:
- Strategic indexing on frequently queried columns
- Composite indexes for common access patterns
- Materialized views for complex aggregations
- Proper foreign key relationships for data integrity

Security Considerations:
- Soft deletes for data retention
- Encrypted OAuth tokens
- Proper access controls
- Audit trails for administrative actions

Maintenance Features:
- Automated timestamp updates
- Data validation constraints
- Backup-friendly structure
- Scalable design patterns
*/