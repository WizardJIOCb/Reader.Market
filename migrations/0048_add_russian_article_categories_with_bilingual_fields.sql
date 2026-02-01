-- 0048_add_russian_article_categories_with_bilingual_fields.sql
-- Add the complete Russian article category structure with proper hierarchy and bilingual support

-- Insert main categories if they don't exist
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Новости и анонсы', 'News and Announcements', 'Новости о литературе, анонсы новых книг, переводов и событий', 'News about literature, announcements of new books, translations, and events', 'news', 1),
('Обсуждение книг', 'Book Discussions', 'Обсуждение книг, без спойлеров и со спойлерами', 'Book discussions, no spoilers and with spoilers', 'books', 2),
('Рецензии и разборы', 'Reviews and Analysis', 'Рецензии на книги и их подробный разбор', 'Book reviews and detailed analysis', 'reviews', 3),
('Подборки и рекомендации', 'Collections and Recommendations', 'Подборки книг и рекомендации для чтения', 'Book collections and reading recommendations', 'collections', 4),
('Переводы и издания', 'Translations and Editions', 'Обсуждение переводов и различных изданий', 'Discussion of translations and various editions', 'translations', 5),
('Авторы и индустрия', 'Authors and Industry', 'Новости об авторах и книжной индустрии', 'News about authors and the publishing industry', 'industry', 6),
('Клубы и челленджи', 'Clubs and Challenges', 'Литературные клубы и чтения, челленджи', 'Book clubs and readings, challenges', 'clubs', 7),
('Сообщество и сервис', 'Community and Service', 'Обновления сервиса и общение в сообществе', 'Service updates and community interaction', 'community', 8)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories if they don't exist
-- News subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Новые книги', 'New Books', 'Анонсы новых книг', 'Announcements of new books', 'news.new-books', 101),
('Новые переводы', 'New Translations', 'Анонсы новых переводов', 'Announcements of new translations', 'news.new-translations', 102),
('Переиздания / новые обложки', 'Reissues / New Covers', 'Переиздания книг и новые обложки', 'Book reissues and new covers', 'news.reprints', 103),
('Экранизации и адаптации', 'Adaptations', 'Экранизации и другие адаптации', 'Screen adaptations and other adaptations', 'news.adaptations', 104),
('Премии и события', 'Awards and Events', 'Литературные премии и события', 'Literary awards and events', 'news.awards-events', 105)
ON CONFLICT (slug) DO NOTHING;

-- Books subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Без спойлеров', 'No Spoilers', 'Обсуждение книг без спойлеров', 'Book discussions without spoilers', 'books.no-spoilers', 201),
('Со спойлерами', 'With Spoilers', 'Обсуждение книг со спойлерами', 'Book discussions with spoilers', 'books.spoilers', 202),
('По главам / по сценам', 'By Chapters / Scenes', 'Разбор по главам или сценам', 'Analysis by chapters or scenes', 'books.by-chapters', 203),
('Теории и трактовки', 'Theories and Interpretations', 'Теории и различные трактовки', 'Theories and various interpretations', 'books.theories', 204),
('Цитаты и находки', 'Quotes and Finds', 'Интересные цитаты и находки', 'Interesting quotes and discoveries', 'books.quotes', 205)
ON CONFLICT (slug) DO NOTHING;

-- Reviews subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Рецензии', 'Reviews', 'Рецензии на книги', 'Book reviews', 'reviews.reviews', 301),
('Эссе / аналитика', 'Essays / Analysis', 'Эссе и аналитические материалы', 'Essays and analytical materials', 'reviews.essays', 302),
('Персонажи и мир', 'Characters and World', 'Разбор персонажей и мира произведения', 'Analysis of characters and world of the work', 'reviews.characters-world', 303),
('Сюжет и структура', 'Plot and Structure', 'Разбор сюжета и структуры', 'Analysis of plot and structure', 'reviews.plot-structure', 304),
('Темы и смыслы', 'Themes and Meanings', 'Обсуждение тем и смыслов', 'Discussion of themes and meanings', 'reviews.themes', 305)
ON CONFLICT (slug) DO NOTHING;

-- Collections subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Что читать дальше', 'What to Read Next', 'Рекомендации что читать дальше', 'Recommendations on what to read next', 'collections.what-next', 401),
('Топы и списки', 'Tops and Lists', 'Топы и различные списки книг', 'Tops and various book lists', 'collections.tops', 402),
('По жанрам', 'By Genres', 'Подборки по жанрам', 'Collections by genres', 'collections.by-genre', 403),
('По настроению / темам', 'By Mood / Themes', 'Подборки по настроению или темам', 'Collections by mood or themes', 'collections.by-mood', 404),
('Для новичков', 'For Beginners', 'Рекомендации для новичков', 'Recommendations for beginners', 'collections.for-beginners', 405)
ON CONFLICT (slug) DO NOTHING;

-- Translations subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Сравнение переводов', 'Translation Comparison', 'Сравнение разных переводов', 'Comparison of different translations', 'translations.compare', 501),
('Качество перевода/редактура', 'Translation Quality/Edit', 'Обсуждение качества перевода и редактуры', 'Discussion of translation quality and editing', 'translations.quality', 502),
('Термины и глоссарии', 'Terms and Glossaries', 'Термины и глоссарии переводов', 'Terms and glossaries of translations', 'translations.glossary', 503),
('Разбор фрагментов', 'Fragment Analysis', 'Разбор отдельных фрагментов', 'Analysis of individual fragments', 'translations.excerpts', 504)
ON CONFLICT (slug) DO NOTHING;

-- Industry subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Авторы: новости', 'Authors: News', 'Новости об авторах', 'News about authors', 'industry.authors-news', 601),
('Интервью / заметки', 'Interviews / Notes', 'Интервью с авторами и заметки', 'Interviews with authors and notes', 'industry.interviews', 602),
('Издательства и рынок', 'Publishers and Market', 'Издательства и книжный рынок', 'Publishers and the book market', 'industry.publishers', 603),
('Тренды / подборки по рынку', 'Market Trends / Collections', 'Тренды и подборки по книжному рынку', 'Trends and collections related to the book market', 'industry.trends', 604)
ON CONFLICT (slug) DO NOTHING;

-- Clubs subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Совместные чтения', 'Readalongs', 'Совместные чтения книг', 'Books read together', 'clubs.readalongs', 701),
('Марафоны / челленджи', 'Marathons / Challenges', 'Чтения марафоны и челленджи', 'Reading marathons and challenges', 'clubs.challenges', 702),
('Цели чтения', 'Reading Goals', 'Цели и планы по чтению', 'Reading goals and plans', 'clubs.goals', 703),
('Отчёты / прогресс', 'Reports / Progress', 'Отчёты о прочитанном и прогрессе', 'Reports on reading and progress', 'clubs.progress', 704)
ON CONFLICT (slug) DO NOTHING;

-- Community subcategories
INSERT INTO article_categories (title, title_en, description, description_en, slug, sort_order) VALUES
('Обновления сервиса', 'Service Updates', 'Обновления и изменения в сервисе', 'Updates and changes to the service', 'community.product-updates', 801),
('Вопросы и помощь', 'Questions and Help', 'Вопросы и помощь пользователям', 'Questions and help for users', 'community.qna', 802),
('Идеи и предложения', 'Ideas and Suggestions', 'Идеи и предложения по улучшению', 'Ideas and suggestions for improvement', 'community.ideas', 803)
ON CONFLICT (slug) DO NOTHING;

-- Establish parent-child relationships using the existing function from custom migration
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
    UPDATE article_categories SET parent_id = news_parent_id WHERE slug IN ('news.new-books', 'news.new-translations', 'news.reprints', 'news.adaptations', 'news.awards-events');

    -- Update books subcategories
    UPDATE article_categories SET parent_id = books_parent_id WHERE slug IN ('books.no-spoilers', 'books.spoilers', 'books.by-chapters', 'books.theories', 'books.quotes');

    -- Update reviews subcategories
    UPDATE article_categories SET parent_id = reviews_parent_id WHERE slug IN ('reviews.reviews', 'reviews.essays', 'reviews.characters-world', 'reviews.plot-structure', 'reviews.themes');

    -- Update collections subcategories
    UPDATE article_categories SET parent_id = collections_parent_id WHERE slug IN ('collections.what-next', 'collections.tops', 'collections.by-genre', 'collections.by-mood', 'collections.for-beginners');

    -- Update translations subcategories
    UPDATE article_categories SET parent_id = translations_parent_id WHERE slug IN ('translations.compare', 'translations.quality', 'translations.glossary', 'translations.excerpts');

    -- Update industry subcategories
    UPDATE article_categories SET parent_id = industry_parent_id WHERE slug IN ('industry.authors-news', 'industry.interviews', 'industry.publishers', 'industry.trends');

    -- Update clubs subcategories
    UPDATE article_categories SET parent_id = clubs_parent_id WHERE slug IN ('clubs.readalongs', 'clubs.challenges', 'clubs.goals', 'clubs.progress');

    -- Update community subcategories
    UPDATE article_categories SET parent_id = community_parent_id WHERE slug IN ('community.product-updates', 'community.qna', 'community.ideas');

    RAISE NOTICE 'Article category hierarchy updated successfully';
END $$;