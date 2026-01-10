-- Migration: Make book_id column nullable in comments table to support news comments
ALTER TABLE "comments" ALTER COLUMN "book_id" DROP NOT NULL;