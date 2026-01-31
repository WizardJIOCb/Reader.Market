Ниже — минимальный, но расширяемый скелет: статьи + привязка к книгам + теги/фасеты + дерево категорий обсуждений + автосоздание “главного треда” для каждой книги.

Я буду ориентироваться на ваш стек PostgreSQL + Drizzle и привычную структуру типа shared/schema.ts + server/routes/*.

1) Модель данных: Articles
1.1 Enums (категория и тип)

Категорий немного, типов тоже немного — это даст чистые фильтры.

// shared/schema/articles.ts (или shared/schema.ts, если вы всё держите в одном файле)
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean, jsonb, uniqueIndex, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users";
import { books } from "./books";

export const articleCategoryEnum = pgEnum("article_category", [
  "news_releases",     // Новости и релизы
  "reviews_opinions",  // Обзоры и мнения
  "collections",       // Подборки и рейтинги
  "guides",            // Гайды и чтение
  "lit_world",         // Литературный мир
  "community",         // Сообщество
  "product"            // Про Reader.Market
]);

export const articleTypeEnum = pgEnum("article_type", [
  // news_releases
  "book_announce",
  "book_released",
  "translation_announce",
  "translation_released",
  "reprint_new_edition",
  "preorder_open",
  "adaptation_news",
  "awards_news",

  // reviews_opinions
  "review",
  "note",
  "analysis_spoilerfree",
  "analysis_spoiler",
  "translation_compare",
  "book_compare",

  // collections
  "top_list",
  "theme_collection",
  "mood_collection",
  "where_to_start",
  "reading_order",

  // guides
  "genre_guide",
  "how_to_choose",
  "terms_explainer",
  "reading_practices",

  // lit_world
  "interview",
  "book_history",
  "publishing_market",
  "event_report",

  // community
  "challenge",
  "club_post",
  "user_article",

  // product
  "changelog",
  "help"
]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "published",
  "archived"
]);

1.2 Таблица articles

Сразу закладываем:

slug (для красивых урлов),

searchText (денормализованный текст для полнотекстового поиска),

lang,

publishedAt,

meta (всякие поля под SEO, опросы, доп. настройки).

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),

  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  category: articleCategoryEnum("category").notNull(),
  type: articleTypeEnum("type").notNull(),
  status: articleStatusEnum("status").notNull().default("draft"),

  lang: text("lang").notNull().default("ru"), // ru/en etc

  title: text("title").notNull(),
  slug: text("slug").notNull(), // unique per lang обычно
  excerpt: text("excerpt"),
  coverImageUrl: text("cover_image_url"),

  // Варианты:
  // 1) contentMd: markdown
  // 2) contentJson: editor state (TipTap/Slate/etc)
  contentMd: text("content_md"),
  contentJson: jsonb("content_json"),

  // Для поиска (можно обновлять триггером/в коде при сохранении)
  searchText: text("search_text"),

  // counters
  views: integer("views").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),

  isPinned: boolean("is_pinned").notNull().default(false),

  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
}, (t) => ({
  slugLangUnique: uniqueIndex("articles_slug_lang_uq").on(t.slug, t.lang),
  statusIdx: index("articles_status_idx").on(t.status),
  categoryIdx: index("articles_category_idx").on(t.category),
  typeIdx: index("articles_type_idx").on(t.type),
  publishedAtIdx: index("articles_published_at_idx").on(t.publishedAt),
}));

2) Привязка статей к книгам (самое важное для поиска “по книге”)
2.1 Таблица article_books

Храним роль книги в статье + порядок (для подборок/reading order).

export const articleBookRoleEnum = pgEnum("article_book_role", [
  "primary",     // статья “про” книгу
  "mentioned",   // упоминается
  "in_list",     // элемент подборки
  "comparison"   // участвует в сравнении
]);

export const articleBooks = pgTable("article_books", {
  id: uuid("id").defaultRandom().primaryKey(),

  articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),

  role: articleBookRoleEnum("role").notNull().default("mentioned"),
  sortOrder: integer("sort_order").notNull().default(0),

  // доп. поля (опционально)
  note: text("note"), // “лучший перевод 2025”, “рекомендуем начать отсюда” и т.п.

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("article_books_article_book_uq").on(t.articleId, t.bookId),
  bookIdx: index("article_books_book_idx").on(t.bookId),
  articleIdx: index("article_books_article_idx").on(t.articleId),
}));

Что это даёт

На странице книги: SELECT * FROM articles JOIN article_books WHERE book_id=...

В подборках: сортировка по sortOrder

Поиск “где книга primary” — фильтр по role='primary'

3) Теги/фасеты для статей (без перегруза деревом)
3.1 article_tags + article_tag_links
export const articleTagAxisEnum = pgEnum("article_tag_axis", [
  "genre",
  "theme",
  "mood",
  "country",
  "era",
  "format",
  "audience",
  "award",
  "language",
  "other"
]);

export const articleTags = pgTable("article_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  axis: articleTagAxisEnum("axis").notNull().default("other"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("article_tags_axis_slug_uq").on(t.axis, t.slug),
  axisIdx: index("article_tags_axis_idx").on(t.axis),
}));

export const articleTagLinks = pgTable("article_tag_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => articleTags.id, { onDelete: "cascade" }),
}, (t) => ({
  uq: uniqueIndex("article_tag_links_uq").on(t.articleId, t.tagId),
  articleIdx: index("article_tag_links_article_idx").on(t.articleId),
  tagIdx: index("article_tag_links_tag_idx").on(t.tagId),
}));

4) Обсуждения как “форум”: категории + треды + посты

Вы уже используете groups/channels/messages, но для “форумного” UX удобнее иметь отдельную сущность тредов (иначе “сообщения” превращаются в бесконечный чат без структуры).

4.1 Категории обсуждений (простое дерево 2 уровней)
export const discussionCategories = pgTable("discussion_categories", {
  id: uuid("id").defaultRandom().primaryKey(),

  parentId: uuid("parent_id").references(() => discussionCategories.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  slug: text("slug").notNull(),

  sortOrder: integer("sort_order").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("discussion_categories_parent_slug_uq").on(t.parentId, t.slug),
  parentIdx: index("discussion_categories_parent_idx").on(t.parentId),
}));

4.2 Треды обсуждений

Сделаем важную штуку: тред может быть привязан к книге (и это будет автогенериться).

export const discussionKindEnum = pgEnum("discussion_kind", [
  "general",   // обычный тред в категории
  "book",      // “главное обсуждение книги”
  "article"    // обсуждение статьи (опционально)
]);

export const discussions = pgTable("discussions", {
  id: uuid("id").defaultRandom().primaryKey(),

  categoryId: uuid("category_id").references(() => discussionCategories.id, { onDelete: "set null" }),

  kind: discussionKindEnum("kind").notNull().default("general"),

  // привязки (одна из них может быть заполнена)
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  articleId: uuid("article_id").references(() => articles.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  slug: text("slug"), // можно не обяз, если url по id

  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  postsCount: integer("posts_count").notNull().default(0),
  lastPostAt: timestamp("last_post_at", { withTimezone: true }),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // ключевая уникальность: одна книга -> один “главный” book-тред
  uqBookThread: uniqueIndex("discussions_book_kind_uq").on(t.bookId, t.kind),
  categoryIdx: index("discussions_category_idx").on(t.categoryId),
  lastPostIdx: index("discussions_last_post_at_idx").on(t.lastPostAt),
}));


Примечание: uniqueIndex("discussions_book_kind_uq").on(bookId, kind) позволяет иметь ровно один kind='book' на книгу (и при этом можно иметь другие general треды, не привязанные к книге).

4.3 Посты
export const discussionPosts = pgTable("discussion_posts", {
  id: uuid("id").defaultRandom().primaryKey(),

  discussionId: uuid("discussion_id").notNull().references(() => discussions.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  contentMd: text("content_md"),
  contentJson: jsonb("content_json"),

  replyToPostId: uuid("reply_to_post_id").references(() => discussionPosts.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  discussionIdx: index("discussion_posts_discussion_idx").on(t.discussionId),
  authorIdx: index("discussion_posts_author_idx").on(t.authorId),
}));

5) Автогенерация обсуждения для книги (чтобы форум жил сам)

Правило простое: если пользователь открыл вкладку “Обсуждение” у книги — гарантируем, что book-тред существует.

5.1 Серверный helper “getOrCreateBookDiscussion(bookId)”

Псевдокод логики:

// server/services/discussions.ts
import { db } from "../db";
import { discussions } from "../../shared/schema/articles"; // или где вы их положите
import { eq, and } from "drizzle-orm";

export async function getOrCreateBookDiscussion(params: {
  bookId: string;
  userId: string; // кто инициировал (для createdById)
  defaultCategoryId?: string; // например "Обсуждения книг"
}) {
  const existing = await db.query.discussions.findFirst({
    where: and(eq(discussions.bookId, params.bookId), eq(discussions.kind, "book")),
  });

  if (existing) return existing;

  // Заголовок можно сделать по названию книги (подтянув из books)
  // либо “Обсуждение книги”
  // Важно: race condition решаем unique index + catch conflict.
  try {
    const created = await db.insert(discussions).values({
      kind: "book",
      bookId: params.bookId,
      categoryId: params.defaultCategoryId ?? null,
      title: "Обсуждение книги",
      createdById: params.userId,
    }).returning();

    return created[0];
  } catch (e: any) {
    // если параллельно уже создали — повторно прочитать
    const retry = await db.query.discussions.findFirst({
      where: and(eq(discussions.bookId, params.bookId), eq(discussions.kind, "book")),
    });
    if (retry) return retry;
    throw e;
  }
}

5.2 Когда вызывать

GET /api/books/:id/discussion → возвращает discussionId (создаёт при необходимости)

в UI книги — кнопка “Обсуждать” ведёт на /discussions/:id

6) Поиск статей: по названию + по книгам

Минимально на старте можно сделать:

ILIKE по title

join по article_books.book_id

Дальше, когда захотите “как надо”:

tsvector по searchText + title

обновление searchText при сохранении статьи (склеить title+excerpt+contentMd)

добавлять в searchText названия привязанных книг (или просто join-ом искать)

7) Инициализация дерева категорий обсуждений (seed)

Сделайте сид, который создаст корневые категории и пару подкатегорий.

Пример корня:

Обсуждения книг

Жанры

Чтение и привычки

Переводы и издания

Экранизации и медиа

Сообщество

Помощь и предложения

Оффтоп

И подкатегории (минимум):

в “Жанры”: Фэнтези, Sci-fi, Детектив, Нон-фикшн, Классика

в “Переводы”: Новые переводы, Какой перевод лучше, Издания/обложки

8) Коммит-план (чтобы Qoder/PR не развалился)

db/schema: добавить enums + таблицы articles, article_books, article_tags, article_tag_links

db/schema forum: discussion_categories, discussions, discussion_posts

migrations: сгенерить миграции + индексы

seed: сиды категорий обсуждений (и, если хотите, базовые теги)

api/articles: CRUD черновик/публикация + листинг с фильтрами (category/type/tags/lang)

api/books/:id/articles: получение статей по книге

api/books/:id/discussion: getOrCreateBookDiscussion

ui/articles: список, фильтры, страница статьи (и блок “связанные книги”)

ui/books: вкладка “Статьи” + вкладка “Обсуждение”

ui/discussions: главная форума (категории + новое/популярное) + страница треда
