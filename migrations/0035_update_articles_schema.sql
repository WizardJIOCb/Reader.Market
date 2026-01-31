-- Update Articles Schema according to senior's recommendations
-- This migration adds enums and updates the schema to match the proposed structure

-- Create enums for article sections, formats, and statuses
CREATE TYPE article_section_enum AS ENUM (
  'news',     -- announcements/releases/industry news
  'reviews',  -- reviews/opinions
  'collections',       -- lists/top/picks
  'guides',            -- how-to/reading guides
  'world',         -- awards/events/adaptations/publishing
  'community',         -- challenges/club posts/user posts
  'product'            -- Reader.Market updates/help
);

CREATE TYPE article_format_enum AS ENUM (
  'announcement',
  'release',
  'translation',
  'review',
  'list',
  'analysis',
  'event',
  'note'
);

CREATE TYPE article_status_enum AS ENUM (
  'draft',
  'published',
  'archived'
);

-- Create enum for article book roles
CREATE TYPE article_book_role_enum AS ENUM (
  'primary',     -- статья "про" книгу
  'mentioned',   -- упоминается
  'in_list',     -- элемент подборки
  'comparison'   -- участвует в сравнении
);

-- Create enum for article tag axes
CREATE TYPE article_tag_axis_enum AS ENUM (
  'genre',
  'theme',
  'mood',
  'country',
  'era',
  'format',
  'audience',
  'award',
  'language',
  'other'
);

-- Create enum for discussion kinds
CREATE TYPE discussion_kind_enum AS ENUM (
  'general',   -- обычный тред в категории
  'book',      -- "главное обсуждение книги"
  'article'    -- обсуждение статьи (опционально)
);

-- Drop existing publication_type column if it exists
ALTER TABLE articles DROP COLUMN IF EXISTS publication_type;

-- Add new columns to articles table according to the schema
ALTER TABLE articles ADD COLUMN IF NOT EXISTS section article_section_enum; -- New section enum
ALTER TABLE articles ADD COLUMN IF NOT EXISTS format article_format_enum; -- New format enum
-- Temporarily keep old category and type columns for backward compatibility
ALTER TABLE articles ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'ru';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Update new columns based on old columns if they exist
UPDATE articles SET section = category::text::article_section_enum WHERE category IS NOT NULL AND category::text IN (SELECT unnest(enumlabel::text[]) FROM pg_enum WHERE enumtypid = 'article_section_enum'::regtype);
UPDATE articles SET format = type::text::article_format_enum WHERE type IS NOT NULL AND type::text IN (SELECT unnest(enumlabel::text[]) FROM pg_enum WHERE enumtypid = 'article_format_enum'::regtype);

-- Update existing articles to use the new category slugs based on existing category IDs
UPDATE articles SET category_slug = ac.slug 
FROM article_categories ac 
WHERE articles.category_id = ac.id;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section);
CREATE INDEX IF NOT EXISTS idx_articles_format ON articles(format);
CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles(lang);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);

-- Update the article_books table to match the new schema
ALTER TABLE article_books ADD COLUMN IF NOT EXISTS note TEXT;

-- Create article_tags table
CREATE TABLE IF NOT EXISTS article_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    axis article_tag_axis_enum NOT NULL DEFAULT 'other',
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create unique index for article_tags
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_tags_axis_slug ON article_tags(axis, slug);
CREATE INDEX IF NOT EXISTS idx_article_tags_axis ON article_tags(axis);

-- Create article_tag_links table
CREATE TABLE IF NOT EXISTS article_tag_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES article_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for article_tag_links
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_tag_links_uq ON article_tag_links(article_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_article_tag_links_article ON article_tag_links(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tag_links_tag ON article_tag_links(tag_id);

-- Create discussion_categories table
CREATE TABLE IF NOT EXISTS discussion_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES discussion_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for discussion_categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_discussion_categories_parent_slug ON discussion_categories(parent_id, slug);
CREATE INDEX IF NOT EXISTS idx_discussion_categories_parent ON discussion_categories(parent_id);

-- Create discussions table
CREATE TABLE IF NOT EXISTS discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES discussion_categories(id) ON DELETE SET NULL,
    kind discussion_kind_enum NOT NULL DEFAULT 'general',
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT, -- can be optional if url by id
    created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    posts_count INTEGER NOT NULL DEFAULT 0,
    last_post_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for discussions
CREATE UNIQUE INDEX IF NOT EXISTS idx_discussions_book_kind ON discussions(book_id, kind) WHERE book_id IS NOT NULL AND kind = 'book';
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category_id);
CREATE INDEX IF NOT EXISTS idx_discussions_last_post_at ON discussions(last_post_at);

-- Create discussion_posts table
CREATE TABLE IF NOT EXISTS discussion_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_md TEXT,
    content_json JSONB,
    reply_to_post_id UUID REFERENCES discussion_posts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for discussion_posts
CREATE INDEX IF NOT EXISTS idx_discussion_posts_discussion ON discussion_posts(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_author ON discussion_posts(author_id);

-- Insert seed data for discussion categories
INSERT INTO discussion_categories (title, slug, sort_order) VALUES
('Book Discussions', 'book-discussions', 1),
('Genres', 'genres', 2),
('Reading Habits & Practices', 'reading-habits', 3),
('Translations & Editions', 'translations-editions', 4),
('Adaptations & Media', 'adaptations-media', 5),
('Community', 'community', 6),
('Help & Suggestions', 'help-suggestions', 7),
('Off-topic', 'off-topic', 8)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for genres
INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Fantasy', 'fantasy', 1, id FROM discussion_categories WHERE slug = 'genres'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Sci-fi', 'sci-fi', 2, id FROM discussion_categories WHERE slug = 'genres'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Detective', 'detective', 3, id FROM discussion_categories WHERE slug = 'genres'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Non-fiction', 'non-fiction', 4, id FROM discussion_categories WHERE slug = 'genres'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Classics', 'classics', 5, id FROM discussion_categories WHERE slug = 'genres'
ON CONFLICT (parent_id, slug) DO NOTHING;

-- Insert subcategories for translations
INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'New Translations', 'new-translations', 1, id FROM discussion_categories WHERE slug = 'translations-editions'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Which Translation is Better', 'which-translation-better', 2, id FROM discussion_categories WHERE slug = 'translations-editions'
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO discussion_categories (title, slug, sort_order, parent_id) 
SELECT 'Editions/Covers', 'editions-covers', 3, id FROM discussion_categories WHERE slug = 'translations-editions'
ON CONFLICT (parent_id, slug) DO NOTHING;