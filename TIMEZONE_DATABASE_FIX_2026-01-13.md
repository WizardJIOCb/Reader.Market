# PostgreSQL Timezone Configuration Fix

## Problem Diagnosis

**Symptom:** Comments on production server show "in about 3 hours" instead of current time.

**Root Cause:** PostgreSQL database timezone is set to server's local time (UTC+3) instead of UTC.

**Flow of the Problem:**
1. User posts comment at 01:08 local time (UTC+3)
2. Server creates timestamp with `new Date()` → 01:08 server local time
3. PostgreSQL stores as `timestamp` type → 01:08 (interpreted as server local = UTC+3)
4. Backend calls `.toISOString()` → Converts 01:08 server local to ISO → "2026-01-13T01:08:00+03:00" → becomes "2026-01-12T22:08:00.000Z" UTC
5. BUT actually PostgreSQL defaultNow() stores 04:48 when user's clock shows 01:48 because server is +3 hours ahead
6. `.toISOString()` gets Date object from PostgreSQL which is already 04:48 local
7. Converts to ISO: "2026-01-13T04:48:00.000Z"
8. User's browser converts 04:48 UTC → 04:48 + 3 (user timezone) = 07:48 local
9. date-fns shows: "in 3 hours"

## Solution: Configure PostgreSQL to Use UTC

### Option 1: Set Database Timezone to UTC (Recommended)

**On Production Server:**

```bash
# Connect to PostgreSQL
psql -U booksuser -d booksdb

# Check current timezone
SHOW timezone;

# Set timezone to UTC for this database
ALTER DATABASE booksdb SET timezone TO 'UTC';

# Verify
SHOW timezone;

# Exit
\q

# Restart PM2 to reconnect with new settings
pm2 restart ollama-reader
```

### Option 2: Set Session Timezone in Connection String

**Modify `.env` file to include timezone parameter:**

```
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?timezone=UTC
```

### Option 3: Set PostgreSQL Server-Wide Timezone

**Edit PostgreSQL configuration:**

```bash
# Find postgresql.conf location
psql -U postgres -c "SHOW config_file"

# Edit the file
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and set:
timezone = 'UTC'

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## Verification Steps

After applying the fix:

1. **Check Database Timezone:**
```sql
SELECT current_setting('TIMEZONE');
```

2. **Test New Comment:**
- Post a comment on https://reader.market/book/1d022ad7-7a19-439c-9599-cb199faa6982
- Verify timestamp shows "just now" or "X seconds ago"
- NOT "in X hours"

3. **Check Stored Timestamp:**
```sql
SELECT id, content, created_at, created_at AT TIME ZONE 'UTC' as utc_time
FROM comments
ORDER BY created_at DESC
LIMIT 1;
```

## Expected Results After Fix

- **Database stores:** UTC timestamp
- **Backend sends:** ISO 8601 UTC string like "2026-01-13T01:08:00.000Z"
- **User's browser:** Converts to local timezone automatically
- **Display shows:** "just now" or correct relative/absolute time

## Important Notes

1. **Existing Data:** Old timestamps will still show incorrect time. This only fixes NEW timestamps.
2. **No Code Changes:** Frontend and backend code are already correct.
3. **Migration Not Required:** Just configuration change.
4. **All Users:** Will see correct time in their own timezone after fix.

## If Fix Doesn't Work

If after setting UTC timezone, timestamps still show wrong:

1. Check if connection pool needs restart:
```bash
pm2 restart ollama-reader
pm2 logs ollama-reader --lines 50
```

2. Verify timezone in application:
```javascript
// Add temporary logging in server/routes.ts createComment endpoint
console.log('Server Date:', new Date().toISOString());
console.log('Server TZ:', Intl.DateTimeFormat().resolvedOptions().timeZone);
```

3. Check PostgreSQL client timezone:
```sql
SHOW timezone;
SELECT now(), now() AT TIME ZONE 'UTC';
```

## Alternative: Migrate Schema to timestamptz

If timezone configuration doesn't persist, migrate schema to use PostgreSQL's timezone-aware type:

```sql
-- This would require schema migration
ALTER TABLE comments 
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE comments
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- Repeat for all tables with timestamp columns
```

**Warning:** This is more invasive and requires testing. Use Option 1 first.
