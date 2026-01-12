-- Migration: Add activity_feed table for stream feature
-- Created: 2026-01-12

CREATE TABLE IF NOT EXISTS activity_feed (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('news', 'book', 'comment', 'review')),
  entity_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  book_id VARCHAR REFERENCES books(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_feed_type_created 
  ON activity_feed(activity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_target_user_created 
  ON activity_feed(target_user_id, created_at DESC) 
  WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_feed_entity 
  ON activity_feed(entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_book_created 
  ON activity_feed(book_id, created_at DESC) 
  WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_feed_user 
  ON activity_feed(user_id);

-- Add comment for documentation
COMMENT ON TABLE activity_feed IS 'Stores activity stream entries for news, books, comments, and reviews';
COMMENT ON COLUMN activity_feed.activity_type IS 'Type of activity: news, book, comment, or review';
COMMENT ON COLUMN activity_feed.entity_id IS 'ID of the entity (news/book/comment/review)';
COMMENT ON COLUMN activity_feed.user_id IS 'User who performed the action';
COMMENT ON COLUMN activity_feed.target_user_id IS 'Target user for personal notifications (optional)';
COMMENT ON COLUMN activity_feed.book_id IS 'Related book ID for shelf filtering (optional)';
COMMENT ON COLUMN activity_feed.metadata IS 'JSONB containing activity-specific data';
COMMENT ON COLUMN activity_feed.deleted_at IS 'Soft delete timestamp';
-- Migration: Add activity_feed table for stream feature
-- Created: 2026-01-12

CREATE TABLE IF NOT EXISTS activity_feed (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('news', 'book', 'comment', 'review')),
  entity_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  book_id VARCHAR REFERENCES books(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_feed_type_created 
  ON activity_feed(activity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_target_user_created 
  ON activity_feed(target_user_id, created_at DESC) 
  WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_feed_entity 
  ON activity_feed(entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_book_created 
  ON activity_feed(book_id, created_at DESC) 
  WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_feed_user 
  ON activity_feed(user_id);

-- Add comment for documentation
COMMENT ON TABLE activity_feed IS 'Stores activity stream entries for news, books, comments, and reviews';
COMMENT ON COLUMN activity_feed.activity_type IS 'Type of activity: news, book, comment, or review';
COMMENT ON COLUMN activity_feed.entity_id IS 'ID of the entity (news/book/comment/review)';
COMMENT ON COLUMN activity_feed.user_id IS 'User who performed the action';
COMMENT ON COLUMN activity_feed.target_user_id IS 'Target user for personal notifications (optional)';
COMMENT ON COLUMN activity_feed.book_id IS 'Related book ID for shelf filtering (optional)';
COMMENT ON COLUMN activity_feed.metadata IS 'JSONB containing activity-specific data';
COMMENT ON COLUMN activity_feed.deleted_at IS 'Soft delete timestamp';
