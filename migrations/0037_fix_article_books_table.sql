-- Fix article_books table structure to match the schema definition
-- This migration adds the missing id column and converts from composite primary key to proper structure

-- First, check if the id column exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_books' AND column_name = 'id') THEN
    -- Add id column as the primary key
    ALTER TABLE article_books ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Add the missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_books' AND column_name = 'role') THEN
    ALTER TABLE article_books ADD COLUMN role TEXT NOT NULL DEFAULT 'mentioned';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_books' AND column_name = 'sort_order') THEN
    ALTER TABLE article_books ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_books' AND column_name = 'note') THEN
    ALTER TABLE article_books ADD COLUMN note TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_books' AND column_name = 'created_at') THEN
    ALTER TABLE article_books ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Add unique constraint on (article_id, book_id) if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'article_books' AND constraint_name = 'article_books_article_book_uq') THEN
    ALTER TABLE article_books ADD CONSTRAINT article_books_article_book_uq UNIQUE (article_id, book_id);
  END IF;
END $$;

-- Add index on book_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'article_books' AND indexname = 'article_books_book_idx') THEN
    CREATE INDEX IF NOT EXISTS article_books_book_idx ON article_books(book_id);
  END IF;
END $$;

-- Update any existing records to have proper default values for new columns
UPDATE article_books SET role = 'mentioned' WHERE role IS NULL;
UPDATE article_books SET sort_order = 0 WHERE sort_order IS NULL;