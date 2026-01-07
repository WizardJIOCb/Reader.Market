# Server Track-View Endpoint Fix Guide

## Problem Overview

The book view tracking endpoint is failing on the production server at https://reader.market:

```
POST https://reader.market/api/books/aa4a9ca1-9a21-4126-9a7a-39b17ff186bc/track-view
Response: {"error":"Failed to track book view"}
```

**Status**: Works locally but fails on production server.

## Root Cause

The database migration `0007_add_unique_constraint_book_view_statistics.sql` has not been applied to the production database. This migration adds a required unique constraint on the `book_view_statistics` table that enables PostgreSQL's upsert operation (INSERT ... ON CONFLICT DO UPDATE).

Without this constraint, the database cannot execute the upsert operation, causing the endpoint to fail.

## Step-by-Step Fix Guide

### Option 1: Quick Automated Fix (Recommended)

**Prerequisites:**
- SSH access to production server
- Database credentials configured in server's `.env` file

**Steps:**

1. **Connect to production server:**
   ```bash
   ssh user@reader.market
   ```

2. **Navigate to application directory:**
   ```bash
   cd /var/www/reader.market
   ```

3. **Run comprehensive diagnostic:**
   ```bash
   node diagnose_server_track_view.cjs
   ```
   
   This will show you exactly what's wrong.

4. **Apply the migration:**
   ```bash
   node apply_server_migration.cjs
   ```
   
   This script will:
   - Check if constraint already exists
   - Consolidate any duplicate records automatically
   - Add the unique constraint
   - Update migration tracking
   - Verify successful application

5. **Restart the application:**
   ```bash
   pm2 restart ollama-reader
   ```

6. **Verify the fix:**
   ```bash
   # Test the endpoint
   curl -X POST https://reader.market/api/books/{book-id}/track-view \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"viewType": "card_view"}'
   
   # Expected response:
   # {"success": true}
   ```

### Option 2: Manual Fix via Drizzle Kit

If you have Drizzle Kit configured on the server:

1. **Connect to server and navigate to project:**
   ```bash
   ssh user@reader.market
   cd /var/www/reader.market
   ```

2. **Run Drizzle push:**
   ```bash
   npx drizzle-kit push
   ```
   
   This will detect schema differences and apply missing migrations.

3. **Restart application:**
   ```bash
   pm2 restart ollama-reader
   ```

### Option 3: Manual SQL Execution

If automated scripts are unavailable:

1. **Connect to PostgreSQL:**
   ```bash
   psql -h localhost -U booksuser -d booksdb
   ```

2. **Execute migration SQL:**
   ```sql
   -- Consolidate duplicates
   WITH duplicates AS (
     SELECT book_id, view_type, COUNT(*) as dup_count
     FROM book_view_statistics
     GROUP BY book_id, view_type
     HAVING COUNT(*) > 1
   ),
   consolidated AS (
     SELECT 
       bvs.book_id,
       bvs.view_type,
       SUM(bvs.view_count) as total_view_count,
       MAX(bvs.last_viewed_at) as latest_viewed_at,
       MIN(bvs.created_at) as earliest_created_at,
       MAX(bvs.updated_at) as latest_updated_at,
       MIN(bvs.id) as keep_id
     FROM book_view_statistics bvs
     INNER JOIN duplicates d ON bvs.book_id = d.book_id AND bvs.view_type = d.view_type
     GROUP BY bvs.book_id, bvs.view_type
   )
   UPDATE book_view_statistics bvs
   SET 
     view_count = c.total_view_count,
     last_viewed_at = c.latest_viewed_at,
     updated_at = c.latest_updated_at
   FROM consolidated c
   WHERE bvs.id = c.keep_id;

   -- Delete duplicates
   DELETE FROM book_view_statistics bvs
   USING (
     SELECT book_id, view_type, MIN(id) as keep_id
     FROM book_view_statistics
     GROUP BY book_id, view_type
   ) keeper
   WHERE bvs.book_id = keeper.book_id 
     AND bvs.view_type = keeper.view_type 
     AND bvs.id != keeper.keep_id;

   -- Add unique constraint
   ALTER TABLE "book_view_statistics" 
   ADD CONSTRAINT "book_view_statistics_book_id_view_type_unique" 
   UNIQUE ("book_id", "view_type");
   ```

3. **Update migration tracking:**
   ```sql
   INSERT INTO _drizzle_migrations (idx, hash, created_at)
   SELECT 
     COALESCE(MAX(idx), 0) + 1,
     '0007_add_unique_constraint_book_view_statistics',
     EXTRACT(EPOCH FROM NOW()) * 1000
   FROM _drizzle_migrations;
   ```

4. **Restart application:**
   ```bash
   pm2 restart ollama-reader
   ```

## Diagnostic Tools

Several diagnostic scripts are available to help identify and fix the issue:

### 1. Check Constraint Status
```bash
node check_server_constraint.cjs
```
Shows if the required unique constraint exists.

### 2. Check Migration Status
```bash
node check_server_migrations.cjs
```
Lists all applied migrations and identifies missing ones.

### 3. Check for Duplicates
```bash
node check_server_duplicates.cjs
```
Identifies duplicate records that could prevent constraint creation.

### 4. Comprehensive Diagnostic
```bash
node diagnose_server_track_view.cjs
```
Runs all checks and provides a complete diagnostic report.

## Viewing Server Logs

To see the actual error details from the server:

### Via PM2 Logs
```bash
# Real-time logs (last 100 lines)
pm2 logs ollama-reader --lines 100

# Error logs only
pm2 logs ollama-reader --err

# Save logs to file
pm2 logs ollama-reader --lines 500 > track-view-error.log
```

### Via Log Files
```bash
# Error log
cat /var/www/reader.market/logs/err.log

# Combined log
cat /var/www/reader.market/logs/combined.log

# Follow logs in real-time
tail -f /var/www/reader.market/logs/err.log
```

### Via PostgreSQL Logs
```bash
# View PostgreSQL error log
sudo tail -f /var/log/postgresql/postgresql-*.log
```

## Verification Steps

After applying the fix, verify everything is working:

### 1. Check Constraint Exists
```bash
node check_server_constraint.cjs
```
Expected output: ✅ CONSTRAINT EXISTS!

### 2. Test Endpoint
```bash
# Get an auth token by logging in first
# Then test the endpoint

curl -X POST https://reader.market/api/books/{BOOK_ID}/track-view \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"viewType": "card_view"}'
```
Expected response: `{"success": true}`

### 3. Check Database Records
Connect to PostgreSQL and verify records are being created/updated:
```sql
SELECT * FROM book_view_statistics 
WHERE book_id = 'YOUR_BOOK_ID'
ORDER BY updated_at DESC;
```

### 4. Monitor Application Logs
```bash
pm2 logs ollama-reader --lines 50
```
Should show successful track-view operations without errors.

## Troubleshooting

### Issue: Migration Script Can't Connect to Database

**Symptoms:**
- Error: "Connection failed"
- Error: "ECONNREFUSED"

**Solutions:**
1. Check DATABASE_URL in server's `.env` file
2. Verify PostgreSQL is running: `sudo systemctl status postgresql`
3. Check database credentials are correct
4. Ensure database firewall rules allow connection

### Issue: Permission Denied Error

**Symptoms:**
- Error: "permission denied for table"
- Error: "must be owner of table"

**Solutions:**
1. Connect as database owner (usually `booksuser`)
2. Grant necessary permissions:
   ```sql
   GRANT ALL PRIVILEGES ON TABLE book_view_statistics TO booksuser;
   ```

### Issue: Constraint Creation Fails

**Symptoms:**
- Error: "duplicate key value violates unique constraint"
- Migration fails during constraint addition

**Solutions:**
1. Run duplicate check: `node check_server_duplicates.cjs`
2. The migration SQL handles duplicates automatically
3. If manual execution, ensure duplicate cleanup runs first

### Issue: Endpoint Still Fails After Migration

**Possible causes:**
1. Application not restarted: `pm2 restart ollama-reader`
2. Wrong database connection: Verify DATABASE_URL in application
3. Authentication issue: Check token is valid
4. Application code issue: Check PM2 logs for other errors

## Prevention for Future Deployments

### 1. Pre-Deployment Checklist
- [ ] Review all new migration files
- [ ] Test migrations on staging environment
- [ ] Document any manual steps required
- [ ] Verify migration tracking is up to date

### 2. Deployment Process Enhancement
Add to deployment script:
```bash
# Check for pending migrations
echo "Checking for pending migrations..."
node check_server_migrations.cjs

# Apply migrations
echo "Applying migrations..."
npx drizzle-kit push

# Verify critical constraints
echo "Verifying constraints..."
node check_server_constraint.cjs
```

### 3. Monitoring Setup
- Set up alerts for endpoint errors
- Monitor migration status across environments
- Regular schema comparison between dev and prod

## Files Created for This Fix

The following utility scripts have been created in the project root:

1. **check_server_constraint.cjs** - Check if constraint exists
2. **check_server_migrations.cjs** - Check migration status
3. **check_server_duplicates.cjs** - Check for duplicate records
4. **apply_server_migration.cjs** - Apply migration 0007 safely
5. **diagnose_server_track_view.cjs** - Comprehensive diagnostic

All scripts support PROD_DATABASE_URL environment variable for production database access.

## Environment Variable Setup

To use these scripts with production database, set up environment variable:

**On Windows (PowerShell):**
```powershell
$env:PROD_DATABASE_URL = "postgresql://user:password@host:5432/database"
node check_server_constraint.cjs
```

**On Linux/Mac:**
```bash
export PROD_DATABASE_URL="postgresql://user:password@host:5432/database"
node check_server_constraint.cjs
```

**Or add to .env file:**
```
PROD_DATABASE_URL=postgresql://user:password@host:5432/database
```

## Support Contact

If issues persist after following this guide:

1. Capture full diagnostic output:
   ```bash
   node diagnose_server_track_view.cjs > diagnostic-report.txt
   ```

2. Capture application logs:
   ```bash
   pm2 logs ollama-reader --lines 500 > app-logs.txt
   ```

3. Review both files for additional error details

## Quick Reference

| Task | Command |
|------|---------|
| Diagnose issue | `node diagnose_server_track_view.cjs` |
| Apply fix | `node apply_server_migration.cjs` |
| Restart app | `pm2 restart ollama-reader` |
| View logs | `pm2 logs ollama-reader --lines 100` |
| Test endpoint | `curl -X POST https://reader.market/api/books/{id}/track-view ...` |
| Check constraint | `node check_server_constraint.cjs` |

---

**Last Updated:** 2026-01-07
**Related Migration:** 0007_add_unique_constraint_book_view_statistics.sql
**Affected Endpoint:** POST /api/books/:id/track-view
# Server Track-View Endpoint Fix Guide

## Problem Overview

The book view tracking endpoint is failing on the production server at https://reader.market:

```
POST https://reader.market/api/books/aa4a9ca1-9a21-4126-9a7a-39b17ff186bc/track-view
Response: {"error":"Failed to track book view"}
```

**Status**: Works locally but fails on production server.

## Root Cause

The database migration `0007_add_unique_constraint_book_view_statistics.sql` has not been applied to the production database. This migration adds a required unique constraint on the `book_view_statistics` table that enables PostgreSQL's upsert operation (INSERT ... ON CONFLICT DO UPDATE).

Without this constraint, the database cannot execute the upsert operation, causing the endpoint to fail.

## Step-by-Step Fix Guide

### Option 1: Quick Automated Fix (Recommended)

**Prerequisites:**
- SSH access to production server
- Database credentials configured in server's `.env` file

**Steps:**

1. **Connect to production server:**
   ```bash
   ssh user@reader.market
   ```

2. **Navigate to application directory:**
   ```bash
   cd /var/www/reader.market
   ```

3. **Run comprehensive diagnostic:**
   ```bash
   node diagnose_server_track_view.cjs
   ```
   
   This will show you exactly what's wrong.

4. **Apply the migration:**
   ```bash
   node apply_server_migration.cjs
   ```
   
   This script will:
   - Check if constraint already exists
   - Consolidate any duplicate records automatically
   - Add the unique constraint
   - Update migration tracking
   - Verify successful application

5. **Restart the application:**
   ```bash
   pm2 restart ollama-reader
   ```

6. **Verify the fix:**
   ```bash
   # Test the endpoint
   curl -X POST https://reader.market/api/books/{book-id}/track-view \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"viewType": "card_view"}'
   
   # Expected response:
   # {"success": true}
   ```

### Option 2: Manual Fix via Drizzle Kit

If you have Drizzle Kit configured on the server:

1. **Connect to server and navigate to project:**
   ```bash
   ssh user@reader.market
   cd /var/www/reader.market
   ```

2. **Run Drizzle push:**
   ```bash
   npx drizzle-kit push
   ```
   
   This will detect schema differences and apply missing migrations.

3. **Restart application:**
   ```bash
   pm2 restart ollama-reader
   ```

### Option 3: Manual SQL Execution

If automated scripts are unavailable:

1. **Connect to PostgreSQL:**
   ```bash
   psql -h localhost -U booksuser -d booksdb
   ```

2. **Execute migration SQL:**
   ```sql
   -- Consolidate duplicates
   WITH duplicates AS (
     SELECT book_id, view_type, COUNT(*) as dup_count
     FROM book_view_statistics
     GROUP BY book_id, view_type
     HAVING COUNT(*) > 1
   ),
   consolidated AS (
     SELECT 
       bvs.book_id,
       bvs.view_type,
       SUM(bvs.view_count) as total_view_count,
       MAX(bvs.last_viewed_at) as latest_viewed_at,
       MIN(bvs.created_at) as earliest_created_at,
       MAX(bvs.updated_at) as latest_updated_at,
       MIN(bvs.id) as keep_id
     FROM book_view_statistics bvs
     INNER JOIN duplicates d ON bvs.book_id = d.book_id AND bvs.view_type = d.view_type
     GROUP BY bvs.book_id, bvs.view_type
   )
   UPDATE book_view_statistics bvs
   SET 
     view_count = c.total_view_count,
     last_viewed_at = c.latest_viewed_at,
     updated_at = c.latest_updated_at
   FROM consolidated c
   WHERE bvs.id = c.keep_id;

   -- Delete duplicates
   DELETE FROM book_view_statistics bvs
   USING (
     SELECT book_id, view_type, MIN(id) as keep_id
     FROM book_view_statistics
     GROUP BY book_id, view_type
   ) keeper
   WHERE bvs.book_id = keeper.book_id 
     AND bvs.view_type = keeper.view_type 
     AND bvs.id != keeper.keep_id;

   -- Add unique constraint
   ALTER TABLE "book_view_statistics" 
   ADD CONSTRAINT "book_view_statistics_book_id_view_type_unique" 
   UNIQUE ("book_id", "view_type");
   ```

3. **Update migration tracking:**
   ```sql
   INSERT INTO _drizzle_migrations (idx, hash, created_at)
   SELECT 
     COALESCE(MAX(idx), 0) + 1,
     '0007_add_unique_constraint_book_view_statistics',
     EXTRACT(EPOCH FROM NOW()) * 1000
   FROM _drizzle_migrations;
   ```

4. **Restart application:**
   ```bash
   pm2 restart ollama-reader
   ```

## Diagnostic Tools

Several diagnostic scripts are available to help identify and fix the issue:

### 1. Check Constraint Status
```bash
node check_server_constraint.cjs
```
Shows if the required unique constraint exists.

### 2. Check Migration Status
```bash
node check_server_migrations.cjs
```
Lists all applied migrations and identifies missing ones.

### 3. Check for Duplicates
```bash
node check_server_duplicates.cjs
```
Identifies duplicate records that could prevent constraint creation.

### 4. Comprehensive Diagnostic
```bash
node diagnose_server_track_view.cjs
```
Runs all checks and provides a complete diagnostic report.

## Viewing Server Logs

To see the actual error details from the server:

### Via PM2 Logs
```bash
# Real-time logs (last 100 lines)
pm2 logs ollama-reader --lines 100

# Error logs only
pm2 logs ollama-reader --err

# Save logs to file
pm2 logs ollama-reader --lines 500 > track-view-error.log
```

### Via Log Files
```bash
# Error log
cat /var/www/reader.market/logs/err.log

# Combined log
cat /var/www/reader.market/logs/combined.log

# Follow logs in real-time
tail -f /var/www/reader.market/logs/err.log
```

### Via PostgreSQL Logs
```bash
# View PostgreSQL error log
sudo tail -f /var/log/postgresql/postgresql-*.log
```

## Verification Steps

After applying the fix, verify everything is working:

### 1. Check Constraint Exists
```bash
node check_server_constraint.cjs
```
Expected output: ✅ CONSTRAINT EXISTS!

### 2. Test Endpoint
```bash
# Get an auth token by logging in first
# Then test the endpoint

curl -X POST https://reader.market/api/books/{BOOK_ID}/track-view \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"viewType": "card_view"}'
```
Expected response: `{"success": true}`

### 3. Check Database Records
Connect to PostgreSQL and verify records are being created/updated:
```sql
SELECT * FROM book_view_statistics 
WHERE book_id = 'YOUR_BOOK_ID'
ORDER BY updated_at DESC;
```

### 4. Monitor Application Logs
```bash
pm2 logs ollama-reader --lines 50
```
Should show successful track-view operations without errors.

## Troubleshooting

### Issue: Migration Script Can't Connect to Database

**Symptoms:**
- Error: "Connection failed"
- Error: "ECONNREFUSED"

**Solutions:**
1. Check DATABASE_URL in server's `.env` file
2. Verify PostgreSQL is running: `sudo systemctl status postgresql`
3. Check database credentials are correct
4. Ensure database firewall rules allow connection

### Issue: Permission Denied Error

**Symptoms:**
- Error: "permission denied for table"
- Error: "must be owner of table"

**Solutions:**
1. Connect as database owner (usually `booksuser`)
2. Grant necessary permissions:
   ```sql
   GRANT ALL PRIVILEGES ON TABLE book_view_statistics TO booksuser;
   ```

### Issue: Constraint Creation Fails

**Symptoms:**
- Error: "duplicate key value violates unique constraint"
- Migration fails during constraint addition

**Solutions:**
1. Run duplicate check: `node check_server_duplicates.cjs`
2. The migration SQL handles duplicates automatically
3. If manual execution, ensure duplicate cleanup runs first

### Issue: Endpoint Still Fails After Migration

**Possible causes:**
1. Application not restarted: `pm2 restart ollama-reader`
2. Wrong database connection: Verify DATABASE_URL in application
3. Authentication issue: Check token is valid
4. Application code issue: Check PM2 logs for other errors

## Prevention for Future Deployments

### 1. Pre-Deployment Checklist
- [ ] Review all new migration files
- [ ] Test migrations on staging environment
- [ ] Document any manual steps required
- [ ] Verify migration tracking is up to date

### 2. Deployment Process Enhancement
Add to deployment script:
```bash
# Check for pending migrations
echo "Checking for pending migrations..."
node check_server_migrations.cjs

# Apply migrations
echo "Applying migrations..."
npx drizzle-kit push

# Verify critical constraints
echo "Verifying constraints..."
node check_server_constraint.cjs
```

### 3. Monitoring Setup
- Set up alerts for endpoint errors
- Monitor migration status across environments
- Regular schema comparison between dev and prod

## Files Created for This Fix

The following utility scripts have been created in the project root:

1. **check_server_constraint.cjs** - Check if constraint exists
2. **check_server_migrations.cjs** - Check migration status
3. **check_server_duplicates.cjs** - Check for duplicate records
4. **apply_server_migration.cjs** - Apply migration 0007 safely
5. **diagnose_server_track_view.cjs** - Comprehensive diagnostic

All scripts support PROD_DATABASE_URL environment variable for production database access.

## Environment Variable Setup

To use these scripts with production database, set up environment variable:

**On Windows (PowerShell):**
```powershell
$env:PROD_DATABASE_URL = "postgresql://user:password@host:5432/database"
node check_server_constraint.cjs
```

**On Linux/Mac:**
```bash
export PROD_DATABASE_URL="postgresql://user:password@host:5432/database"
node check_server_constraint.cjs
```

**Or add to .env file:**
```
PROD_DATABASE_URL=postgresql://user:password@host:5432/database
```

## Support Contact

If issues persist after following this guide:

1. Capture full diagnostic output:
   ```bash
   node diagnose_server_track_view.cjs > diagnostic-report.txt
   ```

2. Capture application logs:
   ```bash
   pm2 logs ollama-reader --lines 500 > app-logs.txt
   ```

3. Review both files for additional error details

## Quick Reference

| Task | Command |
|------|---------|
| Diagnose issue | `node diagnose_server_track_view.cjs` |
| Apply fix | `node apply_server_migration.cjs` |
| Restart app | `pm2 restart ollama-reader` |
| View logs | `pm2 logs ollama-reader --lines 100` |
| Test endpoint | `curl -X POST https://reader.market/api/books/{id}/track-view ...` |
| Check constraint | `node check_server_constraint.cjs` |

---

**Last Updated:** 2026-01-07
**Related Migration:** 0007_add_unique_constraint_book_view_statistics.sql
**Affected Endpoint:** POST /api/books/:id/track-view
