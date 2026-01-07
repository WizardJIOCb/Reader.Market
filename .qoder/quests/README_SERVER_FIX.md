# Server Track-View Fix - Complete Package

## Overview
This package provides tools to diagnose and fix the failing track-view endpoint on your production server (reader.market).

## Problem Statement
- **Endpoint**: POST /api/books/:id/track-view
- **Server Response**: `{"error":"Failed to track book view"}`
- **Local Status**: Works perfectly
- **Root Cause**: Missing database migration on production

## Package Contents

### 📋 Documentation Files

1. **QUICK_FIX_TRACK_VIEW.md** - Start here! Quick reference for immediate fix
2. **SERVER_TRACK_VIEW_FIX.md** - Complete detailed guide (407 lines)
3. **SERVER_FIX_IMPLEMENTATION_SUMMARY.md** - Technical summary
4. **.qoder/quests/server-post-error-1767805779.md** - Design document with analysis

### 🔧 Diagnostic Scripts

1. **diagnose_server_track_view.cjs** - Comprehensive diagnostic (recommended)
2. **check_server_constraint.cjs** - Check constraint status
3. **check_server_migrations.cjs** - Check migration status
4. **check_server_duplicates.cjs** - Check for duplicate records

### 🚀 Fix Script

1. **apply_server_migration.cjs** - Applies migration 0007 safely

## Quick Start

### For Immediate Fix (On Server)
```bash
ssh user@reader.market
cd /var/www/reader.market
node diagnose_server_track_view.cjs
node apply_server_migration.cjs
pm2 restart ollama-reader
```

### For Diagnosis (From Local)
```powershell
# Set production DB URL
$env:PROD_DATABASE_URL = "postgresql://user:pass@reader.market:5432/booksdb"

# Run diagnostic
node diagnose_server_track_view.cjs
```

## What Gets Fixed

**Before Fix:**
- ❌ POST /api/books/:id/track-view returns error 500
- ❌ Book view statistics not tracked
- ❌ Missing unique constraint on database

**After Fix:**
- ✅ POST /api/books/:id/track-view returns `{"success": true}`
- ✅ View statistics tracked accurately
- ✅ Unique constraint exists: `book_view_statistics_book_id_view_type_unique`

## Technical Details

### Migration Applied
**File**: `migrations/0007_add_unique_constraint_book_view_statistics.sql`

**Actions**:
1. Consolidates duplicate records (if any)
2. Deletes duplicate entries
3. Adds UNIQUE constraint on (book_id, view_type)
4. Updates migration tracking

### Why It's Needed
The application uses PostgreSQL's upsert operation which requires a unique constraint:
```typescript
.onConflictDoUpdate({
  target: [bookViewStatistics.bookId, bookViewStatistics.viewType],
  // ... update logic
})
```

Without the constraint, PostgreSQL throws an error and the endpoint fails.

## Safety Features

All scripts include:
- ✅ Database connection validation
- ✅ Existing constraint detection
- ✅ Automatic duplicate handling
- ✅ Idempotent execution (safe to run multiple times)
- ✅ Detailed error reporting
- ✅ Verification steps

## Recommended Workflow

1. **Understand the Problem**
   - Read: `QUICK_FIX_TRACK_VIEW.md`

2. **Run Diagnostic**
   ```bash
   node diagnose_server_track_view.cjs
   ```

3. **Review Report**
   - Identifies specific issues
   - Provides recommendations

4. **Apply Fix**
   ```bash
   node apply_server_migration.cjs
   ```

5. **Restart Application**
   ```bash
   pm2 restart ollama-reader
   ```

6. **Verify Success**
   ```bash
   node check_server_constraint.cjs
   ```

7. **Test Endpoint**
   ```bash
   curl -X POST https://reader.market/api/books/{id}/track-view \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"viewType": "card_view"}'
   ```

## Troubleshooting

### Common Issues

**"Cannot redeclare block-scoped variable"**
- These are TypeScript linter warnings for .cjs files
- They don't affect runtime execution
- Each script runs independently without conflicts

**"Connection failed"**
- Verify DATABASE_URL or PROD_DATABASE_URL
- Check PostgreSQL is running
- Verify firewall allows connections

**"Permission denied"**
- Connect as database owner (booksuser)
- Grant ALTER TABLE permissions if needed

**"Endpoint still fails after migration"**
- Restart application: `pm2 restart ollama-reader`
- Check logs: `pm2 logs ollama-reader`
- Verify constraint: `node check_server_constraint.cjs`

### Getting Help

1. Run comprehensive diagnostic:
   ```bash
   node diagnose_server_track_view.cjs > diagnostic-report.txt
   ```

2. Capture application logs:
   ```bash
   pm2 logs ollama-reader --lines 500 > app-logs.txt
   ```

3. Review SERVER_TRACK_VIEW_FIX.md troubleshooting section

## File Locations

All scripts are in project root:
```
c:\Projects\reader.market\
├── diagnose_server_track_view.cjs
├── check_server_constraint.cjs
├── check_server_migrations.cjs
├── check_server_duplicates.cjs
├── apply_server_migration.cjs
├── QUICK_FIX_TRACK_VIEW.md
├── SERVER_TRACK_VIEW_FIX.md
└── SERVER_FIX_IMPLEMENTATION_SUMMARY.md
```

## Environment Variables

Scripts support `PROD_DATABASE_URL` for production database access:

**Windows PowerShell:**
```powershell
$env:PROD_DATABASE_URL = "postgresql://booksuser:pass@reader.market:5432/booksdb"
```

**Linux/Mac:**
```bash
export PROD_DATABASE_URL="postgresql://booksuser:pass@reader.market:5432/booksdb"
```

**Or add to .env:**
```
PROD_DATABASE_URL=postgresql://booksuser:pass@reader.market:5432/booksdb
```

## Success Criteria

✅ Constraint `book_view_statistics_book_id_view_type_unique` exists
✅ Endpoint returns `{"success": true}` with status 200
✅ Database records are created/updated correctly
✅ No errors in PM2 logs
✅ No duplicate records in book_view_statistics table

## Prevention for Future

To avoid similar issues in future deployments:

1. **Pre-deployment**: Check migration status on server
2. **During deployment**: Apply pending migrations
3. **Post-deployment**: Verify critical constraints exist
4. **Monitoring**: Set up alerts for endpoint errors

See "Prevention Measures" section in SERVER_TRACK_VIEW_FIX.md for details.

## Rollback Plan

If needed, remove the constraint:
```sql
ALTER TABLE book_view_statistics 
DROP CONSTRAINT book_view_statistics_book_id_view_type_unique;
```

Note: This returns the endpoint to error state.

## Statistics

- **Scripts Created**: 5 diagnostic/fix scripts
- **Documentation**: 4 comprehensive guides
- **Total Lines**: ~1,500 lines of code and documentation
- **Supported Methods**: 3 (automated, Drizzle Kit, manual SQL)
- **Safety Checks**: Idempotent, duplicate handling, verification

## Credits

**Created**: 2026-01-07
**Issue**: Server track-view endpoint failure
**Solution**: Database migration 0007 application
**Status**: Ready for deployment

---

**Next Step**: Read QUICK_FIX_TRACK_VIEW.md and run the diagnostic script!
# Server Track-View Fix - Complete Package

## Overview
This package provides tools to diagnose and fix the failing track-view endpoint on your production server (reader.market).

## Problem Statement
- **Endpoint**: POST /api/books/:id/track-view
- **Server Response**: `{"error":"Failed to track book view"}`
- **Local Status**: Works perfectly
- **Root Cause**: Missing database migration on production

## Package Contents

### 📋 Documentation Files

1. **QUICK_FIX_TRACK_VIEW.md** - Start here! Quick reference for immediate fix
2. **SERVER_TRACK_VIEW_FIX.md** - Complete detailed guide (407 lines)
3. **SERVER_FIX_IMPLEMENTATION_SUMMARY.md** - Technical summary
4. **.qoder/quests/server-post-error-1767805779.md** - Design document with analysis

### 🔧 Diagnostic Scripts

1. **diagnose_server_track_view.cjs** - Comprehensive diagnostic (recommended)
2. **check_server_constraint.cjs** - Check constraint status
3. **check_server_migrations.cjs** - Check migration status
4. **check_server_duplicates.cjs** - Check for duplicate records

### 🚀 Fix Script

1. **apply_server_migration.cjs** - Applies migration 0007 safely

## Quick Start

### For Immediate Fix (On Server)
```bash
ssh user@reader.market
cd /var/www/reader.market
node diagnose_server_track_view.cjs
node apply_server_migration.cjs
pm2 restart ollama-reader
```

### For Diagnosis (From Local)
```powershell
# Set production DB URL
$env:PROD_DATABASE_URL = "postgresql://user:pass@reader.market:5432/booksdb"

# Run diagnostic
node diagnose_server_track_view.cjs
```

## What Gets Fixed

**Before Fix:**
- ❌ POST /api/books/:id/track-view returns error 500
- ❌ Book view statistics not tracked
- ❌ Missing unique constraint on database

**After Fix:**
- ✅ POST /api/books/:id/track-view returns `{"success": true}`
- ✅ View statistics tracked accurately
- ✅ Unique constraint exists: `book_view_statistics_book_id_view_type_unique`

## Technical Details

### Migration Applied
**File**: `migrations/0007_add_unique_constraint_book_view_statistics.sql`

**Actions**:
1. Consolidates duplicate records (if any)
2. Deletes duplicate entries
3. Adds UNIQUE constraint on (book_id, view_type)
4. Updates migration tracking

### Why It's Needed
The application uses PostgreSQL's upsert operation which requires a unique constraint:
```typescript
.onConflictDoUpdate({
  target: [bookViewStatistics.bookId, bookViewStatistics.viewType],
  // ... update logic
})
```

Without the constraint, PostgreSQL throws an error and the endpoint fails.

## Safety Features

All scripts include:
- ✅ Database connection validation
- ✅ Existing constraint detection
- ✅ Automatic duplicate handling
- ✅ Idempotent execution (safe to run multiple times)
- ✅ Detailed error reporting
- ✅ Verification steps

## Recommended Workflow

1. **Understand the Problem**
   - Read: `QUICK_FIX_TRACK_VIEW.md`

2. **Run Diagnostic**
   ```bash
   node diagnose_server_track_view.cjs
   ```

3. **Review Report**
   - Identifies specific issues
   - Provides recommendations

4. **Apply Fix**
   ```bash
   node apply_server_migration.cjs
   ```

5. **Restart Application**
   ```bash
   pm2 restart ollama-reader
   ```

6. **Verify Success**
   ```bash
   node check_server_constraint.cjs
   ```

7. **Test Endpoint**
   ```bash
   curl -X POST https://reader.market/api/books/{id}/track-view \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"viewType": "card_view"}'
   ```

## Troubleshooting

### Common Issues

**"Cannot redeclare block-scoped variable"**
- These are TypeScript linter warnings for .cjs files
- They don't affect runtime execution
- Each script runs independently without conflicts

**"Connection failed"**
- Verify DATABASE_URL or PROD_DATABASE_URL
- Check PostgreSQL is running
- Verify firewall allows connections

**"Permission denied"**
- Connect as database owner (booksuser)
- Grant ALTER TABLE permissions if needed

**"Endpoint still fails after migration"**
- Restart application: `pm2 restart ollama-reader`
- Check logs: `pm2 logs ollama-reader`
- Verify constraint: `node check_server_constraint.cjs`

### Getting Help

1. Run comprehensive diagnostic:
   ```bash
   node diagnose_server_track_view.cjs > diagnostic-report.txt
   ```

2. Capture application logs:
   ```bash
   pm2 logs ollama-reader --lines 500 > app-logs.txt
   ```

3. Review SERVER_TRACK_VIEW_FIX.md troubleshooting section

## File Locations

All scripts are in project root:
```
c:\Projects\reader.market\
├── diagnose_server_track_view.cjs
├── check_server_constraint.cjs
├── check_server_migrations.cjs
├── check_server_duplicates.cjs
├── apply_server_migration.cjs
├── QUICK_FIX_TRACK_VIEW.md
├── SERVER_TRACK_VIEW_FIX.md
└── SERVER_FIX_IMPLEMENTATION_SUMMARY.md
```

## Environment Variables

Scripts support `PROD_DATABASE_URL` for production database access:

**Windows PowerShell:**
```powershell
$env:PROD_DATABASE_URL = "postgresql://booksuser:pass@reader.market:5432/booksdb"
```

**Linux/Mac:**
```bash
export PROD_DATABASE_URL="postgresql://booksuser:pass@reader.market:5432/booksdb"
```

**Or add to .env:**
```
PROD_DATABASE_URL=postgresql://booksuser:pass@reader.market:5432/booksdb
```

## Success Criteria

✅ Constraint `book_view_statistics_book_id_view_type_unique` exists
✅ Endpoint returns `{"success": true}` with status 200
✅ Database records are created/updated correctly
✅ No errors in PM2 logs
✅ No duplicate records in book_view_statistics table

## Prevention for Future

To avoid similar issues in future deployments:

1. **Pre-deployment**: Check migration status on server
2. **During deployment**: Apply pending migrations
3. **Post-deployment**: Verify critical constraints exist
4. **Monitoring**: Set up alerts for endpoint errors

See "Prevention Measures" section in SERVER_TRACK_VIEW_FIX.md for details.

## Rollback Plan

If needed, remove the constraint:
```sql
ALTER TABLE book_view_statistics 
DROP CONSTRAINT book_view_statistics_book_id_view_type_unique;
```

Note: This returns the endpoint to error state.

## Statistics

- **Scripts Created**: 5 diagnostic/fix scripts
- **Documentation**: 4 comprehensive guides
- **Total Lines**: ~1,500 lines of code and documentation
- **Supported Methods**: 3 (automated, Drizzle Kit, manual SQL)
- **Safety Checks**: Idempotent, duplicate handling, verification

## Credits

**Created**: 2026-01-07
**Issue**: Server track-view endpoint failure
**Solution**: Database migration 0007 application
**Status**: Ready for deployment

---

**Next Step**: Read QUICK_FIX_TRACK_VIEW.md and run the diagnostic script!
