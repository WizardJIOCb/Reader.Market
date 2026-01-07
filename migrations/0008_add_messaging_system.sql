-- Migration: Add social messaging system tables
-- This migration adds support for groups, channels, message reactions, and notifications

-- Create groups table
CREATE TABLE IF NOT EXISTS "groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"creator_id" varchar NOT NULL,
	"privacy" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

-- Create group_members table
CREATE TABLE IF NOT EXISTS "group_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" varchar,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create group_books table (association between groups and books)
CREATE TABLE IF NOT EXISTS "group_books" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"book_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create channels table
CREATE TABLE IF NOT EXISTS "channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"creator_id" varchar NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"related_entity_id" varchar,
	"related_entity_type" text,
	"content" jsonb,
	"read_status" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Modify messages table to support group messaging
-- Add new columns to existing messages table
DO $$ 
BEGIN
    -- Add conversation_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "conversation_id" varchar;
    END IF;

    -- Add channel_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'channel_id'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "channel_id" varchar;
    END IF;

    -- Add parent_message_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'parent_message_id'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "parent_message_id" varchar;
    END IF;

    -- Add deleted_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;
    END IF;

    -- Add deleted_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "deleted_by" varchar;
    END IF;

    -- Make recipient_id nullable (for group messages)
    ALTER TABLE "messages" ALTER COLUMN "recipient_id" DROP NOT NULL;
END $$;
--> statement-breakpoint

-- Add foreign key constraints
DO $$
BEGIN
    -- Groups table constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'groups_creator_id_users_id_fk'
    ) THEN
        ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" 
        FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Group members constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_members_group_id_groups_id_fk'
    ) THEN
        ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" 
        FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_members_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_members_invited_by_users_id_fk'
    ) THEN
        ALTER TABLE "group_members" ADD CONSTRAINT "group_members_invited_by_users_id_fk" 
        FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Group books constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_books_group_id_groups_id_fk'
    ) THEN
        ALTER TABLE "group_books" ADD CONSTRAINT "group_books_group_id_groups_id_fk" 
        FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_books_book_id_books_id_fk'
    ) THEN
        ALTER TABLE "group_books" ADD CONSTRAINT "group_books_book_id_books_id_fk" 
        FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Channels constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'channels_group_id_groups_id_fk'
    ) THEN
        ALTER TABLE "channels" ADD CONSTRAINT "channels_group_id_groups_id_fk" 
        FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'channels_creator_id_users_id_fk'
    ) THEN
        ALTER TABLE "channels" ADD CONSTRAINT "channels_creator_id_users_id_fk" 
        FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Message reactions constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'message_reactions_message_id_messages_id_fk'
    ) THEN
        ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" 
        FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'message_reactions_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Notifications constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notifications_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Add foreign keys for messages table new columns
DO $$
BEGIN
    -- Add conversation_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_conversation_id_conversations_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" 
        FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Add channel_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_channel_id_channels_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" 
        FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Add parent_message_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_parent_message_id_messages_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_messages_id_fk" 
        FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Add deleted_by foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_deleted_by_users_id_fk'
    ) THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_users_id_fk" 
        FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "groups_creator_id_idx" ON "groups" ("creator_id");
CREATE INDEX IF NOT EXISTS "groups_privacy_idx" ON "groups" ("privacy");
CREATE INDEX IF NOT EXISTS "group_members_group_id_idx" ON "group_members" ("group_id");
CREATE INDEX IF NOT EXISTS "group_members_user_id_idx" ON "group_members" ("user_id");
CREATE INDEX IF NOT EXISTS "channels_group_id_idx" ON "channels" ("group_id");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_channel_id_idx" ON "messages" ("channel_id");
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "message_reactions_message_id_idx" ON "message_reactions" ("message_id");
CREATE INDEX IF NOT EXISTS "message_reactions_user_id_idx" ON "message_reactions" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_read_status_idx" ON "notifications" ("read_status");
--> statement-breakpoint

-- Create unique constraint for group membership (one membership per user per group)
CREATE UNIQUE INDEX IF NOT EXISTS "group_members_group_user_unique" ON "group_members" ("group_id", "user_id");
--> statement-breakpoint

-- Create unique constraint for message reactions (one reaction type per user per message)
CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_unique" ON "message_reactions" ("message_id", "user_id", "emoji");
