-- Create subscriptions table for tracking user subscriptions to threads/entities
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR NOT NULL, -- 'book', 'news', 'comment_thread', 'review_thread', etc.
  entity_id VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_read_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, entity_type, entity_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_entity ON subscriptions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);