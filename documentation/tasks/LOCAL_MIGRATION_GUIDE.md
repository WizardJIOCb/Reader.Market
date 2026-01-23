# Book View Tracking Fix - Local PostgreSQL Guide

## 📌 Important: Local vs Server

You're developing locally on Windows with PostgreSQL, and later you'll deploy to a server. This guide covers **both scenarios**.

## 🖥️ For Local Development (Windows + PostgreSQL)

### Your Setup
- **Database**: Local PostgreSQL at `localhost:5432`
- **Database Name**: `booksdb`
- **User**: `booksuser`

### Step 1: Apply Migration Locally

Use the local-specific scripts:

```bash
# Check for duplicates (optional)
node check_duplicates_local.cjs

# Apply the migration
node apply_local_migration.cjs

# Test the functionality
node test_track_view_local.cjs
```

### Alternative: Using Drizzle Kit

```bash
npx drizzle-kit push
```

This will automatically apply all pending migrations including the new one.

### Alternative: Manual SQL Execution

If you prefer, you can connect to PostgreSQL and run the SQL directly:

```bash
# Connect to PostgreSQL
psql -U booksuser -d booksdb

# Then paste the contents of:
# migrations/0007_add_unique_constraint_book_view_statistics.sql
```

## 🌐 For Server Deployment

When you deploy to the server, you'll need to apply the same migration there. The process depends on your server setup:

### Option A: If server uses same PostgreSQL setup
Use the same local scripts on the server:
```bash
node apply_local_migration.cjs
```

### Option B: If server uses Neon Database
Use the original Neon scripts:
```bash
node apply_view_migration.cjs
```

### Option C: Using Drizzle Kit (Recommended for both)
```bash
npx drizzle-kit push
```

This works for both local and server because it reads from `drizzle.config.ts`.

## 📝 Files Created

### For Local PostgreSQL (Use these now)
- ✅ `check_duplicates_local.cjs` - Check for duplicates
- ✅ `apply_local_migration.cjs` - Apply migration locally
- ✅ `test_track_view_local.cjs` - Test locally

### For Neon Database (Use on server if needed)
- `check_view_duplicates.cjs` - Check for duplicates
- `apply_view_migration.cjs` - Apply migration
- `test_track_view.cjs` - Test

### Migration Files (Work everywhere)
- `migrations/0007_add_unique_constraint_book_view_statistics.sql`
- `migrations/meta/0007_snapshot.json`
- `migrations/meta/_journal.json`

## 🚀 Quick Start (Local Windows)

1. **Make sure PostgreSQL is running**
   ```bash
   # Check if PostgreSQL service is running
   Get-Service -Name postgresql*
   ```

2. **Apply the migration**
   ```bash
   node apply_local_migration.cjs
   ```

3. **Test it works**
   ```bash
   node test_track_view_local.cjs
   ```

4. **Start your app and test the endpoint**
   ```bash
   npm run dev
   ```

## ✅ Expected Results (Local)

After running `apply_local_migration.cjs`, you should see:

```
Applying migration: 0007_add_unique_constraint_book_view_statistics

Database: postgresql://booksuser:****@localhost:5432/booksdb?schema=public

Executing migration...

Executing statement 1/3...
✓ Statement 1 completed
Executing statement 2/3...
✓ Statement 2 completed
Executing statement 3/3...
✓ Statement 3 completed

✓ Migration applied successfully!

✓ Constraint verified:
┌─────────┬───────────────────────────────────────────────────────────┬─────────────────┐
│ (index) │                     constraint_name                        │ constraint_type │
├─────────┼───────────────────────────────────────────────────────────┼─────────────────┤
│    0    │ 'book_view_statistics_book_id_view_type_unique'           │    'UNIQUE'     │
└─────────┴───────────────────────────────────────────────────────────┴─────────────────┘

✓ No duplicates found

✅ Migration completed successfully!
```

## 🔍 Troubleshooting

### PostgreSQL not running
```bash
# Windows: Start PostgreSQL service
Start-Service postgresql-x64-14  # adjust version number

# Or using pg_ctl
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

### Connection refused
Check your `.env` file has the correct DATABASE_URL:
```
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
```

### Migration already applied
The migration is idempotent - you can run it multiple times safely. If the constraint already exists, it will skip that step.

## 📊 Verify Migration Success

Check the constraint exists:
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'book_view_statistics'
AND constraint_name = 'book_view_statistics_book_id_view_type_unique';
```

Should return 1 row with constraint_type = 'UNIQUE'

## 🔄 Server Deployment Later

When you deploy to server:

1. **Push your code** (including all migration files)
2. **On the server, run**:
   ```bash
   # If using same PostgreSQL setup
   node apply_local_migration.cjs
   
   # OR use Drizzle Kit (works for any DB)
   npx drizzle-kit push
   ```

3. **Restart your app**

The migration files work everywhere - you just need to use the appropriate connection method (local pg vs Neon).

## 📦 Dependencies

These scripts use the `pg` package which should already be in your `package.json`. If not:

```bash
npm install pg
```

## 🎯 What This Fixes

- ❌ Before: `POST /api/books/:id/track-view` returns error
- ✅ After: `POST /api/books/:id/track-view` returns `{"success": true}`

The endpoint will work correctly for both `card_view` and `reader_open` view types.
