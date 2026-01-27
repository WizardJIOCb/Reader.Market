-- Migration: Add collection statistics and bookmark click tracking
-- Adds view counts for collections and click counts for bookmarks

-- Add view_count column to bookmark_collections
ALTER TABLE bookmark_collections 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add click_count column to bookmarks
ALTER TABLE bookmarks 
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookmark_collections_view_count ON bookmark_collections(view_count);
CREATE INDEX IF NOT EXISTS idx_bookmarks_click_count ON bookmarks(click_count);

-- Update comments
COMMENT ON COLUMN bookmark_collections.view_count IS 'Number of times this collection has been viewed';
COMMENT ON COLUMN bookmarks.click_count IS 'Number of times this bookmark has been clicked/navigated to';

-- Initialize existing records with default values
UPDATE bookmark_collections SET view_count = 0 WHERE view_count IS NULL;
UPDATE bookmarks SET click_count = 0 WHERE click_count IS NULL;