# Book View Tracking Fix - Migration Guide

## Overview
This migration fixes the book view tracking error by adding a unique constraint on the `book_view_statistics` table.

## Problem
The `/api/books/:id/track-view` endpoint was returning `{"error":"Failed to track book view"}` because the database schema was missing a required unique constraint for the upsert operation to work.

## Solution
Add a unique constraint on `(book_id, view_type)` to the `book_view_statistics` table.

## Files Created

### Migration Files
- `migrations/0007_add_unique_constraint_book_view_statistics.sql` - SQL migration script
- `migrations/meta/0007_snapshot.json` - Drizzle schema snapshot
- `migrations/meta/_journal.json` - Updated migration journal

### Testing/Verification Scripts
- `check_view_duplicates.cjs` - Check for duplicate records before migration
- `apply_view_migration.cjs` - Apply the migration to the database
- `test_track_view.cjs` - Test the functionality after migration

## Migration Steps

### 1. Backup Database
Before applying any migration, create a backup of your database.

### 2. Check for Duplicates (Optional but Recommended)
```bash
node check_view_duplicates.cjs
```

This will show if there are any duplicate records that need to be consolidated.

### 3. Apply Migration

#### Option A: Using the apply script (Recommended for Neon DB)
```bash
node apply_view_migration.cjs
```

#### Option B: Using Drizzle Kit
```bash
npm run db:push
```

#### Option C: Manual SQL execution
Connect to your database and run the SQL from:
`migrations/0007_add_unique_constraint_book_view_statistics.sql`

### 4. Test the Functionality
```bash
node test_track_view.cjs
```

This will:
- Test inserting new view records
- Test incrementing existing view counts
- Verify no duplicates are created
- Confirm the constraint is working

### 5. Verify with API

Test the actual endpoint:

```bash
# Get an auth token first by logging in
# Then test the endpoint with curl or Postman

curl -X POST http://localhost:3001/api/books/{BOOK_ID}/track-view \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"viewType": "card_view"}'
```

Expected response: `{"success": true}`

## What the Migration Does

1. **Consolidates duplicates**: If any duplicate records exist for the same `(book_id, view_type)` pair:
   - Sums up all view counts
   - Keeps the latest timestamp
   - Deletes duplicate records

2. **Adds unique constraint**: Creates a constraint named `book_view_statistics_book_id_view_type_unique` on columns `(book_id, view_type)`

3. **Enables upsert operations**: With the constraint in place, the application code can now properly use PostgreSQL's `ON CONFLICT DO UPDATE` clause

## Rollback

If you need to rollback this migration:

```sql
ALTER TABLE "book_view_statistics" 
DROP CONSTRAINT "book_view_statistics_book_id_view_type_unique";
```

## Expected Results

After applying this migration:

✓ The `/api/books/:id/track-view` endpoint will work correctly
✓ View statistics will be accurately tracked
✓ No duplicate records will be created
✓ Book detail pages will show accurate view counts
✓ Admin analytics will reflect true engagement metrics

## Verification Queries

Check constraint exists:
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'book_view_statistics'
AND constraint_name = 'book_view_statistics_book_id_view_type_unique';
```

Check for duplicates (should return 0 rows):
```sql
SELECT book_id, view_type, COUNT(*) as count
FROM book_view_statistics
GROUP BY book_id, view_type
HAVING COUNT(*) > 1;
```

View statistics for a specific book:
```sql
SELECT book_id, view_type, view_count, last_viewed_at
FROM book_view_statistics
WHERE book_id = 'YOUR_BOOK_ID'
ORDER BY view_type;
```

## Notes

- This migration is safe to run multiple times (idempotent)
- The constraint creation is very fast (typically < 100ms)
- No application downtime is required
- The existing application code does not need to be changed
- All view types (card_view, reader_open, and future types) are supported

## Support

If you encounter any issues:
1. Check the error logs in the terminal output
2. Verify your database connection is working
3. Ensure you have proper permissions to alter tables
4. Review the migration SQL for any syntax errors
