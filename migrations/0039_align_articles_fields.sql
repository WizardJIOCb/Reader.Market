-- Align articles table fields between migration and schema
-- This migration addresses field name conflicts and ensures consistency

-- Ensure author_user_id column exists and is named correctly
DO $$ 
BEGIN
  -- Check if author_user_id column exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'author_user_id') THEN
    -- If author_id exists, rename it to author_user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'author_id') THEN
      ALTER TABLE articles RENAME COLUMN author_id TO author_user_id;
    ELSE
      -- Otherwise create the column
      ALTER TABLE articles ADD COLUMN author_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Ensure content_json column exists (preferred over content_html)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'content_json') THEN
    ALTER TABLE articles ADD COLUMN content_json JSONB;
  END IF;
END $$;

-- Ensure content_html column is removed if it exists (we prefer content_json)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'content_html') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS content_html;
  END IF;
END $$;

-- Ensure content_md column is removed if it exists (we prefer content_json)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'content_md') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS content_md;
  END IF;
END $$;

-- Ensure category_id column is removed if it exists (we use section/format instead)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'category_id') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS category_id;
  END IF;
END $$;

-- Ensure reply_to_article_id column is removed if it exists (we're not using reply functionality in v1)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'reply_to_article_id') THEN
    ALTER TABLE articles DROP COLUMN IF EXISTS reply_to_article_id;
  END IF;
END $$;

-- Ensure view_count column is renamed to views if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'view_count') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'views') THEN
      ALTER TABLE articles RENAME COLUMN view_count TO views;
    ELSE
      -- If both exist, consolidate the old one into the new one and drop old
      UPDATE articles SET views = COALESCE(views, 0) + COALESCE(view_count, 0);
      ALTER TABLE articles DROP COLUMN view_count;
    END IF;
  END IF;
  
  -- Ensure views column exists with correct name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'views') THEN
    ALTER TABLE articles ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add the new enum columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'section') THEN
    ALTER TABLE articles ADD COLUMN section TEXT; -- Will be constrained to enum later
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'format') THEN
    ALTER TABLE articles ADD COLUMN format TEXT; -- Will be constrained to enum later
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'status') THEN
    ALTER TABLE articles ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'; -- Will be constrained to enum later
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'lang') THEN
    ALTER TABLE articles ADD COLUMN lang TEXT NOT NULL DEFAULT 'ru';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'excerpt') THEN
    ALTER TABLE articles ADD COLUMN excerpt TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'cover_image_url') THEN
    ALTER TABLE articles ADD COLUMN cover_image_url TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'search_text') THEN
    ALTER TABLE articles ADD COLUMN search_text TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'comments_count') THEN
    ALTER TABLE articles ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'meta') THEN
    ALTER TABLE articles ADD COLUMN meta JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Create enum types if they don't exist
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

-- Now convert the text columns to use the enum types
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE articles ALTER COLUMN section TYPE article_section_enum USING section::article_section_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If there are invalid values, set them to null or default
      UPDATE articles SET section = NULL WHERE section NOT IN (
        'news', 'reviews', 'collections', 'guides', 'world', 'community', 'product'
      );
      ALTER TABLE articles ALTER COLUMN section TYPE article_section_enum USING section::article_section_enum;
  END;
END $$;

DO $$ 
BEGIN
  BEGIN
    ALTER TABLE articles ALTER COLUMN format TYPE article_format_enum USING format::article_format_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If there are invalid values, set them to null or default
      UPDATE articles SET format = NULL WHERE format NOT IN (
        'announcement', 'release', 'translation', 'review', 'list', 'analysis', 'event', 'note'
      );
      ALTER TABLE articles ALTER COLUMN format TYPE article_format_enum USING format::article_format_enum;
  END;
END $$;

DO $$ 
BEGIN
  BEGIN
    ALTER TABLE articles ALTER COLUMN status TYPE article_status_enum USING status::article_status_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If there are invalid values, set them to default
      UPDATE articles SET status = 'draft' WHERE status NOT IN ('draft', 'published', 'archived');
      ALTER TABLE articles ALTER COLUMN status TYPE article_status_enum USING status::article_status_enum;
  END;
END $$;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS articles_section_idx ON articles(section);
CREATE INDEX IF NOT EXISTS articles_format_idx ON articles(format);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_lang_idx ON articles(lang);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at);