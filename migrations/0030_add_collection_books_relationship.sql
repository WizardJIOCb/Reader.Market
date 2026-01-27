-- Add collection-books relationship table and remove single bookId constraint
-- This allows collections to have multiple books associated with them

-- Create the junction table for collection-book relationships
CREATE TABLE IF NOT EXISTS collection_books (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id VARCHAR NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
  book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(collection_id, book_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_books_collection_id ON collection_books(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_books_book_id ON collection_books(book_id);

-- Remove the old single bookId column from bookmark_collections
-- Note: We'll keep it for now to avoid breaking existing data, but mark it as deprecated
-- ALTER TABLE bookmark_collections DROP COLUMN IF EXISTS book_id;

-- Add comment to indicate the column is deprecated
COMMENT ON COLUMN bookmark_collections.book_id IS 'Deprecated: Use collection_books table instead';

-- Migrate existing data from bookmark_collections.book_id to collection_books
INSERT INTO collection_books (collection_id, book_id, added_at)
SELECT id, book_id, created_at
FROM bookmark_collections
WHERE book_id IS NOT NULL
ON CONFLICT (collection_id, book_id) DO NOTHING;

-- Update the API to use the new relationship table