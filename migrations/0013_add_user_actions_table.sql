-- Add user_actions table for tracking user navigation and interaction activities

CREATE TABLE IF NOT EXISTS user_actions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id VARCHAR,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX idx_user_actions_action_type ON user_actions(action_type);
CREATE INDEX idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX idx_user_actions_deleted_at_created_at ON user_actions(deleted_at, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_actions_target ON user_actions(target_type, target_id) WHERE target_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE user_actions IS 'Stores user navigation and interaction activities for the Last Actions feed';
COMMENT ON COLUMN user_actions.action_type IS 'Type of action: navigate_home, navigate_stream, navigate_search, navigate_shelves, navigate_about, navigate_messages, navigate_profile, navigate_news, navigate_book, navigate_reader, send_group_message';
COMMENT ON COLUMN user_actions.target_type IS 'Type of target entity: user, book, news, group';
COMMENT ON COLUMN user_actions.target_id IS 'ID of the target entity (user_id, book_id, news_id, group_id)';
COMMENT ON COLUMN user_actions.metadata IS 'Additional context data: username, book_title, news_title, profile_username, group_name, message_preview';
