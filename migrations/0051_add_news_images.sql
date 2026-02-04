-- Add image_url column to news table
ALTER TABLE "news" ADD COLUMN "image_urls" jsonb DEFAULT '[]'::jsonb;

-- Update the comment for the news table
COMMENT ON COLUMN news.image_urls IS 'URLs to images associated with the news article';