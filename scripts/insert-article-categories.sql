-- Insert main article categories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Новости и анонсы', 'news', 1),
('Обсуждение книг', 'books', 2),
('Рецензии и разборы', 'reviews', 3),
('Подборки и рекомендации', 'collections', 4),
('Переводы и издания', 'translations', 5),
('Авторы и индустрия', 'industry', 6),
('Клубы и челленджи', 'clubs', 7),
('Сообщество и сервис', 'community', 8);

-- Insert subcategories (children)
-- News subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Новые книги', 'news.new-books', 101),
('Новые переводы', 'news.new-translations', 102),
('Переиздания / новые обложки', 'news.reprints', 103),
('Экранизации и адаптации', 'news.adaptations', 104),
('Премии и события', 'news.awards-events', 105);

-- Books subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Без спойлеров', 'books.no-spoilers', 201),
('Со спойлерами', 'books.spoilers', 202),
('По главам / по сценам', 'books.by-chapters', 203),
('Теории и трактовки', 'books.theories', 204),
('Цитаты и находки', 'books.quotes', 205);

-- Reviews subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Рецензии', 'reviews.reviews', 301),
('Эссе / аналитика', 'reviews.essays', 302),
('Персонажи и мир', 'reviews.characters-world', 303),
('Сюжет и структура', 'reviews.plot-structure', 304),
('Темы и смыслы', 'reviews.themes', 305);

-- Collections subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Что читать дальше', 'collections.what-next', 401),
('Топы и списки', 'collections.tops', 402),
('По жанрам', 'collections.by-genre', 403),
('По настроению / темам', 'collections.by-mood', 404),
('Для новичков', 'collections.for-beginners', 405);

-- Translations subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Сравнение переводов', 'translations.compare', 501),
('Качество перевода/редактура', 'translations.quality', 502),
('Термины и глоссарии', 'translations.glossary', 503),
('Разбор фрагментов', 'translations.excerpts', 504);

-- Industry subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Авторы: новости', 'industry.authors-news', 601),
('Интервью / заметки', 'industry.interviews', 602),
('Издательства и рынок', 'industry.publishers', 603),
('Тренды / подборки по рынку', 'industry.trends', 604);

-- Clubs subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Совместные чтения', 'clubs.readalongs', 701),
('Марафоны / челленджи', 'clubs.challenges', 702),
('Цели чтения', 'clubs.goals', 703),
('Отчёты / прогресс', 'clubs.progress', 704);

-- Community subcategories
INSERT INTO article_categories (title, slug, sort_order) VALUES
('Обновления сервиса', 'community.product-updates', 801),
('Вопросы и помощь', 'community.qna', 802),
('Идеи и предложения', 'community.ideas', 803);

-- Note: For hierarchical relationships, we would normally set parentId to link child categories to parents,
-- but since the original structure doesn't specify parent-child relationships in the database,
-- we'll just use the dot notation in slugs to indicate hierarchy conceptually.