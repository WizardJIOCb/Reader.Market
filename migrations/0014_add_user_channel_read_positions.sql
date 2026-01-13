-- Migration: Add user_channel_read_positions table
-- Purpose: Track when users last viewed group channels for unread count calculation
-- Replaces the workaround of creating soft-deleted system messages

-- Create the user_channel_read_positions table
CREATE TABLE IF NOT EXISTS "user_channel_read_positions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "channel_id" varchar NOT NULL REFERENCES "channels"("id"),
  "last_read_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create a unique constraint to ensure one read position per user per channel
CREATE UNIQUE INDEX IF NOT EXISTS "user_channel_read_positions_user_channel_idx" 
ON "user_channel_read_positions" ("user_id", "channel_id");

-- Create index on channel_id for efficient queries
CREATE INDEX IF NOT EXISTS "user_channel_read_positions_channel_idx" 
ON "user_channel_read_positions" ("channel_id");

-- Create index on last_read_at for time-based filtering
CREATE INDEX IF NOT EXISTS "user_channel_read_positions_last_read_idx" 
ON "user_channel_read_positions" ("last_read_at");

-- Optional: Clean up existing soft-deleted system messages (commented out for safety)
-- These can be removed after confirming the new system works correctly
-- DELETE FROM "messages" 
-- WHERE "content" LIKE '[SYSTEM: User viewed channel at%'
-- AND "deleted_at" IS NOT NULL;
