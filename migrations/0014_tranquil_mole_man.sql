ALTER TABLE "comments" ADD COLUMN "article_id" varchar;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "image_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "article_id" varchar;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;