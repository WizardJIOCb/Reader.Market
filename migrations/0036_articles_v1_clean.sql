-- Clean migration for articles v1 system

-- Ensure the required enums exist
CREATE TYPE IF NOT EXISTS article_section_enum AS ENUM (
  'news',     -- announcements/releases/industry news
  'reviews',  -- reviews/opinions
  'collections',       -- lists/top/picks
  'guides',            -- how-to/reading guides
  'world',         -- awards/events/adaptations/publishing
  'community',         -- challenges/club posts/user posts
  'product'            -- Reader.Market updates/help
);

CREATE TYPE IF NOT EXISTS article_format_enum AS ENUM (
  'announcement',
  'release',
  'translation',
  'review',
  'list',
  'analysis',
  'event',
  'note'
);

CREATE TYPE IF NOT EXISTS article_status_enum AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE IF NOT EXISTS article_tag_axis_enum AS ENUM (
  'genre',
  'theme',
  'mood',
  'country',
  'award',
  'language',
  'other'
);

-- Update article_books table structure if it exists
DO $$
BEGIN
  -- Check if article_books table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'article_books') THEN
    -- Add columns if they don't exist
    BEGIN
      ALTER TABLE article_books ADD COLUMN IF NOT EXISTS id VARCHAR(255) DEFAULT gen_random_uuid();
      ALTER TABLE article_books ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'mentioned';
      ALTER TABLE article_books ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    EXCEPTION
      WHEN duplicate_column THEN
        RAISE NOTICE 'Columns already exist in article_books, skipping';
    END;
    
    -- Add primary key constraint if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'article_books_pkey' AND table_name = 'article_books') THEN
      ALTER TABLE article_books ADD CONSTRAINT article_books_pkey PRIMARY KEY (id);
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'article_books_article_id_book_id_key' AND table_name = 'article_books') THEN
      ALTER TABLE article_books ADD CONSTRAINT article_books_article_id_book_id_key UNIQUE (article_id, book_id);
    END IF;
  ELSE
    -- Create table if it doesn't exist
    CREATE TABLE article_books (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id VARCHAR(255) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      book_id VARCHAR(255) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'mentioned',
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(article_id, book_id)
    );
  END IF;
END $$;

-- Update article_tags table structure if it exists
DO $$
BEGIN
  -- Check if article_tags table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'article_tags') THEN
    -- Add axis column if it doesn't exist
    BEGIN
      ALTER TABLE article_tags ADD COLUMN IF NOT EXISTS axis TEXT DEFAULT 'other';
    EXCEPTION
      WHEN duplicate_column THEN
        RAISE NOTICE 'axis column already exists in article_tags, skipping';
    END;
  ELSE
    -- Create table if it doesn't exist
    CREATE TABLE article_tags (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      axis TEXT NOT NULL DEFAULT 'other', -- genre|theme|mood|country|award|language|other
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      UNIQUE(axis, slug)
    );
  END IF;
END $$;

-- Update article_tag_links table structure if it exists
DO $$
BEGIN
  -- Check if article_tag_links table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'article_tag_links') THEN
    -- Add id column if it doesn't exist
    BEGIN
      ALTER TABLE article_tag_links ADD COLUMN IF NOT EXISTS id VARCHAR(255) DEFAULT gen_random_uuid();
    EXCEPTION
      WHEN duplicate_column THEN
        RAISE NOTICE 'id column already exists in article_tag_links, skipping';
    END;
    
    -- Add primary key constraint if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'article_tag_links_pkey' AND table_name = 'article_tag_links') THEN
      ALTER TABLE article_tag_links ADD CONSTRAINT article_tag_links_pkey PRIMARY KEY (id);
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'article_tag_links_article_id_tag_id_key' AND table_name = 'article_tag_links') THEN
      ALTER TABLE article_tag_links ADD CONSTRAINT article_tag_links_article_id_tag_id_key UNIQUE (article_id, tag_id);
    END IF;
  ELSE
    -- Create table if it doesn't exist
    CREATE TABLE article_tag_links (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id VARCHAR(255) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id VARCHAR(255) NOT NULL REFERENCES article_tags(id) ON DELETE CASCADE,
      UNIQUE(article_id, tag_id)
    );
  END IF;
END $$;

-- Add missing columns to articles table if they don't exist
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS section TEXT; -- Will use article_section_enum
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS format TEXT; -- Will use article_format_enum
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'; -- Will use article_status_enum
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ru';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt TEXT;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_json JSONB;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_text TEXT;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE;
    
    -- Remove old columns if they exist
    ALTER TABLE articles DROP COLUMN IF EXISTS category CASCADE;
    ALTER TABLE articles DROP COLUMN IF EXISTS type CASCADE;
    ALTER TABLE articles DROP COLUMN IF EXISTS content_md CASCADE;
    ALTER TABLE articles DROP COLUMN IF EXISTS is_pinned CASCADE;
    ALTER TABLE articles DROP COLUMN IF EXISTS author_id CASCADE;
    
    -- Update foreign key column name if needed
    ALTER TABLE articles RENAME COLUMN author_user_id TO author_user_id;
    
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column already exists, skipping';
  END;
END $$;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS articles_section_idx ON articles(section);
CREATE INDEX IF NOT EXISTS articles_format_idx ON articles(format);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at);

-- Add index for book relationships
CREATE INDEX IF NOT EXISTS article_books_book_idx ON article_books(book_id);

-- Remove discussion-related tables if they exist
DROP TABLE IF EXISTS discussion_subscriptions CASCADE;
DROP TABLE IF EXISTS discussion_views CASCADE;
DROP TABLE IF EXISTS discussion_posts CASCADE;
DROP TABLE IF EXISTS discussions CASCADE;
DROP TABLE IF EXISTS discussion_categories CASCADE;

-- Update any existing articles to use the new enum values if they had old category/type values
-- This is a simplified approach - in practice you'd map old values to new ones