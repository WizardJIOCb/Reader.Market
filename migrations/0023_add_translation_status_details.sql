-- Add statusDetails column to book_translations table for detailed progress tracking
ALTER TABLE book_translations ADD COLUMN IF NOT EXISTS status_details JSONB;

-- Update status column to support 'cancelled' status
-- No ALTER needed as it's a varchar that can hold any value
