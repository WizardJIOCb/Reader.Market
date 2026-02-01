-- Update article category hierarchy to establish parent-child relationships
-- This migration script ensures that subcategories are properly linked to their parent categories

DO $$
DECLARE
    news_parent_id UUID;
    books_parent_id UUID;
    reviews_parent_id UUID;
    collections_parent_id UUID;
    translations_parent_id UUID;
    industry_parent_id UUID;
    clubs_parent_id UUID;
    community_parent_id UUID;
BEGIN
    -- Get parent category IDs
    SELECT id INTO news_parent_id FROM article_categories WHERE slug = 'news';
    SELECT id INTO books_parent_id FROM article_categories WHERE slug = 'books';
    SELECT id INTO reviews_parent_id FROM article_categories WHERE slug = 'reviews';
    SELECT id INTO collections_parent_id FROM article_categories WHERE slug = 'collections';
    SELECT id INTO translations_parent_id FROM article_categories WHERE slug = 'translations';
    SELECT id INTO industry_parent_id FROM article_categories WHERE slug = 'industry';
    SELECT id INTO clubs_parent_id FROM article_categories WHERE slug = 'clubs';
    SELECT id INTO community_parent_id FROM article_categories WHERE slug = 'community';

    -- Update news subcategories
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug = 'news.new-books';
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug = 'news.new-translations';
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug = 'news.reprints';
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug = 'news.adaptations';
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug = 'news.awards-events';

    -- Update books subcategories
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug = 'books.no-spoilers';
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug = 'books.spoilers';
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug = 'books.by-chapters';
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug = 'books.theories';
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug = 'books.quotes';

    -- Update reviews subcategories
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug = 'reviews.reviews';
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug = 'reviews.essays';
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug = 'reviews.characters-world';
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug = 'reviews.plot-structure';
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug = 'reviews.themes';

    -- Update collections subcategories
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug = 'collections.what-next';
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug = 'collections.tops';
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug = 'collections.by-genre';
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug = 'collections.by-mood';
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug = 'collections.for-beginners';

    -- Update translations subcategories
    UPDATE article_categories SET parent_id = translations_parent_id WHERE slug = 'translations.compare';
    UPDATE article_categories SET parent_id = translations_parent_id WHERE slug = 'translations.quality';
    UPDATE article_categories SET parent_id = translations_parent_id WHERE slug = 'translations.glossary';
    UPDATE article_categories SET parent_id = translations_parent_id WHERE slug = 'translations.excerpts';

    -- Update industry subcategories
    UPDATE article_categories SET parent_id = industry_parent_id WHERE slug = 'industry.authors-news';
    UPDATE article_categories SET parent_id = industry_parent_id WHERE slug = 'industry.interviews';
    UPDATE article_categories SET parent_id = industry_parent_id WHERE slug = 'industry.publishers';
    UPDATE article_categories SET parent_id = industry_parent_id WHERE slug = 'industry.trends';

    -- Update clubs subcategories
    UPDATE article_categories SET parent_id = clubs_parent_id WHERE slug = 'clubs.readalongs';
    UPDATE article_categories SET parent_id = clubs_parent_id WHERE slug = 'clubs.challenges';
    UPDATE article_categories SET parent_id = clubs_parent_id WHERE slug = 'clubs.goals';
    UPDATE article_categories SET parent_id = clubs_parent_id WHERE slug = 'clubs.progress';

    -- Update community subcategories
    UPDATE article_categories SET parent_id = community_parent_id WHERE slug = 'community.product-updates';
    UPDATE article_categories SET parent_id = community_parent_id WHERE slug = 'community.qna';
    UPDATE article_categories SET parent_id = community_parent_id WHERE slug = 'community.ideas';

    RAISE NOTICE 'Article category hierarchy updated successfully';
END $$;