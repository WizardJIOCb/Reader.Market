-- Add article_id column to comments table
ALTER TABLE comments ADD COLUMN article_id VARCHAR(255) REFERENCES articles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS comments_article_id_idx ON comments(article_id);

-- Add article_id column to reactions table  
ALTER TABLE reactions ADD COLUMN article_id VARCHAR(255) REFERENCES articles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS reactions_article_id_idx ON reactions(article_id);

-- Update the constraint check to ensure only one of the IDs is set (excluding the new article_id for now)
-- In a more complete migration, we would update the constraint to include article_id as well