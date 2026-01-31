CREATE TABLE "activity_feed" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"target_user_id" varchar,
	"book_id" varchar,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "book_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"mentioned_user_id" varchar,
	"quoted_message_id" varchar,
	"attachment_urls" jsonb DEFAULT '[]'::jsonb,
	"attachment_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "book_translations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" varchar NOT NULL,
	"language" varchar(10) NOT NULL,
	"translation_type" varchar(20) NOT NULL,
	"translation_service" varchar(50),
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"status_details" jsonb,
	"error_message" text,
	"translated_by" varchar,
	"partial_file_path" text,
	"last_completed_chunk" integer DEFAULT 0,
	"total_chunks" integer DEFAULT 0,
	"total_characters" integer DEFAULT 0,
	"translated_characters" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmark_collection_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" varchar NOT NULL,
	"bookmark_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmark_collections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar DEFAULT '#3b82f6',
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oauth_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oauth_states_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"state_token" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"code_verifier" varchar(255),
	"language" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "oauth_states_state_token_unique" UNIQUE("state_token")
);
--> statement-breakpoint
CREATE TABLE "profile_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"content" text NOT NULL,
	"attachment_urls" jsonb DEFAULT '[]'::jsonb,
	"attachment_metadata" jsonb,
	"linked_rating_id" varchar,
	"parent_comment_id" varchar,
	"quoted_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"algorithm_type" varchar(50) DEFAULT 'simple_average' NOT NULL,
	"prior_mean" numeric(3, 1) DEFAULT '7.4',
	"prior_weight" integer DEFAULT 30,
	"likes_alpha" numeric(2, 1) DEFAULT '0.4',
	"likes_max_weight" numeric(2, 1) DEFAULT '3.0',
	"min_text_weight" numeric(2, 1) DEFAULT '0.3',
	"time_decay_enabled" boolean DEFAULT false,
	"time_decay_half_life" integer DEFAULT 180,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tts_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" varchar NOT NULL,
	"chapter_index" integer,
	"chunk_index" integer NOT NULL,
	"provider" text NOT NULL,
	"lang" varchar(10) NOT NULL,
	"voice" text NOT NULL,
	"rate" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"format" text NOT NULL,
	"text_hash" text NOT NULL,
	"audio_path" text NOT NULL,
	"audio_size" integer,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tts_cache_text_hash_unique" UNIQUE("text_hash")
);
--> statement-breakpoint
CREATE TABLE "tts_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tts_enabled" boolean DEFAULT true NOT NULL,
	"enabled_providers" jsonb DEFAULT '["rhvoice","piper"]'::jsonb NOT NULL,
	"default_provider" text DEFAULT 'piper' NOT NULL,
	"default_lang" varchar(10) DEFAULT 'en' NOT NULL,
	"default_voice_ru" text,
	"default_voice_en" text,
	"default_rate" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"min_rate" numeric(3, 2) DEFAULT '0.80' NOT NULL,
	"max_rate" numeric(3, 2) DEFAULT '1.25' NOT NULL,
	"chunk_min_chars" integer DEFAULT 400 NOT NULL,
	"chunk_max_chars" integer DEFAULT 1800 NOT NULL,
	"audio_format" text DEFAULT 'mp3' NOT NULL,
	"mp3_bitrate" integer DEFAULT 64 NOT NULL,
	"queue_concurrency" integer DEFAULT 1 NOT NULL,
	"cache_max_gb" integer DEFAULT 20 NOT NULL,
	"cache_ttl_days" integer DEFAULT 90 NOT NULL,
	"rhvoice_bin_path" text DEFAULT '/usr/bin/RHVoice-test',
	"piper_bin_path" text DEFAULT '/usr/local/bin/piper',
	"piper_models_dir" text DEFAULT '/opt/piper/models',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tts_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_hash" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"lang" varchar(10) NOT NULL,
	"voice" text NOT NULL,
	"rate" numeric(3, 2) NOT NULL,
	"format" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action_type" text NOT NULL,
	"target_type" text,
	"target_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_channel_read_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"channel_id" varchar NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rating_agg" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"sum_w" numeric(10, 4) DEFAULT '0',
	"sum_wx" numeric(10, 4) DEFAULT '0',
	"count_active" integer DEFAULT 0,
	"recent_sum_w" numeric(10, 4) DEFAULT '0',
	"recent_sum_wx" numeric(10, 4) DEFAULT '0',
	"rating_overall" numeric(3, 1),
	"rating_recent" numeric(3, 1),
	"confidence" numeric(3, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rating_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prior_mean" numeric(3, 1) DEFAULT '7.5',
	"prior_strength" integer DEFAULT 20,
	"confidence_threshold" integer DEFAULT 30,
	"rater_young_days" integer DEFAULT 7,
	"rater_young_mult" numeric(2, 1) DEFAULT '0.3',
	"rater_medium_days" integer DEFAULT 30,
	"rater_medium_mult" numeric(2, 1) DEFAULT '0.6',
	"rater_mature_mult" numeric(2, 1) DEFAULT '1.0',
	"rater_verified_mult" numeric(3, 2) DEFAULT '1.10',
	"rater_activity_mult" numeric(3, 2) DEFAULT '1.05',
	"rater_min_reading_minutes_30d" integer DEFAULT 60,
	"rater_min_books_added_30d" integer DEFAULT 3,
	"rater_weight_cap" numeric(2, 1) DEFAULT '1.2',
	"rater_weight_floor" numeric(2, 1) DEFAULT '0.2',
	"text_empty_mult" numeric(2, 1) DEFAULT '0.85',
	"text_short_length" integer DEFAULT 20,
	"text_short_mult" numeric(2, 1) DEFAULT '0.6',
	"text_normal_max_length" integer DEFAULT 1200,
	"text_normal_mult" numeric(2, 1) DEFAULT '1.0',
	"text_long_mult" numeric(2, 1) DEFAULT '0.9',
	"text_spam_mult" numeric(2, 1) DEFAULT '0.3',
	"likes_enabled" boolean DEFAULT true,
	"likes_alpha" numeric(2, 1) DEFAULT '0.3',
	"likes_cap" numeric(2, 1) DEFAULT '2.0',
	"time_decay_enabled" boolean DEFAULT false,
	"time_decay_half_life_days" integer DEFAULT 180,
	"time_decay_min_weight" numeric(2, 1) DEFAULT '3.0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "book_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "chapter_index" integer;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "selected_text" text;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "page_in_chapter" integer;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_comment_id" varchar;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "quoted_text" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_en" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "content_en" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "book_id" varchar;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "profile_comment_id" varchar;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "chapter_index" integer;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "parent_review_id" varchar;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "quoted_text" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_blocked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "block_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_rating" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chat_messages" ADD CONSTRAINT "book_chat_messages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chat_messages" ADD CONSTRAINT "book_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chat_messages" ADD CONSTRAINT "book_chat_messages_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chat_messages" ADD CONSTRAINT "book_chat_messages_quoted_message_id_book_chat_messages_id_fk" FOREIGN KEY ("quoted_message_id") REFERENCES "public"."book_chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_translations" ADD CONSTRAINT "book_translations_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_translations" ADD CONSTRAINT "book_translations_translated_by_users_id_fk" FOREIGN KEY ("translated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_collection_items" ADD CONSTRAINT "bookmark_collection_items_collection_id_bookmark_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."bookmark_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_collection_items" ADD CONSTRAINT "bookmark_collection_items_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_profile_id_users_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_linked_rating_id_profile_ratings_id_fk" FOREIGN KEY ("linked_rating_id") REFERENCES "public"."profile_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_ratings" ADD CONSTRAINT "profile_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_ratings" ADD CONSTRAINT "profile_ratings_profile_id_users_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tts_cache" ADD CONSTRAINT "tts_cache_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_read_positions" ADD CONSTRAINT "user_channel_read_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_read_positions" ADD CONSTRAINT "user_channel_read_positions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rating_agg" ADD CONSTRAINT "user_rating_agg_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_bookmark_unique_idx" ON "bookmark_collection_items" USING btree ("collection_id","bookmark_id");--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_profile_comment_id_profile_comments_id_fk" FOREIGN KEY ("profile_comment_id") REFERENCES "public"."profile_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" DROP COLUMN "chapter_id";--> statement-breakpoint
ALTER TABLE "bookmarks" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "bookmarks" DROP COLUMN "position";