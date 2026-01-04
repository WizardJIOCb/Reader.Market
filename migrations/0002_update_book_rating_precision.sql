-- This is a placeholder migration for update_book_rating_precision
-- The actual changes may have been included in other migrations already

-- If needed, this migration would update the rating precision in books table
-- ALTER TABLE "books" ALTER COLUMN "rating" TYPE numeric(3, 1) USING ROUND("rating"::numeric, 1);