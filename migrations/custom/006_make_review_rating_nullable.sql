-- Make rating column nullable for review replies (replies don't have ratings)
ALTER TABLE reviews ALTER COLUMN rating DROP NOT NULL;
