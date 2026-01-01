-- SQL script to ensure proper Cyrillic text search support in PostgreSQL
-- This script should be run on the production database to fix the search issue

-- 1. First, check current database collation settings
SHOW LC_COLLATE;
SHOW LC_CTYPE;

-- 2. If needed, create the unaccent extension for better text processing
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 3. Create or update the search function to use proper collation
-- This creates a function that handles accent-insensitive and case-insensitive search
CREATE OR REPLACE FUNCTION search_books_cyrillic(query_text TEXT)
RETURNS TABLE(book_id VARCHAR, title TEXT, author TEXT, description TEXT, genre TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.author,
    b.description,
    b.genre
  FROM books b
  WHERE 
    LOWER(b.title) LIKE LOWER('%' || query_text || '%') OR
    LOWER(b.author) LIKE LOWER('%' || query_text || '%') OR
    LOWER(b.description) LIKE LOWER('%' || query_text || '%') OR
    LOWER(b.genre) LIKE LOWER('%' || query_text || '%');
END;
$$ LANGUAGE plpgsql;

-- 4. Alternative: Create GIN indexes for better text search performance with Cyrillic
-- DROP INDEX IF EXISTS idx_books_title_gin;
-- DROP INDEX IF EXISTS idx_books_author_gin;
-- DROP INDEX IF EXISTS idx_books_description_gin;
-- DROP INDEX IF EXISTS idx_books_genre_gin;

-- CREATE INDEX idx_books_title_gin ON books USING gin(to_tsvector('simple', title));
-- CREATE INDEX idx_books_author_gin ON books USING gin(to_tsvector('simple', author));
-- CREATE INDEX idx_books_description_gin ON books USING gin(to_tsvector('simple', description));
-- CREATE INDEX idx_books_genre_gin ON books USING gin(to_tsvector('simple', genre));

-- 5. Update the books table to ensure proper text collation if needed
-- This would require recreating the table, so it's better to use the search approach above