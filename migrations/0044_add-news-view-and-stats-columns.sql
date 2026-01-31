ALTER TABLE "comments" ADD COLUMN "news_id" varchar;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "reaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "news_id" varchar;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE no action ON UPDATE no action;