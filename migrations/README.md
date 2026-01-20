# Database Migrations

This directory contains SQL migration files for the reader.market database.

## Running Migrations

To run all pending migrations, execute:

```bash
start-migration.bat
```

The script will:
1. Check if PostgreSQL is installed and accessible
2. Create a `schema_migrations` tracking table if it doesn't exist
3. Run only migrations that haven't been applied yet
4. Record each successful migration in the tracking table
5. Skip migrations that have already been applied

## Migration Naming Convention

Migration files should follow this pattern:
```
XXX_description.sql
```

Where:
- `XXX` = Sequential number (e.g., 001, 002, 003)
- `description` = Brief description of what the migration does
- `.sql` = File extension

Example: `001_add_language_column.sql`

## Existing Migrations

- `001_add_language_column.sql` - Adds language column to books table
- `002_add_last_activity_column.sql` - Adds last_activity_at column to users table

## Creating New Migrations

1. Create a new `.sql` file in the `migrations` directory
2. Use the next sequential number in the filename
3. Write your SQL commands (use `IF NOT EXISTS` when possible)
4. Add a comment at the top describing the migration

Example:
```sql
-- Migration: Add email_verified column to users table
-- Date: 2026-01-21

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
```

## Troubleshooting

**"psql command not found"**
- Install PostgreSQL or add it to your PATH
- Common paths: `C:\Program Files\PostgreSQL\16\bin`

**"Could not connect to database"**
- Ensure PostgreSQL is running
- Check that the `reader_market` database exists
- Verify the `postgres` user has access

**Migration fails mid-way**
- Check the error message
- Fix the migration file
- The script will track which migrations succeeded
- Re-run `start-migration.bat` to continue from where it failed
