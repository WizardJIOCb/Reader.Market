Задача для Qoder: новый раздел Статьи (Articles) для Reader.Market
Контекст проекта

Проект: Reader.Market (https://reader.market
)

Репо: https://github.com/WizardJIOCb/Reader.Market

Стек: React+TS+Vite+Tailwind/shadcn, Node.js+Express, PostgreSQL+Drizzle, i18n ru/en

На сервере: /var/www/reader.market

Цель

Добавить полноценный раздел Статьи, где каждый пользователь может публиковать длинные материалы с форматированием, упоминаниями книг/профилей, категориями/подкатегориями, тегами, реакциями/комментариями, просмотрами, “читать позже”, а также “ответы на статьи”.

1) Функциональные требования
1.1 Публикация статей

Любой авторизованный пользователь может:

создать статью,

редактировать свою статью,

удалить/архивировать (лучше soft delete).

Полноценное форматирование:

Rich text редактор (например TipTap / Lexical / Quill — выбрать подходящее для React+TS).

Поддержка минимум: заголовки H1-H3, жирный/курсив/подчерк, списки, ссылки, цитаты, код-блок, изображения (если есть file_uploads), разделители.

Внутри текста:

возможность вставлять ссылки на книги (по id/slug) и профили пользователей (по login).

при вставке ссылки желательно автокомплит (поиск книги/профиля).

при отображении статьи ссылки должны быть кликабельны и вести на внутренние страницы.

1.2 Привязка книг к статье

У статьи есть список прикреплённых книг (0..N).

В UI отображать блок “Прикреплённые книги” (карточки книг) в статье.

1.3 Категории и подкатегории

У статьи есть категория (одна основная).

Категории могут быть иерархическими (родитель/ребёнок).

В разделе “Статьи” отображать:

список категорий,

при выборе категории — список статей по ней (включая подкатегории опционально).

В админке — CRUD категорий (создание/редактирование/удаление/перенос, порядок, slug).

1.4 Теги

У статьи набор тегов (0..N).

Теги отображаются в конце статьи.

По тегу можно открыть поиск/страницу и увидеть другие статьи по нему.

1.5 Читать позже (Read later)

Пользователь может добавить статью в “Читать позже”.

В профиле или отдельной странице показать список статей “Читать позже”.

Должно быть idempotent: повторное добавление не дублирует запись.

1.6 Ответы на статьи (Replies)

Можно написать ответ на статью (это тоже статья, но с reply_to_article_id).

При просмотре статьи-ответа сверху показать:

“Это ответ на статью <название>” + ссылка на оригинал.

В оригинальной статье показать блок “Ответы” (список ответов).

1.7 Метрики и социальщина

Для каждой статьи:

просмотры (view count),

реакции (как у книг/комментов: лайк/эмодзи, если система уже есть),

комментарии (использовать существующую систему comments, если она поддерживает polymorphic target, либо расширить),

(опционально) оценка не нужна, только реакции.

1.8 Админка

Новый раздел “Статьи”:

список статей (поиск, фильтры: автор, категория, статус, дата),

модерация (скрыть/удалить/восстановить),

просмотр статистики: просмотры, реакции, комменты.

Раздел “Категории статей” (CRUD).

2) Модель данных (PostgreSQL + Drizzle)
2.1 Таблицы

articles

id uuid / serial

author_user_id -> users.id

title text

slug text UNIQUE (генерация из title + суффикс)

excerpt text (optional)

content_json jsonb (структура редактора) или content_html text (если редактор выдаёт html)

category_id -> article_categories.id (nullable)

reply_to_article_id -> articles.id (nullable)

status enum: draft/published/hidden/deleted (или published + soft delete)

published_at timestamptz (nullable)

created_at, updated_at

индексы: (author_user_id), (category_id), (published_at), (reply_to_article_id)

article_categories

id

parent_id -> article_categories.id (nullable)

title

slug UNIQUE

sort_order int default 0

created_at, updated_at

article_tags

id

name text UNIQUE (нормализовать: lower/trim)

slug text UNIQUE

article_tag_map

article_id -> articles.id

tag_id -> article_tags.id

PK(article_id, tag_id)

article_books

article_id -> articles.id

book_id -> books.id

PK(article_id, book_id)

article_views

Вариант A (просто счётчик): articles.view_count bigint default 0

Вариант B (уникальные просмотры): отдельная таблица

article_id, user_id nullable, ip_hash nullable, created_at

агрегировать в счетчик

article_read_later

user_id -> users.id

article_id -> articles.id

created_at

PK(user_id, article_id)

2.2 Реакции и комментарии

Если уже есть reactions и comments с polymorphic target (например target_type, target_id) — добавить поддержку target_type='article'.

Если нет — расширить схему аккуратно и добавить индексы.

3) API (Node.js + Express)
3.1 Public

GET /api/articles — список (пагинация, фильтры: category, tag, author, query)

GET /api/articles/:slug — детальная (включая author, category, tags, attached books, reply_to, replies_count)

POST /api/articles/:id/view — зарегистрировать просмотр (или делать на GET серверно)

GET /api/article-categories — дерево категорий

GET /api/articles/tag/:tagSlug — статьи по тегу

3.2 Auth required

POST /api/articles — создать (draft)

PUT /api/articles/:id — редактировать (только owner или admin)

POST /api/articles/:id/publish — publish

POST /api/articles/:id/unpublish — обратно в draft/hidden

DELETE /api/articles/:id — soft delete

POST /api/articles/:id/read-later — добавить

DELETE /api/articles/:id/read-later — удалить

POST /api/articles/:id/reply — создать ответ (или просто create с reply_to_article_id)

3.3 Admin

GET /api/admin/articles — список + фильтры

POST /api/admin/articles/:id/hide / unhide

GET /api/admin/article-categories + CRUD

4) UI (React)
4.1 Раздел “Статьи”

Страница: /articles

список категорий (с деревом/подкатегориями),

список статей (карточки: title, excerpt, author, views, date, tags, category),

фильтры: категория/тег/поиск/сортировка (новые/популярные).

Страница: /articles/:slug

заголовок, автор, дата, просмотры,

блок “Ответ на статью …” если reply,

контент статьи (рендер),

прикреплённые книги,

теги,

кнопки: реакция, “читать позже”, “написать ответ”,

комментарии,

ответы (список ответов).

4.2 Создание/редактирование

/articles/new и /articles/:id/edit

Редактор + выбор категории + теги + прикрепление книг

Автосейв черновика (опционально)

Превью (опционально)

4.3 Читать позже

/profile/:login/read-later или /read-later/articles

список сохранённых статей

4.4 Админка

Меню: “Статьи”

Таблица статей + поиск/фильтры

Категории статей (CRUD)

5) Ссылки на книги/профили внутри текста

Нужно выбрать реализацию:

Вариант 1 (проще): обычные ссылки, редактор вставляет URL вида

/book/:id или /book/:slug

/profile/:login
С автокомплитом вставки.

Вариант 2 (лучше): “умные” embed-узлы редактора:

bookMention (хранит book_id, title),

userMention (user_id/login),
при рендере превращаются в красивые ссылки.

6) Безопасность и модерация

XSS: если хранится HTML — обязательно sanitize (на сервере и/или при рендере).

Права: редактировать/удалять может автор и админ.

Draft не виден публично, только автору/админу.

7) Порядок внедрения (коммит-план)

Миграции БД + Drizzle schema (таблицы articles/categories/tags/maps/read_later/views).

API: public endpoints + auth endpoints.

UI: /articles список + /articles/:slug детальная (пока без редактора).

Редактор + создание/редактирование + publish flow.

Read later + replies.

Комментарии/реакции интеграция с существующей системой.

Админка: список статей + категории.

Полировка, i18n RU/EN, тесты.

8) Готовность / Acceptance Criteria

Можно создать статью (черновик), оформить, прикрепить книги, теги, категорию, опубликовать.

Внутри статьи работают ссылки на книги и профили.

Категории с подкатегориями отображаются и фильтруют статьи.

Теги отображаются и открывают список статей по тегу.

“Читать позже” работает (добавить/убрать/список).

Ответы на статьи работают и помечаются на странице ответа + есть список ответов у оригинала.

Просмотры/реакции/комментарии работают.

В админке есть управление статьями и категориями.


Для твоих целей (длинные статьи, полноценное форматирование, упоминания книг/профилей, вставка “внутренних” ссылок, возможные будущие embed-карточки, сохранение в БД и рендер на чтении) лучше всего подойдёт TipTap (ProseMirror).

Почему TipTap — самый практичный вариант для Reader.Market

Сильная модель документов (ProseMirror) — удобно хранить как JSON (content_json) и стабильно рендерить.

Ментions/ссылки/кастомные ноды — легко сделать bookMention и userMention, которые хранят bookId/login и рендерятся как “умные” ссылки.

Расширяемость: потом можно добавить embedded-карточку книги, блок “цитата из книги”, callout, spoiler и т.п.

Контроль над HTML: можно вообще не хранить HTML, а хранить JSON и рендерить безопасно, что сильно снижает риски XSS.

Хорошо дружит с React и твоим стеком.

Что я бы сделал в Reader.Market (рекомендованный дизайн)
Хранение

В articles хранить:

content_json (TipTap/ProseMirror JSON)

excerpt (генерировать автоматически из первых абзацев)

Не хранить content_html (или хранить как кэш/опционально, но не как source of truth).

Упоминания книг/профилей

Сделать 2 расширения TipTap:

BookMention (attrs: bookId, title, возможно slug)

UserMention (attrs: login, userId)

В редакторе автокомплит:

@login → профиль

#book или [[book]] → книга (как решишь UX)

При рендере (read-only) они превращаются в ссылки на:

/book/<slug|id>

/profile/<login>

Безопасность

Рендерить через TipTap renderer или собственный маппинг JSON→React-компоненты.

Если всё же нужен HTML (например для SEO), генерировать HTML сервером из JSON и санитайзить.