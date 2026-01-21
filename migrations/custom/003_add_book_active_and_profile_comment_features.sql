-- Add isActive flag to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add reply/quote fields to profile_comments table
ALTER TABLE profile_comments ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR REFERENCES profile_comments(id) ON DELETE CASCADE;
ALTER TABLE profile_comments ADD COLUMN IF NOT EXISTS quoted_text TEXT;

-- Add profile comment support to reactions table
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS profile_comment_id VARCHAR REFERENCES profile_comments(id) ON DELETE CASCADE;

-- Create index for faster reply lookups
CREATE INDEX IF NOT EXISTS idx_profile_comments_parent ON profile_comments(parent_comment_id);

-- Create index for faster reaction lookups on profile comments
CREATE INDEX IF NOT EXISTS idx_reactions_profile_comment ON reactions(profile_comment_id);

-- Create index for faster active book filtering
CREATE INDEX IF NOT EXISTS idx_books_is_active ON books(is_active);
