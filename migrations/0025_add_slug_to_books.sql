-- Migration: Add slug column to books table for SEO-friendly URLs
-- Date: 2026-02-15

ALTER TABLE books ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Add index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
