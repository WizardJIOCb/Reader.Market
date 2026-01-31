-- Add Discussion Forum System Tables
-- Migration to implement the proposed forum structure with hierarchical categories

-- Create discussion categories table (hierarchical)
CREATE TABLE IF NOT EXISTS discussion_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES discussion_categories(id),
    title TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create discussions table (threads/topics)
CREATE TABLE IF NOT EXISTS discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES discussion_categories(id),
    author_user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content_json JSONB, -- TipTap JSON structure
    content_html TEXT, -- Optional rendered HTML
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'pinned', 'archived'
    pinned BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMP WITH TIME ZONE,
    last_reply_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create discussion replies table (posts/comments within a discussion)
CREATE TABLE IF NOT EXISTS discussion_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    parent_reply_id UUID REFERENCES discussion_replies(id), -- For nested replies
    author_user_id UUID NOT NULL REFERENCES users(id),
    content_json JSONB, -- TipTap JSON structure
    content_html TEXT, -- Optional rendered HTML
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'deleted', 'edited'
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create discussion views tracking
CREATE TABLE IF NOT EXISTS discussion_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    ip_hash TEXT,
    user_agent_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create discussion subscriptions (for notifications)
CREATE TABLE IF NOT EXISTS discussion_subscriptions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, discussion_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discussions_category_id ON discussions(category_id);
CREATE INDEX IF NOT EXISTS idx_discussions_author_id ON discussions(author_user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_status ON discussions(status);
CREATE INDEX IF NOT EXISTS idx_discussions_pinned ON discussions(pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_last_reply ON discussions(last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_parent_id ON discussion_replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_author_id ON discussion_replies(author_user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_categories_parent_id ON discussion_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussion_categories_sort_order ON discussion_categories(sort_order);

-- Insert initial discussion categories as per the proposed structure (Level 1 - Root categories)
INSERT INTO discussion_categories (title, slug, description, sort_order) VALUES
('Book Discussions', 'book-discussions', 'Discussions about specific books', 1),
('Genres', 'genres', 'Genre-specific discussions', 2),
('Reading Habits & Practices', 'reading-habits', 'Discuss reading habits and practices', 3),
('Translations & Editions', 'translations-editions', 'Talk about translations and editions', 4),
('Authors & Creativity', 'authors-creativity', 'Discussions about authors and their work', 5),
('Adaptations & Media', 'adaptations-media', 'Books adapted to other media', 6),
('Community', 'community', 'Community-related discussions', 7),
('Help & Suggestions', 'help-suggestions', 'Get help and make suggestions', 8),
('Off-topic', 'off-topic', 'General discussions not related to other topics', 9)
ON CONFLICT (slug) DO NOTHING;

-- Insert Level 2 subcategories
INSERT INTO discussion_categories (title, slug, description, sort_order, parent_id) VALUES
-- Book Discussions subcategories
('Specific Books', 'specific-books', 'Discussions about individual books', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'book-discussions')),
('Series & Cycles', 'series-cycles', 'Discussions about book series and cycles', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'book-discussions')),

-- Genres subcategories
('Fantasy', 'fantasy', 'Fantasy literature discussions', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'genres')),
('Science Fiction', 'science-fiction', 'Science fiction literature discussions', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'genres')),
('Mystery & Thriller', 'mystery-thriller', 'Mystery and thriller literature discussions', 3, 
 (SELECT id FROM discussion_categories WHERE slug = 'genres')),
('Non-fiction', 'non-fiction', 'Non-fiction literature discussions', 4, 
 (SELECT id FROM discussion_categories WHERE slug = 'genres')),
('Classics', 'classics', 'Classic literature discussions', 5, 
 (SELECT id FROM discussion_categories WHERE slug = 'genres')),

-- Reading Habits subcategories
('Book Recommendations', 'book-recommendations', 'Get and give book recommendations', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'reading-habits')),
('Reading Speed & Goals', 'reading-speed-goals', 'Discuss reading speed and goals', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'reading-habits')),
('Notes & Highlights', 'notes-highlights', 'Share tips about taking notes and highlights', 3, 
 (SELECT id FROM discussion_categories WHERE slug = 'reading-habits')),

-- Translations & Editions subcategories
('New Translations', 'new-translations', 'Discussions about new book translations', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'translations-editions')),
('Translation Quality', 'translation-quality', 'Compare translation quality', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'translations-editions')),
('Editions & Publishing', 'editions-publishing', 'Discuss different book editions and publishing', 3, 
 (SELECT id FROM discussion_categories WHERE slug = 'translations-editions')),

-- Authors & Creativity subcategories
('Author Discussions', 'author-discussions', 'General discussions about authors', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'authors-creativity')),
('Writing & Feedback', 'writing-feedback', 'For users who write and want feedback', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'authors-creativity')),

-- Adaptations & Media subcategories
('Film & TV Adaptations', 'film-tv-adaptations', 'Books adapted to film and television', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'adaptations-media')),
('Book vs Screen', 'book-vs-screen', 'Compare books to their screen adaptations', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'adaptations-media')),

-- Community subcategories
('Book Clubs', 'book-clubs', 'Organize and discuss book clubs', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'community')),
('Reading Challenges', 'reading-challenges', 'Participate in reading challenges', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'community')),
('User Collections', 'user-collections', 'Share and discuss user-generated collections', 3, 
 (SELECT id FROM discussion_categories WHERE slug = 'community')),

-- Help & Suggestions subcategories
('Site Questions', 'site-questions', 'Ask questions about using the site', 1, 
 (SELECT id FROM discussion_categories WHERE slug = 'help-suggestions')),
('Bugs & Features', 'bugs-features', 'Report bugs and suggest features', 2, 
 (SELECT id FROM discussion_categories WHERE slug = 'help-suggestions'));

-- Add triggers to update discussion reply counts and last reply info
CREATE OR REPLACE FUNCTION update_discussion_stats_after_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Update reply count and last reply info
  UPDATE discussions SET 
    reply_count = (
      SELECT COUNT(*) 
      FROM discussion_replies 
      WHERE discussion_id = NEW.discussion_id 
      AND status = 'active'
    ),
    last_reply_at = NEW.created_at,
    last_reply_by_user_id = NEW.author_user_id
  WHERE id = NEW.discussion_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new replies
CREATE TRIGGER trigger_update_discussion_stats_after_reply
  AFTER INSERT ON discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_discussion_stats_after_reply();

-- Add trigger for reply deletions
CREATE OR REPLACE FUNCTION update_discussion_stats_after_reply_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update reply count and possibly last reply info
  UPDATE discussions SET 
    reply_count = (
      SELECT COUNT(*) 
      FROM discussion_replies 
      WHERE discussion_id = OLD.discussion_id 
      AND status = 'active'
    ),
    last_reply_at = (
      SELECT MAX(created_at)
      FROM discussion_replies
      WHERE discussion_id = OLD.discussion_id
      AND status = 'active'
    ),
    last_reply_by_user_id = (
      SELECT author_user_id
      FROM discussion_replies
      WHERE discussion_id = OLD.discussion_id
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    )
  WHERE id = OLD.discussion_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reply updates (for soft deletes)
CREATE TRIGGER trigger_update_discussion_stats_after_reply_update
  AFTER UPDATE ON discussion_replies
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status != 'active') OR (OLD.status != 'active' AND NEW.status = 'active')
  EXECUTE FUNCTION update_discussion_stats_after_reply_delete();