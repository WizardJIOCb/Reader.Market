-- Add reply support to book/news comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS quoted_text TEXT;

-- Create index for faster reply lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
