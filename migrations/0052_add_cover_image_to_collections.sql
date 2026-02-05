-- Migration: Add cover image to bookmark collections
-- Adds cover_image_url column to bookmark_collections table

-- Add cover_image_url column to bookmark_collections table
ALTER TABLE bookmark_collections 
ADD COLUMN cover_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bookmark_collections.cover_image_url IS 'URL of the cover image for the collection';