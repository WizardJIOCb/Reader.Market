Да — там всё ещё “не так”, и причина не в дизайне, а в том, что Qoder сделал полуметрацию: БД/Drizzle-схема/API/фронт используют разные имена полей и разные контракты. В итоге часть кода либо не компилируется, либо будет падать на запросах, либо тихо не будет сохранять нужные данные.

Ниже — конкретно, что именно сломано (по diff_files.zip) и что ему сказать, чтобы быстро привести к рабочему виду.

Что именно не так (самое критичное)
1) БД-таблица article_books не соответствует shared/schema.ts

В миграции 0032_add_articles_system.sql article_books создана как простая связка с PRIMARY KEY (article_id, book_id).

В shared/schema.ts articleBooks ожидает отдельный id, плюс поля role, sortOrder, note, createdAt.

Даже если 0033_add_article_publication_type.sql добавляет role и sort_order, id, note, created_at всё равно нет, и PK другой.
➡️ Результат: любые вставки/запросы через Drizzle по этой таблице будут ломаться или вести себя непредсказуемо.

2) article_tags.axis в БД скорее всего НЕ появится

В 0032 article_tags уже создана (без axis).
В 0035_update_articles_schema.sql написано CREATE TABLE IF NOT EXISTS article_tags (...) axis ... — но таблица уже существует, поэтому axis не добавится.
➡️ Результат: код ожидает axis, а в БД его нет.

3) articles: конфликт имён и полей (schema vs миграции vs API)

0032 создаёт articles.author_user_id, content_html, category_id, reply_to_article_id, view_count.

shared/schema.ts описывает author_id (в authorUserId), content_md, views, comments_count, section, format, и т.д.

server/routes.ts при создании статьи принимает categoryId, publicationType, contentHtml и т.п., но редактор (фронт) отправляет ещё section/format/lang.

➡️ Результат: данные либо не пишутся, либо пишутся “в другие колонки”, либо компиляция падает на обращениях к несуществующим колонкам (например articles.categoryId в storage).

4) API не совпадает с фронтом

Фронт в ArticleEditorPage.tsx при редактировании делает PUT /api/articles/${articleSlug},
а бэкенд ожидает PUT /api/articles/:id (там именно :id).

Фронт в ArticleDetailPage.tsx шлёт просмотр на /api/articles/:id/view,
а бэкенд слушает /api/articles/:id/views (множественное число).

➡️ Результат: edit и view-учёт не работают.

5) /articles фильтруется “не там”

ArticlesPage.tsx грузит просто fetch('/api/articles'), а поиск/фильтры делает локально в браузере, не через API.
➡️ Поэтому “поиск/фильтры” ощущаются странно, и серверные параметры (section/format/search) фактически не используются.

6) Миграция 0035 содержит SQL, который может падать

В 0035 есть апдейты вида:
... IN (SELECT unnest(enumlabel::text[]) FROM pg_enum ...) — enumlabel не массив.
И есть апдейт category_slug через article_categories, хотя category_slug может отсутствовать.
➡️ Миграции могут падать или оставлять БД в кривом состоянии.

Что ему сказать (короткий фикс-таск)

Скопируй Qoder вот это:

✅ Задача: привести “Статьи” к единому контракту и убрать полуметрацию

Выбрать один контракт и выровнять всё под него
Для v1 оставляем: section + format + tags + books.
Убираем/не используем: categoryId, article_categories, publicationType, replies, discussion_* (если не в scope).

Починить БД под shared/schema.ts (или наоборот — починить schema под БД, но выбрать одно)
Рекомендую привести БД к схеме (проще в долгую):

articles: привести имена колонок к тем, что использует сервер/фронт (author_id или author_user_id — выбрать одно и везде одинаково; то же с views/view_count, content_md/content_html)

article_books: сделать как в схеме:

добавить id uuid pk, note, created_at

оставить unique(article_id, book_id), а не composite PK

article_tags: ALTER TABLE добавить axis, а не CREATE TABLE IF NOT EXISTS

удалить/вынести в отдельные миграции всё, что не относится к v1

Выровнять API и фронт

Edit: фронт должен делать PUT по id, либо бэк должен принимать PUT по slug. Выбрать один вариант.

Views: привести к одному endpoint (/views или /view).

/articles фильтры должны ходить в API (query params), а не фильтровать локально.

Почистить server/storage.ts
Сейчас там смешаны старые и новые поля (categoryId/publicationType/viewCount vs section/format/views).
Удалить обращения к несуществующим колонкам и оставить одну реализацию методов без дублей.

Что “быстро” исправить прямо сейчас, чтобы стало ощутимо лучше

Если вы хотите минимальный патч (без полной переделки миграций) — вот самые заметные баги:

В ArticleEditorPage.tsx: PUT должен идти на /api/articles/:id, а не на slug.

В ArticleDetailPage.tsx: view endpoint привести к /api/articles/:id/views (или переименовать route).

В ArticlesPage.tsx: перестать фильтровать локально → передавать search/section/format в /api/articles?....

Но это всё равно не решит главный корень — несовпадение схемы БД и Drizzle (особенно article_books и article_tags.axis).