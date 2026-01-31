Что сейчас всё ещё не так (критично)
1) Frontend редактора в edit-режиме шлёт PUT по slug, а backend обновляет только по id

client/src/pages/ArticleEditorPage.tsx

Сейчас: PUT /api/articles/${articleSlug}

Backend: PUT /api/articles/:id и внутри updateArticle() обновляет по articles.id

➡️ Результат: редактирование статьи по slug не обновит запись.

Дополнительно: create возвращает { article }, а update возвращает просто Article — а фронт всегда ждёт result.article.slug.

2) ArticleDetailPage ждёт другой формат ответа и другой endpoint для view + save

client/src/pages/ArticleDetailPage.tsx

Ждёт data.article, но backend GET /api/articles/:identifier возвращает article напрямую

Для просмотра шлёт POST /api/articles/:id/view, а backend слушает POST /api/articles/:id/views

Save/unsave использует /save /unsave, а backend реализовал /read-later

➡️ Страница деталей статьи сейчас почти вся в несовпадениях.

3) storage.ts до сих пор обращается к несуществующим колонкам viewCount/contentHtml/categoryId/...

server/storage.ts

В listArticles() сортировка идёт по articles.viewCount, но в schema поле называется views

В getUserReadLaterArticles() до сих пор выбираются contentHtml, categoryId, replyToArticleId, viewCount — этих полей нет в schema (и не должны использоваться для v1)

➡️ Это может не компилироваться или падать на запросах.

4) Теги и связанные книги не “прикручены” к create/update

В storage.ts есть функции:

attachTagsToArticle(articleId, tagNames)

attachBooksToArticle(articleId, bookIds, roles?)

Но createArticle() / updateArticle() их не вызывают, и getArticle() не возвращает tags/attachedBooks.

➡️ UI ожидает tags и attachedBooks, но backend сейчас отдаёт “голую” статью.

5) Миграция 0036_articles_v1_clean.sql не чинит существующие таблицы, если они уже созданы

Там в основном CREATE TABLE IF NOT EXISTS — но если у тебя таблицы уже были созданы миграцией 0032, то:

структура не поменяется (например article_books останется с composite PK без id, role, sort_order, если их нет)

article_tags уже существует — axis может так и не появиться без ALTER TABLE

Что передать Qoder (одним таском)

Скопируй ему как есть:

✅ ТАСК: Довести Articles до рабочего v1 — выровнять контракт БД/API/Frontend
A) Привести API к одному формату ответа (чтобы фронт не угадывал)

POST /api/articles → возвращает { article }

PUT /api/articles/:id → тоже возвращает { article } (а не голый объект)

GET /api/articles/:identifier → вернуть { article } (или изменить фронт везде на “голый ответ”, но выбрать 1 стиль и везде одинаково)

endpoint просмотра: оставить POST /api/articles/:id/views (как в routes) и переделать фронт под него

B) Починить Editor (edit mode)

client/src/pages/ArticleEditorPage.tsx

При загрузке статьи по slug сохранять article.id в state (например articleId)

В edit mode делать PUT /api/articles/${articleId} (НЕ slug)

После save редирект:

если ответ { article } → result.article.slug

привести create/update к одинаковому формату, чтобы не было if-ов

C) Починить ArticleDetailPage под текущие routes

client/src/pages/ArticleDetailPage.tsx

Чтение статьи: ожидать { article } (или “голый”, в зависимости от пункта A)

Просмотр: POST /api/articles/${id}/views

Save/unsave заменить на read-later:

add: POST /api/articles/${id}/read-later

remove: DELETE /api/articles/${id}/read-later
(и при загрузке статьи нужен флаг isReadLater, см. пункт D)

D) Довести storage: убрать старые поля и добавить “relations”

server/storage.ts

Везде заменить viewCount → views (и сортировку тоже)

Удалить/исправить выборку несуществующих колонок (contentHtml/categoryId/replyToArticleId/viewCount) в read-later и других местах

В createArticle() после insert вызвать:

attachTagsToArticle(article.id, tags)

attachBooksToArticle(article.id, bookIds, roles)

В updateArticle() аналогично: если переданы tags/books — делать replace через attach*

В getArticle(identifier, userId?) возвращать расширенную структуру:

author (join users)

tags (через getArticleTags)

attachedBooks (через getArticleAttachedBooks)

isReadLater (exists в article_read_later для userId, если есть)

E) Миграции: сделать так, чтобы реально обновляли существующую БД

0036_articles_v1_clean.sql переписать в стиле:

ALTER TABLE article_books ADD COLUMN IF NOT EXISTS id uuid ...;

ALTER TABLE article_books ADD COLUMN IF NOT EXISTS role ...;

ALTER TABLE article_books ADD COLUMN IF NOT EXISTS sort_order ...;

если там composite PK — не обязательно ломать PK сейчас, но хотя бы добавить UNIQUE(article_id, book_id) и не требовать id как PK в schema или наоборот (выбрать одно)

ALTER TABLE article_tags ADD COLUMN IF NOT EXISTS axis ...; (а не CREATE TABLE IF NOT EXISTS)

убедиться, что таблица связей называется так же, как в schema (article_tag_links, а не article_tag_map) — либо сделать rename, либо поменять schema/storage.

Самая быстрая проверка “готово/не готово”

После правок должно работать:

Создать статью (POST) → открыть /articles/:slug

Редактировать (PUT по id) → изменения сохранились

Открыть detail → view инкрементится через /views

Add/remove read-later работает и отражается в UI