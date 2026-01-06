-- First, clean up any potential duplicates by consolidating them
-- This merges duplicate records by summing view counts and keeping the latest timestamp
WITH duplicates AS (
  SELECT book_id, view_type, COUNT(*) as dup_count
  FROM book_view_statistics
  GROUP BY book_id, view_type
  HAVING COUNT(*) > 1
),
consolidated AS (
  SELECT 
    bvs.book_id,
    bvs.view_type,
    SUM(bvs.view_count) as total_view_count,
    MAX(bvs.last_viewed_at) as latest_viewed_at,
    MIN(bvs.created_at) as earliest_created_at,
    MAX(bvs.updated_at) as latest_updated_at,
    MIN(bvs.id) as keep_id
  FROM book_view_statistics bvs
  INNER JOIN duplicates d ON bvs.book_id = d.book_id AND bvs.view_type = d.view_type
  GROUP BY bvs.book_id, bvs.view_type
)
-- Update the record we're keeping with consolidated data
UPDATE book_view_statistics bvs
SET 
  view_count = c.total_view_count,
  last_viewed_at = c.latest_viewed_at,
  updated_at = c.latest_updated_at
FROM consolidated c
WHERE bvs.id = c.keep_id;

-- Delete duplicate records (keeping only the one we just updated)
DELETE FROM book_view_statistics bvs
USING (
  SELECT book_id, view_type, MIN(id) as keep_id
  FROM book_view_statistics
  GROUP BY book_id, view_type
) keeper
WHERE bvs.book_id = keeper.book_id 
  AND bvs.view_type = keeper.view_type 
  AND bvs.id != keeper.keep_id;

-- Add the unique constraint
ALTER TABLE "book_view_statistics" 
ADD CONSTRAINT "book_view_statistics_book_id_view_type_unique" 
UNIQUE ("book_id", "view_type");
