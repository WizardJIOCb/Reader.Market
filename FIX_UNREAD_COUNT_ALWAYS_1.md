# Fix: Unread Count Always Shows "1"

## Problem
The unread message badge shows "1" even when there are multiple unread messages.

## Root Cause
The backend server is running **old code** that doesn't include the updated `unreadCount` query in `server/storage.ts`. The changes were made to the code, but Node.js/TypeScript doesn't hot-reload these changes automatically.

## Solution: Server Has Been Restarted ✅

The server has been restarted and should now return correct unread counts.

## Verification Steps

### 1. Check Browser Console
Open `http://localhost:3001/messages` and check the browser console:

1. Press F12 to open DevTools
2. Go to Console tab
3. Look for the log message: `"First conversation:"`
4. Expand the object and verify `unreadCount` shows the correct number

**Expected:**
```javascript
{
  id: "...",
  otherUser: {...},
  unreadCount: 5  // <-- Should be actual count, not always 1
}
```

### 2. Manual Test with API Script (Optional)

If you want to verify the API directly:

```powershell
# 1. Get your auth token from browser
# F12 -> Application -> Local Storage -> authToken

# 2. Run the test script
node check_unread_api.cjs "YOUR_TOKEN_HERE"
```

This will show what the API actually returns.

### 3. Test in Browser

1. **Open two browser windows:**
   - Window 1: User A (main account)
   - Window 2: User B (different account or incognito)

2. **Send multiple messages from User B to User A:**
   - User B: Send 3-5 messages to User A
   - Don't open the conversation in User A's window

3. **Check User A's messages page:**
   - The badge should show the actual count (3, 4, 5, etc.)
   - NOT always "1"

4. **Click the conversation:**
   - Badge should disappear
   - All messages marked as read

## What Changed in the Code

### Backend (`server/storage.ts`)

The `getUserConversations()` function now includes this query:

```javascript
// Count unread messages where current user is recipient
const unreadResult = await pool.query(
  `SELECT COUNT(*) as count 
   FROM messages 
   WHERE conversation_id = $1 
     AND recipient_id = $2 
     AND read_status = false 
     AND deleted_at IS NULL`,
  [conv.id, userId]
);
const unreadCount = parseInt(unreadResult.rows[0]?.count || '0');
```

This counts **all** unread messages, not just returns a boolean.

## Common Issues

### Issue 1: Still Shows "1"
**Cause:** Browser cache or old WebSocket connection

**Solution:**
```
1. Hard refresh: Ctrl + Shift + R
2. Clear cache: Ctrl + Shift + Delete
3. Close and reopen browser tab
```

### Issue 2: Shows "undefined" or NaN
**Cause:** Backend still returning old format

**Solution:**
```powershell
# Completely kill all Node processes
Get-Process node | Stop-Process -Force

# Start fresh
npm run dev
```

### Issue 3: Badge doesn't appear at all
**Cause:** No unread messages OR field is missing

**Check:**
1. Send a test message from another account
2. Check browser console for conversation data
3. Verify `unreadCount` field exists in the response

## Database Query Explanation

The query counts messages where:
- ✅ `conversation_id` matches the conversation
- ✅ `recipient_id` equals the current user (not the sender)
- ✅ `read_status` is `false` (unread)
- ✅ `deleted_at` is `NULL` (not deleted)

This gives the **exact count** of unread messages.

## How to Create Test Data

To test with different counts:

1. **Send 1 message:** Should show "1"
2. **Send 5 messages:** Should show "5"
3. **Send 100 messages:** Should show "99+" (max display)
4. **Open conversation:** Should show nothing (all read)

## Expected Behavior

| Unread Count | Badge Display | Notes |
|-------------|--------------|-------|
| 0 | (no badge) | All messages read |
| 1 | 1 | Single unread message |
| 5 | 5 | Multiple unread messages |
| 25 | 25 | Shows actual count |
| 150 | 99+ | Caps at 99+ for large numbers |

## Troubleshooting Command

If the count is still wrong, check the database directly:

```sql
-- Replace USER_ID and CONVERSATION_ID with actual values
SELECT COUNT(*) 
FROM messages 
WHERE conversation_id = 'CONVERSATION_ID'
  AND recipient_id = 'USER_ID'
  AND read_status = false
  AND deleted_at IS NULL;
```

This will show the actual number of unread messages in the database.

## Next Steps

1. ✅ Server has been restarted
2. ⏳ Refresh browser page (Ctrl + Shift + R)
3. ⏳ Send test messages to verify counts
4. ⏳ Check that badge shows correct numbers

The fix is in place. The badge should now show the actual count of unread messages instead of always "1".

## If Still Not Working

If after server restart and browser refresh you still see "1":

1. **Check backend logs** for errors during conversation fetch
2. **Run the test script** to see raw API response
3. **Check database** to verify unread messages exist
4. **Clear all browser data** for localhost:3001

The most likely issue is browser cache holding old data. A hard refresh should fix it.
