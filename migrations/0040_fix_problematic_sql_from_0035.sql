-- Fix problematic SQL from migration 0035 that may cause failures
-- Addresses issues identified by senior developer

-- Fix 1: Correct the enum update query that was causing failures
-- Instead of using unnest(enumlabel::text[]) where enumlabel is not an array, use proper approach

-- First, ensure all enum types exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_section_enum') THEN
    CREATE TYPE article_section_enum AS ENUM (
      'news',     
      'reviews',  
      'collections',       
      'guides',            
      'world',         
      'community',         
      'product'            
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_format_enum') THEN
    CREATE TYPE article_format_enum AS ENUM (
      'announcement',
      'release',
      'translation',
      'review',
      'list',
      'analysis',
      'event',
      'note'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status_enum') THEN
    CREATE TYPE article_status_enum AS ENUM (
      'draft',
      'published',
      'archived'
    );
  END IF;
END $$;

-- Fix 2: Handle the category_slug update safely
-- Check if category_slug column exists before attempting update
DO $$ 
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'articles' 
    AND column_name = 'category_slug'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Only run the update if category_slug column exists
    UPDATE articles 
    SET category_slug = ac.slug 
    FROM article_categories ac 
    WHERE articles.category_id = ac.id 
    AND articles.category_id IS NOT NULL;
  END IF;
END $$;

-- Fix 3: Safely update articles to use new enum fields from old fields
-- Only if the old fields exist and new fields are null
DO $$ 
BEGIN
  -- Update section from old category field if section is null
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'category') THEN
    UPDATE articles 
    SET section = category::text::article_section_enum
    WHERE section IS NULL 
    AND category IS NOT NULL
    AND category::text IN (
      'news', 'reviews', 'collections', 'guides', 'world', 'community', 'product'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  -- Update format from old type field if format is null
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'type') THEN
    UPDATE articles 
    SET format = type::text::article_format_enum
    WHERE format IS NULL 
    AND type IS NOT NULL
    AND type::text IN (
      'announcement', 'release', 'translation', 'review', 'list', 'analysis', 'event', 'note'
    );
  END IF;
END $$;

-- Fix 4: Clean up any old columns that should have been removed
-- But only if the new columns exist and have proper data
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'section') 
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'category') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS category;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'format') 
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'type') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS type;
  END IF;
END $$;

-- Fix 5: Ensure proper enum constraints on new columns
DO $$ 
BEGIN
  -- Try to add enum constraint to section column if it doesn't have it
  BEGIN
    ALTER TABLE articles ALTER COLUMN section TYPE article_section_enum USING section::article_section_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If conversion fails, set invalid values to null and try again
      UPDATE articles SET section = NULL WHERE 
        section IS NOT NULL AND 
        section NOT IN ('news', 'reviews', 'collections', 'guides', 'world', 'community', 'product');
      ALTER TABLE articles ALTER COLUMN section TYPE article_section_enum USING section::article_section_enum;
  END;
END $$;

DO $$ 
BEGIN
  -- Try to add enum constraint to format column if it doesn't have it
  BEGIN
    ALTER TABLE articles ALTER COLUMN format TYPE article_format_enum USING format::article_format_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If conversion fails, set invalid values to null and try again
      UPDATE articles SET format = NULL WHERE 
        format IS NOT NULL AND 
        format NOT IN ('announcement', 'release', 'translation', 'review', 'list', 'analysis', 'event', 'note');
      ALTER TABLE articles ALTER COLUMN format TYPE article_format_enum USING format::article_format_enum;
  END;
END $$;

DO $$ 
BEGIN
  -- Try to add enum constraint to status column if it doesn't have it
  BEGIN
    ALTER TABLE articles ALTER COLUMN status TYPE article_status_enum USING status::article_status_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If conversion fails, set invalid values to default and try again
      UPDATE articles SET status = 'draft' WHERE 
        status IS NOT NULL AND 
        status NOT IN ('draft', 'published', 'archived');
      ALTER TABLE articles ALTER COLUMN status TYPE article_status_enum USING status::article_status_enum;
  END;
END $$;

-- Add indexes that might have been missed
CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section);
CREATE INDEX IF NOT EXISTS idx_articles_format ON articles(format);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles(lang);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);