-- Add publication type field to articles table
-- Migration to implement the proposed article structure with types, categories and tags

-- Add publication_type column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publication_type TEXT;

-- Create index on publication_type for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_publication_type ON articles(publication_type);

-- Update the articles table to have proper constraints for the publication_type
-- This will be filled with values based on the type of article

-- Insert initial article categories as per the proposed structure
INSERT INTO article_categories (title, slug, sort_order) VALUES
('News and Releases', 'news-releases', 1),
('Reviews and Opinions', 'reviews-opinions', 2),
('Collections and Ratings', 'collections-ratings', 3),
('Guides and Reading', 'guides-reading', 4),
('Literary World', 'literary-world', 5),
('Community', 'community', 6),
('About Reader.Market', 'about-reader-market', 7)
ON CONFLICT (slug) DO NOTHING;

-- Insert some common publication types for News and Releases
INSERT INTO article_tags (name, slug) VALUES
-- News and Releases types
('Announcement', 'announcement'),
('Book Release', 'book-release'),
('Translation Release', 'translation-release'),
('Reissue', 'reissue'),
('Pre-order', 'pre-order'),
('Upcoming Adaptation', 'upcoming-adaptation'),
('Trailer Premiere', 'trailer-premiere'),
('Award Winner', 'award-winner'),
('Award Shortlist', 'award-shortlist'),
-- Review types
('Review', 'review'),
('Brief Opinion', 'brief-opinion'),
('Analysis', 'analysis'),
('Spoiler Analysis', 'spoiler-analysis'),
('No Spoilers', 'no-spoilers'),
('Translation Comparison', 'translation-comparison'),
('Book Comparison', 'book-comparison'),
('Similar To', 'similar-to'),
-- Collection types
('Top Rating', 'top-rating'),
('Themed Collection', 'themed-collection'),
('Mood Collection', 'mood-collection'),
('Beginner Collection', 'beginner-collection'),
('Reading Order', 'reading-order'),
-- Guide types
('How To Choose', 'how-to-choose'),
('Genre Guide', 'genre-guide'),
('Terminology', 'terminology'),
('Reading Practices', 'reading-practices'),
-- Literary World types
('Author Interview', 'author-interview'),
('Book History', 'book-history'),
('Publishing Market', 'publishing-market'),
('Events', 'events'),
-- Community types
('Challenge', 'challenge'),
('Club Discussion', 'club-discussion'),
('User Post', 'user-post')
ON CONFLICT (slug) DO NOTHING;

-- Add fields for article-book relationship roles as described in the proposal
-- Since we don't have a role field yet in article_books, let's add it
ALTER TABLE article_books ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'mentioned'; -- 'main', 'mentioned', 'in_collection', 'comparison', 'adaptation'
ALTER TABLE article_books ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for better performance when querying article-books relationships
CREATE INDEX IF NOT EXISTS idx_article_books_role ON article_books(role);
CREATE INDEX IF NOT EXISTS idx_article_books_sort_order ON article_books(sort_order);

-- Add a computed field to count attached books for each article
-- This will help with filtering articles by book relationships