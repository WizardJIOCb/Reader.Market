# Server POST Error - Track View Endpoint Failure

## Problem Statement

The book view tracking endpoint is failing on the production server at https://reader.market but working correctly in the local development environment.

**Failing Endpoint:**
- POST https://reader.market/api/books/aa4a9ca1-9a21-4126-9a7a-39b17ff186bc/track-view
- Response: `{"error":"Failed to track book view"}`

**Environment Discrepancy:**
- Local environment: Working correctly
- Production server: Returning error 500

## Root Cause Analysis

Based on the codebase analysis and historical migration records, the most likely root cause is that the database migration `0007_add_unique_constraint_book_view_statistics.sql` has not been applied to the production database.

### Technical Background

The track-view endpoint uses PostgreSQL's upsert operation (INSERT ... ON CONFLICT DO UPDATE) which requires a unique constraint on the conflict target columns. The code at `server/storage.ts` line 2231-2246 performs:

```
INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
VALUES (?, ?, 1, NOW())
ON CONFLICT (book_id, view_type) DO UPDATE SET
  view_count = view_count + 1,
  last_viewed_at = NOW()
```

**Critical Requirement:** This upsert operation requires the unique constraint `book_view_statistics_book_id_view_type_unique` on columns `(book_id, view_type)`.

**Why It Works Locally:**
- Migration 0007 has been applied to local PostgreSQL database
- The unique constraint exists, allowing upsert operations to succeed

**Why It Fails on Server:**
- Migration 0007 has likely not been applied to production database
- Without the unique constraint, PostgreSQL cannot execute the ON CONFLICT clause
- The database throws an error, which the application catches and returns as "Failed to track book view"

## Diagnostic Strategy

### Phase 1: Access Server Logs

To view the actual database error on the server, examine the PM2 application logs which will contain the detailed error stack trace.

**Method 1: PM2 Logs (Recommended)**

Connect to the server via SSH and view logs:
- Real-time logs: View the most recent 100 lines
- Error logs only: Check the error-specific log file at `./logs/err.log`
- Combined logs: Review both stdout and stderr from `./logs/combined.log`

**Method 2: Application Log Files**

Access log files directly from the application directory at `/var/www/reader.market/logs/`:
- err.log: Error output only
- out.log: Standard output only  
- combined.log: All output

**Method 3: Database Query Logs**

If needed, check PostgreSQL logs to see the actual SQL error from database perspective. These are typically located at `/var/log/postgresql/postgresql-*.log` on Ubuntu servers.

### Phase 2: Verify Database Schema State

Check if the unique constraint exists on the production database by connecting to PostgreSQL and querying the information schema.

**Query to Check Constraint:**

Connect to the production database and execute:

```
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'book_view_statistics'
AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
```

**Expected Results:**
- If constraint exists: One row with constraint_name and type 'UNIQUE'
- If constraint missing: Zero rows (confirms the root cause)

**Alternative Check via Script:**

Use the existing verification script by uploading `verify_constraint.cjs` to the server and executing it in the application directory.

### Phase 3: Check Migration Status

Verify which migrations have been applied to the production database by querying the migration tracking table.

**Query Migration History:**

```
SELECT idx, tag, timestamp 
FROM _drizzle_migrations 
ORDER BY idx
```

**Expected Migration 0007:**
- Should contain entry with tag: '0007_add_unique_constraint_book_view_statistics'
- If missing: Migration has not been applied to production

### Phase 4: Check for Duplicate Records

Before applying the migration, verify if duplicate records exist in the production database that could cause the migration to fail.

**Query for Duplicates:**

```
SELECT book_id, view_type, COUNT(*) as duplicate_count
FROM book_view_statistics
GROUP BY book_id, view_type
HAVING COUNT(*) > 1
```

**Interpretation:**
- Zero rows: Safe to apply migration directly
- One or more rows: Duplicates exist and will be consolidated by migration

## Solution Implementation

### Solution 1: Apply Missing Migration (Primary Approach)

Apply migration 0007 to add the required unique constraint to the production database.

**Prerequisites:**
1. SSH access to production server
2. Database connection credentials
3. Application downtime window (optional but recommended)

**Execution Steps:**

**Step 1: Connect to Server**
- Establish SSH connection to the production server
- Navigate to application directory at `/var/www/reader.market`

**Step 2: Backup Database**
- Execute manual backup before applying schema changes
- Run the backup script: `./backup-db.sh`
- Verify backup file created in `/var/backups/reader.market/`

**Step 3: Apply Migration via Drizzle Kit**
- Execute: `npx drizzle-kit push`
- This command will:
  - Compare local schema definition with production database
  - Detect missing unique constraint
  - Generate and apply the constraint addition SQL
  - Update migration tracking table

**Step 4: Restart Application**
- Restart the PM2 process to ensure clean state
- Execute: `pm2 restart ollama-reader`
- Monitor logs during restart for any errors

**Step 5: Verify Migration**
- Check that constraint was created successfully
- Run the constraint verification query from Phase 2
- Expected result: Constraint exists with name `book_view_statistics_book_id_view_type_unique`

**Step 6: Test Endpoint**
- Execute test request to the track-view endpoint
- Use curl with authentication token:
  ```
  POST https://reader.market/api/books/{book-id}/track-view
  Headers: Authorization: Bearer {token}
  Body: {"viewType": "card_view"}
  ```
- Expected response: `{"success": true}`

### Solution 2: Manual SQL Application (Alternative)

If Drizzle Kit is unavailable or encounters issues, apply the migration SQL manually.

**Execution Steps:**

**Step 1: Transfer Migration File**
- Upload `migrations/0007_add_unique_constraint_book_view_statistics.sql` to server
- Use SCP or SFTP to transfer file to application directory

**Step 2: Connect to Database**
- Use psql command-line client
- Connect with database credentials from environment
- Execute: `psql -h localhost -U booksuser -d booksdb`

**Step 3: Execute Migration SQL**
- Run the migration file within psql session
- Execute: `\i migrations/0007_add_unique_constraint_book_view_statistics.sql`
- Monitor output for any errors during execution

**Step 4: Update Migration Tracking**
- Manually insert record into _drizzle_migrations table
- Insert new row with:
  - idx: Next sequential number after current highest
  - tag: '0007_add_unique_constraint_book_view_statistics'
  - timestamp: Current timestamp in milliseconds

**Step 5: Verify and Test**
- Follow Steps 5-6 from Solution 1 above
- Restart application and test endpoint functionality

### Solution 3: Use Existing Migration Script (Convenience Option)

Leverage the pre-built migration utility script for guided execution.

**Prerequisites:**
- Node.js installed on server
- PostgreSQL client libraries (pg package)
- Database connection string in environment

**Execution Steps:**

**Step 1: Verify Script Availability**
- Check if `apply_local_migration.cjs` exists in project root
- This script handles migration application with validation

**Step 2: Execute Script**
- Run: `node apply_local_migration.cjs`
- Script will:
  - Connect to database
  - Check for existing constraint
  - Apply migration if needed
  - Consolidate any duplicate records
  - Verify successful application

**Step 3: Review Output**
- Script provides detailed output of each step
- Confirms constraint creation and duplicate handling
- Reports final status with success or failure message

**Step 4: Restart and Test**
- Follow Steps 4-6 from Solution 1
- Restart application and verify endpoint works

## Post-Implementation Verification

### Verification Checklist

After applying the solution, perform comprehensive verification to ensure the issue is fully resolved:

1. **Constraint Existence**
   - Query information_schema confirms constraint exists
   - Constraint name matches: `book_view_statistics_book_id_view_type_unique`
   - Constraint type is UNIQUE on columns (book_id, view_type)

2. **No Duplicate Records**
   - Query for duplicates returns zero rows
   - Each (book_id, view_type) combination appears only once

3. **Endpoint Functionality**
   - POST request to track-view returns `{"success": true}`
   - Status code is 200 (not 500)
   - Database records are created/updated correctly

4. **View Count Accuracy**
   - First request creates new record with view_count = 1
   - Subsequent requests increment view_count properly
   - Both 'card_view' and 'reader_open' types work correctly

5. **Application Stability**
   - PM2 shows process running with uptime
   - No errors in PM2 logs related to track-view
   - Other API endpoints remain unaffected

### Testing Procedure

**Test Case 1: New Book View Tracking**
- Select a book that has no existing view statistics
- Send POST request with viewType: 'card_view'
- Expected: New record created with view_count = 1
- Verify in database: Record exists with correct values

**Test Case 2: Existing Book View Increment**
- Send second POST request to same book with same viewType
- Expected: View count increments to 2
- Verify in database: Same record updated, not duplicated

**Test Case 3: Different View Types**
- Send POST request with viewType: 'reader_open'
- Expected: New record created for this view type
- Verify in database: Two separate records exist (card_view and reader_open)

**Test Case 4: Concurrent Requests**
- Send multiple simultaneous requests to same book/viewType
- Expected: All requests succeed with status 200
- Verify in database: View count accurately reflects total requests

## Rollback Plan

If the migration causes unexpected issues, the constraint can be removed to restore the previous state.

### Rollback SQL

Execute the following SQL to remove the unique constraint:

```
ALTER TABLE book_view_statistics 
DROP CONSTRAINT book_view_statistics_book_id_view_type_unique
```

### Rollback Considerations

**Impact of Rollback:**
- Track-view endpoint will return to error state
- View statistics will not be tracked correctly
- No data loss occurs (existing records remain intact)

**When to Rollback:**
- Migration fails to apply due to data integrity issues
- Application experiences performance degradation
- Unexpected behavior occurs in related functionality

**After Rollback:**
- Investigate root cause of migration failure
- Address any data quality issues (duplicates, constraints)
- Re-plan migration with corrective measures

## Prevention Measures

To prevent similar issues in future deployments, implement these practices:

### Deployment Process Enhancement

1. **Migration Verification in Deployment Script**
   - Add automated check for pending migrations before deployment
   - Compare local schema state with production database state
   - Alert if schema drift is detected

2. **Pre-Deployment Checklist**
   - Review migration files added since last deployment
   - Test migrations on staging environment matching production
   - Document any special migration requirements or dependencies

3. **Post-Deployment Validation**
   - Automated smoke tests for critical endpoints
   - Schema verification queries in deployment script
   - Monitoring alerts for endpoint error rates

### Monitoring Improvements

1. **Database Schema Monitoring**
   - Periodic comparison of schema between environments
   - Alerts when constraints or indexes are missing
   - Dashboard showing migration status per environment

2. **Endpoint Health Checks**
   - Automated testing of critical endpoints post-deployment
   - Response time and error rate tracking
   - Immediate notification on elevated error rates

3. **Log Aggregation**
   - Centralized logging for easier error investigation
   - Structured logging with contextual information
   - Search and filter capabilities for debugging

## Additional Considerations

### Environment Parity

Maintain consistency between development and production environments:
- Use same PostgreSQL version across all environments
- Synchronize migration state regularly
- Document any environment-specific configurations

### Communication Protocol

When deployment issues occur:
1. Immediate notification to development team
2. Quick diagnostic check using standard queries
3. Decision point: rollback vs. fix forward
4. Post-incident review to improve process

### Documentation Updates

Keep deployment documentation current:
- Update migration checklist after each release
- Document any manual steps required
- Maintain runbook for common issues
