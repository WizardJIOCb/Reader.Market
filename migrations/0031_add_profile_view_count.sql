-- Add profile view count column to users table
ALTER TABLE users ADD COLUMN profile_view_count INTEGER DEFAULT 0;

-- Add index for better performance when querying by view count
CREATE INDEX IF NOT EXISTS idx_users_profile_view_count ON users(profile_view_count);