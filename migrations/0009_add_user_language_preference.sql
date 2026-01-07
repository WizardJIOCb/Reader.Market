-- Add language preference column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);

-- Backfill existing users with default language
UPDATE users SET language = 'en' WHERE language IS NULL;
