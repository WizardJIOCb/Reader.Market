-- Add Articles System Tables
-- Migration for articles, categories, tags, and related functionality

-- Create article categories table
CREATE TABLE IF NOT EXISTS article_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES article_categories(id),
    title TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create article tags table
CREATE TABLE IF NOT EXISTS article_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content_json JSONB,
    content_html TEXT,
    category_id UUID REFERENCES article_categories(id),
    reply_to_article_id UUID REFERENCES articles(id),
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'hidden', 'deleted'
    published_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create junction table for article-tag relationships
CREATE TABLE IF NOT EXISTS article_tag_map (
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES article_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

-- Create junction table for article-book relationships
CREATE TABLE IF NOT EXISTS article_books (
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, book_id)
);

-- Create article views tracking table
CREATE TABLE IF NOT EXISTS article_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    ip_hash TEXT,
    user_agent_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create read later tracking table
CREATE TABLE IF NOT EXISTS article_read_later (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, article_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS articles_author_idx ON articles(author_user_id);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category_id);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at);
CREATE INDEX IF NOT EXISTS articles_reply_to_idx ON articles(reply_to_article_id);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_created_at_idx ON articles(created_at);

CREATE INDEX IF NOT EXISTS article_views_article_id_idx ON article_views(article_id);
CREATE INDEX IF NOT EXISTS article_views_user_id_idx ON article_views(user_id);
CREATE INDEX IF NOT EXISTS article_views_composite_idx ON article_views(article_id, user_id, ip_hash, user_agent_hash);

CREATE INDEX IF NOT EXISTS article_read_later_user_id_idx ON article_read_later(user_id);
CREATE INDEX IF NOT EXISTS article_read_later_article_id_idx ON article_read_later(article_id);

-- Create unique constraint for view deduplication
CREATE UNIQUE INDEX IF NOT EXISTS article_views_unique_idx ON article_views(article_id, user_id, ip_hash, user_agent_hash);

-- Insert default categories
INSERT INTO article_categories (title, slug, sort_order) VALUES
    ('Literature', 'literature', 1),
    ('Reviews', 'reviews', 2),
    ('Essays', 'essays', 3),
    ('Interviews', 'interviews', 4),
    ('News', 'news', 5)
ON CONFLICT (slug) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for articles
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for article_categories
DROP TRIGGER IF EXISTS update_article_categories_updated_at ON article_categories;
CREATE TRIGGER update_article_categories_updated_at 
    BEFORE UPDATE ON article_categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();