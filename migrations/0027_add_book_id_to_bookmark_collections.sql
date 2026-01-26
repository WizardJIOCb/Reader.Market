-- Migration: Add book_id to bookmark collections
-- Adds book association to bookmark collections for book-specific collections

-- Add book_id column to bookmark_collections table
ALTER TABLE bookmark_collections 
ADD COLUMN book_id VARCHAR REFERENCES books(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_bookmark_collections_book_id ON bookmark_collections(book_id);

-- Update comments
COMMENT ON COLUMN bookmark_collections.book_id IS 'Optional book association - when set, this collection is specific to this book';

-- Add default collection name for automatic assignment
INSERT INTO bookmark_collections (user_id, name, description, color, is_public, book_id)
SELECT DISTINCT 
    b.user_id,
    'Закладки для ' || bk.title,  -- "Bookmarks for [Book Title]"
    'Автоматическая коллекция для книги ' || bk.title,  -- "Automatic collection for book [Book Title]"
    '#3b82f6',
    false,
    b.book_id
FROM bookmarks b
JOIN books bk ON b.book_id = bk.id
WHERE NOT EXISTS (
    SELECT 1 FROM bookmark_collections bc 
    WHERE bc.user_id = b.user_id 
    AND bc.book_id = b.book_id 
    AND bc.name LIKE 'Закладки для ' || bk.title
);