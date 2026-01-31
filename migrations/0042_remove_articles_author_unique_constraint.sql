-- Migration to remove unique constraint on author_user_id in articles table
-- This constraint was preventing users from creating multiple articles

-- Drop the unique index on author_user_id
DROP INDEX IF EXISTS articles_author_idx;

-- Verify the change
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'articles' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name;