ALTER TABLE "discussion_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discussion_posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discussion_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discussion_views" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discussions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "discussion_categories" CASCADE;--> statement-breakpoint
DROP TABLE "discussion_posts" CASCADE;--> statement-breakpoint
DROP TABLE "discussion_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "discussion_views" CASCADE;--> statement-breakpoint
DROP TABLE "discussions" CASCADE;--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_author_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "article_books_article_idx";--> statement-breakpoint
DROP INDEX "article_tag_links_uq";--> statement-breakpoint
DROP INDEX "article_tag_links_article_idx";--> statement-breakpoint
DROP INDEX "article_tag_links_tag_idx";--> statement-breakpoint
ALTER TABLE "article_books" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "article_books" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "author_user_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_tag_links_article_tag_uq" ON "article_tag_links" USING btree ("article_id","tag_id");--> statement-breakpoint
ALTER TABLE "article_books" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "article_books" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "article_tag_links" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "author_id";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "content_md";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "is_pinned";