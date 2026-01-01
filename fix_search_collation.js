/*
 * Script to fix Cyrillic search issue in production
 * This addresses the core issue where PostgreSQL collation settings differ between environments
 */

// This is a guide for the manual fix that needs to be applied to the production database
console.log(`
POSTGRESQL COLLATION FIX FOR CYRILLIC SEARCH:

The issue is that your production PostgreSQL database likely has different collation settings than your local database.
Cyrillic text search is failing because of collation differences.

SOLUTION:

1. Connect to your production PostgreSQL database as a superuser:
   psql -h localhost -U postgres

2. Connect to your specific database:
   \\c booksdb

3. Check current collation settings:
   SHOW LC_COLLATE;
   SHOW LC_CTYPE;

4. If the collation is not supporting Cyrillic properly (e.g., not ru_RU.UTF-8 or C.UTF-8), 
   you may need to recreate the database with proper collation, or create a custom collation:

   -- Option A: Create a custom collation (if supported)
   CREATE COLLATION IF NOT EXISTS cyrillic_collation (provider = icu, locale = 'ru-RU');

   -- Option B: Create functional indexes to support case-insensitive Cyrillic search
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_title_lower ON books (LOWER(title));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_author_lower ON books (LOWER(author));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_description_lower ON books (LOWER(description));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_genre_lower ON books (LOWER(genre));

5. If the unaccent extension isn't available, create it:
   CREATE EXTENSION IF NOT EXISTS unaccent;

6. Test the search after applying the indexes:
   SELECT * FROM books 
   WHERE LOWER(title) ILIKE LOWER('%Гиперион%') 
      OR LOWER(author) ILIKE LOWER('%Гиперион%') 
      OR LOWER(description) ILIKE LOWER('%Гиперион%') 
      OR LOWER(genre) ILIKE LOWER('%Гиперион%');

After applying these database changes, restart your application server to ensure the connection pool refreshes.
`);

console.log("Please execute these SQL commands on your production database to fix the Cyrillic search issue.");/*
 * Script to fix Cyrillic search issue in production
 * This addresses the core issue where PostgreSQL collation settings differ between environments
 */

// This is a guide for the manual fix that needs to be applied to the production database
console.log(`
POSTGRESQL COLLATION FIX FOR CYRILLIC SEARCH:

The issue is that your production PostgreSQL database likely has different collation settings than your local database.
Cyrillic text search is failing because of collation differences.

SOLUTION:

1. Connect to your production PostgreSQL database as a superuser:
   psql -h localhost -U postgres

2. Connect to your specific database:
   \\c booksdb

3. Check current collation settings:
   SHOW LC_COLLATE;
   SHOW LC_CTYPE;

4. If the collation is not supporting Cyrillic properly (e.g., not ru_RU.UTF-8 or C.UTF-8), 
   you may need to recreate the database with proper collation, or create a custom collation:

   -- Option A: Create a custom collation (if supported)
   CREATE COLLATION IF NOT EXISTS cyrillic_collation (provider = icu, locale = 'ru-RU');

   -- Option B: Create functional indexes to support case-insensitive Cyrillic search
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_title_lower ON books (LOWER(title));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_author_lower ON books (LOWER(author));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_description_lower ON books (LOWER(description));
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_genre_lower ON books (LOWER(genre));

5. If the unaccent extension isn't available, create it:
   CREATE EXTENSION IF NOT EXISTS unaccent;

6. Test the search after applying the indexes:
   SELECT * FROM books 
   WHERE LOWER(title) ILIKE LOWER('%Гиперион%') 
      OR LOWER(author) ILIKE LOWER('%Гиперион%') 
      OR LOWER(description) ILIKE LOWER('%Гиперион%') 
      OR LOWER(genre) ILIKE LOWER('%Гиперион%');

After applying these database changes, restart your application server to ensure the connection pool refreshes.
`);

console.log("Please execute these SQL commands on your production database to fix the Cyrillic search issue.");