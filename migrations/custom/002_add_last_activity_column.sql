-- Migration: Add last_activity_at column to users table
-- Date: 2026-01-20

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;
