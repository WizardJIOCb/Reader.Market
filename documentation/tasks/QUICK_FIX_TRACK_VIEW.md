# Quick Fix - Server Track-View Endpoint Error

## Problem
```
POST https://reader.market/api/books/{id}/track-view
Response: {"error":"Failed to track book view"}
```

## Root Cause
Missing database constraint on production server.

## Quick Fix (3 commands)

SSH into your server and run:

```bash
cd /var/www/reader.market
node diagnose_server_track_view.cjs    # See what's wrong
node apply_server_migration.cjs         # Fix it
pm2 restart ollama-reader               # Restart app
```

## What Each Script Does

### 1. Diagnostic Scripts
- `diagnose_server_track_view.cjs` - Complete diagnostic report
- `check_server_constraint.cjs` - Check if constraint exists
- `check_server_migrations.cjs` - Check migration status
- `check_server_duplicates.cjs` - Check for duplicate records

### 2. Fix Script
- `apply_server_migration.cjs` - Apply migration 0007 safely

### 3. Verification
```bash
# After fix, verify:
node check_server_constraint.cjs

# Test endpoint:
curl -X POST https://reader.market/api/books/{book-id}/track-view \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"viewType": "card_view"}'

# Expected: {"success": true}
```

## View Logs
```bash
pm2 logs ollama-reader --lines 100     # All logs
pm2 logs ollama-reader --err           # Errors only
cat logs/err.log                        # Error file
```

## If You Need to Connect from Local Machine

Set production database URL:
```powershell
# Windows PowerShell
$env:PROD_DATABASE_URL = "postgresql://user:pass@host:5432/db"
node diagnose_server_track_view.cjs
```

## Complete Documentation
See `SERVER_TRACK_VIEW_FIX.md` for detailed guide with troubleshooting.

## Safe to Run
- ✅ Checks before applying
- ✅ Handles duplicates automatically
- ✅ Won't run twice if already applied
- ✅ Includes rollback instructions

---
**Created**: 2026-01-07 | **Migration**: 0007 | **Endpoint**: POST /api/books/:id/track-view
