-- Migration: Add language column to books table
-- Date: 2026-01-20

ALTER TABLE books ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
