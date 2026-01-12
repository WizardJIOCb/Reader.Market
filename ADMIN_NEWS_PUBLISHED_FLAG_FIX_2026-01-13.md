# Admin News Published Flag Update - Fix Implemented
## Date: 2026-01-13

## Problem Fixed
Fixed the `TypeError: e.toISOString is not a function` error that occurred when updating the `published` flag for news articles in the admin panel.

## Root Cause
The error occurred because:
1. Database query results return ISO string timestamps, not Date objects
2. The code was directly assigning `existingNews.publishedAt` (a string) to the update object
3. Drizzle ORM expects Date objects for timestamp columns
4. When Drizzle tried to call `.toISOString()` on the string, it crashed with `TypeError`

## Solution Implemented
Updated `server/routes.ts` (lines 1190-1211) to properly handle timestamp type conversion:

**Changed from:**
```typescript
publishedAt: published ? new Date() : existingNews.publishedAt
```

**Changed to:**
```typescript
publishedAt: (() => {
  const isPublishing = published !== undefined ? published : existingNews.published;
  
  if (isPublishing) {
    // If transitioning to published, set new timestamp
    // If already published, preserve existing timestamp (convert string to Date)
    if (published === true && !existingNews.published) {
      return new Date(); // First time publishing
    } else if (existingNews.publishedAt) {
      return new Date(existingNews.publishedAt); // Convert string to Date
    } else {
      return new Date(); // Fallback if somehow publishedAt is missing
    }
  } else {
    return null; // Unpublished state
  }
})()
```

## Changes Made
1. ✅ Fixed timestamp type conversion in news update endpoint
2. ✅ Built the application successfully (`npm run build`)
3. ✅ Generated new `dist/index.cjs` with the fix

## Deployment Required
⚠️ **IMPORTANT:** The server needs to be restarted on the production server to apply the fix.

### On Production Server (reader.market):
```bash
# Connect to the production server via SSH
ssh user@reader.market

# Navigate to the project directory
cd /var/www/reader.market

# Pull the latest changes (if using git)
git pull

# Or manually copy the new dist/index.cjs file to the server

# Restart PM2 process
pm2 restart ollama-reader

# Verify the process is running
pm2 status

# Check logs to ensure no errors
pm2 logs ollama-reader --lines 50
```

## Testing Instructions

After deployment, test the following scenarios:

### 1. Toggle Published Flag from False to True
- Go to admin panel → News Management
- Find an unpublished news article
- Change published toggle to ON
- Click Save/Update
- ✅ Expected: Success (200 OK), publishedAt timestamp is set
- ✅ Expected: News appears in public feed

### 2. Toggle Published Flag from True to False
- Go to admin panel → News Management
- Find a published news article
- Change published toggle to OFF
- Click Save/Update
- ✅ Expected: Success (200 OK), publishedAt is cleared
- ✅ Expected: News disappears from public feed

### 3. Update Already Published News
- Go to admin panel → News Management
- Find a published news article
- Edit title or content (keep published ON)
- Click Save/Update
- ✅ Expected: Success (200 OK), publishedAt timestamp is preserved
- ✅ Expected: No duplicate WebSocket broadcasts

### 4. Partial Update with Only Published Flag
- Use browser DevTools or API client
- Send PUT request with only `{"published": true}`
- ✅ Expected: Success (200 OK)
- ✅ Expected: Title and content remain unchanged

## Verification

After restarting the server, verify the fix by checking PM2 logs:

```bash
# On production server
pm2 logs ollama-reader --lines 20

# Try to update a news article in the admin panel
# You should NOT see any errors like:
# ❌ "TypeError: e.toISOString is not a function"

# You should see:
# ✅ "Update news endpoint called"
# ✅ No errors
```

## Error Before Fix
```
0|ollama-reader  | 2026-01-12T23:52:57: Error updating news: TypeError: e.toISOString is not a function
0|ollama-reader  | 2026-01-12T23:52:57:     at na.mapToDriverValue (/var/www/reader.market/dist/index.cjs:68:108123)
```

## Expected Behavior After Fix
```
0|ollama-reader  | Update news endpoint called
0|ollama-reader  | News updated successfully
```

## Related Files Modified
- `server/routes.ts` (line 1190-1211) - Fixed publishedAt timestamp handling

## Related Design Document
- `.qoder/quests/admin-news-flag-update.md`

## Technical Details

### Type Conversion Logic
The fix ensures that:
1. All timestamp values passed to Drizzle ORM are Date objects or null
2. ISO string timestamps from database queries are converted using `new Date(isoString)`
3. Null values are properly handled for unpublished articles
4. Original publish timestamps are preserved when updating already-published articles

### State Transitions
| Previous State | New State | publishedAt Behavior |
|---------------|-----------|---------------------|
| unpublished (false) | published (true) | Set to new Date() |
| published (true) | published (true) | Convert existing string to Date |
| published (true) | unpublished (false) | Set to null |
| unpublished (false) | unpublished (false) | Keep as null |

## Status
✅ **Code Fixed and Built**
⏳ **Awaiting Production Server Restart**

## Next Steps
1. Deploy the new `dist/index.cjs` to production server
2. Restart PM2 process: `pm2 restart ollama-reader`
3. Test the news published flag update functionality
4. Verify no errors in PM2 logs
5. Confirm WebSocket broadcasts work correctly for newly published news
