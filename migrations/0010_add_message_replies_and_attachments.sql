-- Migration: Add message reply, emoji and file attachment support
-- This migration adds support for message citations, file uploads, and attachments to messages, comments, and reviews

-- Create file_uploads table for tracking all uploaded files
CREATE TABLE IF NOT EXISTS "file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" varchar NOT NULL,
	"file_url" text NOT NULL,
	"filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"thumbnail_url" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

-- Add foreign key to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'file_uploads_uploader_id_users_id_fk'
    ) THEN
        ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploader_id_users_id_fk" 
        FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to messages table for replies and attachments
DO $$ 
BEGIN
    -- Add quoted_message_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'quoted_message_id'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "quoted_message_id" varchar;
    END IF;

    -- Add quoted_text if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'quoted_text'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "quoted_text" text;
    END IF;

    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Add foreign key from messages.quoted_message_id to messages.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_quoted_message_id_messages_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_messages_id_fk" 
        FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to comments table for attachments
DO $$ 
BEGIN
    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "comments" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "comments" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to reviews table for attachments
DO $$ 
BEGIN
    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "reviews" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "reviews" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "file_uploads_uploader_id_idx" ON "file_uploads" ("uploader_id");
CREATE INDEX IF NOT EXISTS "file_uploads_entity_idx" ON "file_uploads" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "file_uploads_uploaded_at_idx" ON "file_uploads" ("uploaded_at");
CREATE INDEX IF NOT EXISTS "messages_quoted_message_id_idx" ON "messages" ("quoted_message_id");
--> statement-breakpoint
-- Migration: Add message reply, emoji and file attachment support
-- This migration adds support for message citations, file uploads, and attachments to messages, comments, and reviews

-- Create file_uploads table for tracking all uploaded files
CREATE TABLE IF NOT EXISTS "file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" varchar NOT NULL,
	"file_url" text NOT NULL,
	"filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"thumbnail_url" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

-- Add foreign key to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'file_uploads_uploader_id_users_id_fk'
    ) THEN
        ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploader_id_users_id_fk" 
        FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to messages table for replies and attachments
DO $$ 
BEGIN
    -- Add quoted_message_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'quoted_message_id'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "quoted_message_id" varchar;
    END IF;

    -- Add quoted_text if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'quoted_text'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "quoted_text" text;
    END IF;

    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Add foreign key from messages.quoted_message_id to messages.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_quoted_message_id_messages_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_messages_id_fk" 
        FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to comments table for attachments
DO $$ 
BEGIN
    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "comments" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "comments" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Add new columns to reviews table for attachments
DO $$ 
BEGIN
    -- Add attachment_urls if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'attachment_urls'
    ) THEN
        ALTER TABLE "reviews" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Add attachment_metadata if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'attachment_metadata'
    ) THEN
        ALTER TABLE "reviews" ADD COLUMN "attachment_metadata" jsonb;
    END IF;
END $$;
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "file_uploads_uploader_id_idx" ON "file_uploads" ("uploader_id");
CREATE INDEX IF NOT EXISTS "file_uploads_entity_idx" ON "file_uploads" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "file_uploads_uploaded_at_idx" ON "file_uploads" ("uploaded_at");
CREATE INDEX IF NOT EXISTS "messages_quoted_message_id_idx" ON "messages" ("quoted_message_id");
--> statement-breakpoint
