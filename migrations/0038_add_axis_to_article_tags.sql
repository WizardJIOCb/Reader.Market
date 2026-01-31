-- Add axis column to article_tags table to match schema definition
-- This addresses the issue where axis column was missing from the database but expected in schema

-- Add axis column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_tags' AND column_name = 'axis') THEN
    ALTER TABLE article_tags ADD COLUMN axis TEXT NOT NULL DEFAULT 'other';
  END IF;
END $$;

-- Update existing records to have proper axis value
UPDATE article_tags SET axis = 'other' WHERE axis IS NULL OR axis = '';

-- Create the article_tag_axis_enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_tag_axis_enum') THEN
    CREATE TYPE article_tag_axis_enum AS ENUM (
      'genre',
      'theme',
      'mood',
      'country',
      'award',
      'language',
      'other'
    );
  END IF;
END $$;

-- Try to alter the column type to use the enum, but handle potential issues gracefully
DO $$ 
BEGIN
  BEGIN
    -- Attempt to alter the column to use the enum type
    ALTER TABLE article_tags ALTER COLUMN axis TYPE article_tag_axis_enum USING axis::article_tag_axis_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If there are invalid values, update them first and retry
      UPDATE article_tags SET axis = 'other' WHERE axis NOT IN (
        'genre', 'theme', 'mood', 'country', 'award', 'language', 'other'
      );
      ALTER TABLE article_tags ALTER COLUMN axis TYPE article_tag_axis_enum USING axis::article_tag_axis_enum;
  END;
END $$;

-- Add index on axis column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_article_tags_axis ON article_tags(axis);

-- Add unique constraint on (axis, slug) if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'article_tags' AND constraint_name = 'article_tags_axis_slug_uq') THEN
    ALTER TABLE article_tags ADD CONSTRAINT article_tags_axis_slug_uq UNIQUE (axis, slug);
  END IF;
END $$;