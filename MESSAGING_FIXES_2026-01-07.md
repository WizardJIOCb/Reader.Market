# Messaging System Fixes - 2026-01-07

## Issues Fixed

### 1. Empty Conversations List (GET /api/conversations returns [])
**Root Cause**: Vite proxy issue preventing proper routing of requests.

**Fix Applied**:
- Updated `fetchConversations()` to use direct backend URL in development:
  - Dev: `http://localhost:5001/api/conversations`
  - Prod: `/api/conversations`
- Added enhanced logging to track response status and data

**How to Test**:
1. Open browser console on http://localhost:3001/messages
2. Check for log: `Fetching conversations from: http://localhost:5001/api/conversations`
3. Verify conversations load correctly

You can also paste this in browser console to test:
```javascript
// Copy the content from test_token_conversations.js
```

### 2. Message Send Error ("Recipient ID and content are required")
**Root Cause**: Two issues:
- Vite proxy not properly routing POST requests
- Conversation object might not have `otherUser` populated correctly

**Fixes Applied**:
- Updated `sendMessage()` to use direct backend URL:
  - Dev: `http://localhost:5001/api/messages`
  - Prod: `/api/messages`
- Added validation to check if `recipientId` exists before sending
- Shows user-friendly error message if recipient ID is missing
- Updated `startConversation()` to use direct backend URL and better error handling

**How to Test**:
1. Search for a user in private messages
2. Click on user to start conversation
3. Type a message and send
4. Check console logs for detailed flow
5. Should see: `Sending message to: http://localhost:5001/api/messages`

### 3. Settings Button Not Visible in Groups
**Root Cause**: Vite proxy returning HTML instead of JSON for `/api/groups/:groupId/my-role`

**Fix Applied**:
- Updated `fetchUserGroupRole()` to use direct backend URL:
  - Dev: `http://localhost:5001/api/groups/{groupId}/my-role`
  - Prod: `/api/groups/{groupId}/my-role`
- Added enhanced logging for role fetch

**How to Test**:
1. Navigate to a group you created (e.g., "адм")
2. Settings button should now appear in group header
3. Check console for: `Fetching user group role from: http://localhost:5001/api/groups/...`
4. Should see: `User group role fetched: administrator for group: ...`

## Technical Details

### Why Direct Backend URLs?
During development, Vite runs on port 3001 and proxies API requests to the backend on port 5001. However, Vite's proxy has issues with certain request types:
- DELETE requests often return HTML instead of proper responses
- Some GET requests don't route correctly
- POST requests may not be proxied properly

By using direct backend URLs in development (`import.meta.env.DEV`), we bypass Vite's proxy entirely and communicate directly with the Express server.

### Database Verification
Ran database test showing:
- 7 conversations exist in database
- 98 messages exist
- All data is intact

The issue was purely a routing/proxy problem, not data loss.

## Files Modified

1. **client/src/pages/Messages.tsx**
   - `fetchConversations()` - Added direct backend URL
   - `fetchUserGroupRole()` - Added direct backend URL  
   - `sendMessage()` - Added direct backend URL + recipientId validation
   - `startConversation()` - Added direct backend URL + better error handling

## Next Steps

After these fixes, please:

1. **Restart the development server** (already done with stop-dev.bat + start-dev.bat)

2. **Clear browser cache and localStorage** (optional but recommended):
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data
   - Or just do a hard refresh (Ctrl+Shift+R)

3. **Test the messaging flow**:
   - Navigate to http://localhost:3001/messages
   - Verify conversations load
   - Search for a user and start conversation
   - Send a message
   - Join a group and verify settings button appears

4. **Check console logs**:
   - All API calls should show direct backend URLs in development
   - Should see successful responses (200, 201 status codes)
   - No HTML responses

## Known Limitations

These fixes only apply to **development environment**. In production, the standard relative URLs (`/api/...`) are used since there's no Vite proxy - the backend serves the built frontend directly.

## If Issues Persist

If you still see empty conversations or other issues:

1. **Check authentication**:
   ```javascript
   // Paste in browser console
   const token = localStorage.getItem('authToken');
   console.log('Token:', token ? 'exists' : 'missing');
   if (token) {
     const payload = JSON.parse(atob(token.split('.')[1]));
     console.log('User:', payload);
   }
   ```

2. **Verify backend is running**:
   - Check terminal for server on port 5001
   - Should see log messages when making requests

3. **Check backend logs**:
   - Look for the GET /api/conversations log with version header
   - Should show user ID and conversations count

4. **Test direct API call**:
   - Use the test_token_conversations.js script in browser console
   - Or manually call: `fetch('http://localhost:5001/api/conversations', {headers: {'Authorization': 'Bearer ' + localStorage.getItem('authToken')}}).then(r=>r.json()).then(console.log)`
