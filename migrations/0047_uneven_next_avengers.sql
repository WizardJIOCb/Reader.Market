CREATE TABLE "article_books" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar NOT NULL,
	"book_id" varchar NOT NULL,
	"role" text DEFAULT 'mentioned',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar,
	"title" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "article_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "article_read_later" (
	"user_id" varchar NOT NULL,
	"article_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_tag_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"axis" text DEFAULT 'other',
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar NOT NULL,
	"user_id" varchar,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" varchar NOT NULL,
	"section" text,
	"format" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"lang" text DEFAULT 'ru' NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"cover_image_url" text,
	"content_md" text,
	"content_json" jsonb,
	"search_text" text,
	"views" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_books" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" varchar NOT NULL,
	"book_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content_md" text,
	"content_json" jsonb,
	"reply_to_post_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_subscriptions" (
	"user_id" varchar NOT NULL,
	"discussion_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" varchar NOT NULL,
	"user_id" varchar,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar,
	"kind" text DEFAULT 'general' NOT NULL,
	"book_id" varchar,
	"article_id" varchar,
	"title" text NOT NULL,
	"slug" text,
	"created_by_id" varchar NOT NULL,
	"posts_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp with time zone,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD COLUMN "book_id" varchar;--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD COLUMN "view_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "click_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_view_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "article_books" ADD CONSTRAINT "article_books_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_books" ADD CONSTRAINT "article_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_parent_id_article_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."article_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_read_later" ADD CONSTRAINT "article_read_later_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_read_later" ADD CONSTRAINT "article_read_later_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tag_links" ADD CONSTRAINT "article_tag_links_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tag_links" ADD CONSTRAINT "article_tag_links_tag_id_article_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."article_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_books" ADD CONSTRAINT "collection_books_collection_id_bookmark_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."bookmark_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_books" ADD CONSTRAINT "collection_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_categories" ADD CONSTRAINT "discussion_categories_parent_id_discussion_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."discussion_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_posts" ADD CONSTRAINT "discussion_posts_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_posts" ADD CONSTRAINT "discussion_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_posts" ADD CONSTRAINT "discussion_posts_reply_to_post_id_discussion_posts_id_fk" FOREIGN KEY ("reply_to_post_id") REFERENCES "public"."discussion_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_subscriptions" ADD CONSTRAINT "discussion_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_subscriptions" ADD CONSTRAINT "discussion_subscriptions_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_views" ADD CONSTRAINT "discussion_views_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_views" ADD CONSTRAINT "discussion_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_category_id_discussion_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."discussion_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_books_article_book_uq" ON "article_books" USING btree ("article_id","book_id");--> statement-breakpoint
CREATE INDEX "article_books_book_idx" ON "article_books" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "article_books_article_idx" ON "article_books" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_read_later_pk" ON "article_read_later" USING btree ("user_id","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_tag_links_uq" ON "article_tag_links" USING btree ("article_id","tag_id");--> statement-breakpoint
CREATE INDEX "article_tag_links_article_idx" ON "article_tag_links" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_tag_links_tag_idx" ON "article_tag_links" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_tags_axis_slug_uq" ON "article_tags" USING btree ("axis","slug");--> statement-breakpoint
CREATE INDEX "article_tags_axis_idx" ON "article_tags" USING btree ("axis");--> statement-breakpoint
CREATE UNIQUE INDEX "article_views_unique_idx" ON "article_views" USING btree ("article_id","user_id","ip_hash","user_agent_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_lang_uq" ON "articles" USING btree ("slug","lang");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_section_idx" ON "articles" USING btree ("section");--> statement-breakpoint
CREATE INDEX "articles_format_idx" ON "articles" USING btree ("format");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_book_unique_idx" ON "collection_books" USING btree ("collection_id","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_categories_parent_slug_uq" ON "discussion_categories" USING btree ("parent_id","slug");--> statement-breakpoint
CREATE INDEX "discussion_categories_parent_idx" ON "discussion_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "discussion_posts_discussion_idx" ON "discussion_posts" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "discussion_posts_author_idx" ON "discussion_posts" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_subscription_pk" ON "discussion_subscriptions" USING btree ("user_id","discussion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discussions_book_kind_uq" ON "discussions" USING btree ("book_id","kind") WHERE "discussions"."book_id" IS NOT NULL AND "discussions"."kind" = 'book';--> statement-breakpoint
CREATE INDEX "discussions_category_idx" ON "discussions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "discussions_last_post_at_idx" ON "discussions" USING btree ("last_post_at");--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;