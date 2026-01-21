-- Add parent_review_id and quoted_text columns to reviews table for threaded replies
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS parent_review_id VARCHAR;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS quoted_text TEXT;

-- Add foreign key constraint for self-reference
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_parent_review_id 
  FOREIGN KEY (parent_review_id) REFERENCES reviews(id) ON DELETE CASCADE;

-- Create index for faster lookup of replies
CREATE INDEX IF NOT EXISTS idx_reviews_parent_review_id ON reviews(parent_review_id);
