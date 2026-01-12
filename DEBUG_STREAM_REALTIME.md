# Debugging Real-Time Stream Updates

## Issue
Comments posted by User 2 don't appear in real-time on User 1's `/stream` page (Global tab) without manual refresh.

## Recent Fix Applied
**WebSocket authentication is now OPTIONAL** - unauthenticated users (guests) can now connect to WebSocket and view the global stream in real-time. This fixes the issue where unauthenticated users couldn't receive real-time updates.

## Debugging Steps

### Step 1: Check Browser Console on `/stream` Page

Open User 1's browser, go to `http://localhost:3001/stream`, open Developer Tools (F12) and check Console for:

**Expected logs (authenticated user):**
```
[STREAM PAGE] Setting up WebSocket connection...
[STREAM PAGE] Socket connected: true
[STREAM PAGE] Is authenticated: true
[STREAM PAGE] Joining global stream room (accessible to all)
[SOCKET.IO] ✅ WebSocket connected
[SOCKET.IO] Socket ID: xxxxx
[SOCKET.IO] Connected to server with authentication, personal room should be auto-joined
```

**Expected logs (guest/unauthenticated user):**
```
[STREAM PAGE] Setting up WebSocket connection...
[STREAM PAGE] Socket connected: true
[STREAM PAGE] Is authenticated: false
[STREAM PAGE] Joining global stream room (accessible to all)
[SOCKET.IO] ✅ WebSocket connected
[SOCKET.IO] Socket ID: xxxxx
[SOCKET.IO] Connected to server without authentication (guest mode)
```

**If you see `Socket connected: false`:**
- The WebSocket hasn't connected yet
- Wait a few seconds for connection
- Check Network tab for WebSocket connection

**If you see `No socket available - will retry shortly`:**
- Socket is still initializing (this is normal on first load)
- Component will re-render when socket becomes available
- If this persists, check if App.tsx is initializing the socket

### Step 2: Post a Comment from User 2

While User 1 is on `/stream` page, have User 2 post a comment on the book:
`http://localhost:3001/book/c64beca1-0bfe-4d9c-95e2-bebcabd53bb8`

### Step 3: Check User 1's Console for WebSocket Event

You should see:
```
[STREAM] New activity received: {
  id: "...",
  type: "comment",
  entityId: "...",
  ...
}
```

**If you DON'T see this log:**
The WebSocket event is not reaching the browser. Continue to Step 4.

**If you DO see this log:**
The event is received but UI isn't updating. Continue to Step 5.

### Step 4: Check Backend Server Logs

In the terminal running `npm run dev`, after User 2 posts a comment, you should see:

```
User xxxxx joining global stream
[STREAM] Comment activity created for comment xxxxx
[STREAM] Created comment activity: xxxxx
[STREAM] Broadcasted to global stream
```

**If you see these logs:**
Backend is working correctly, but browser isn't receiving. Check Step 4a.

**If you DON'T see these logs:**
Backend integration issue. Contact developer.

#### Step 4a: Verify WebSocket Room Membership

In the server terminal, you should have seen when User 1 opened `/stream`:
```
User xxxxx joining global stream
```

If you don't see this, the room join event didn't fire.

### Step 5: Manual Test with Test Script

If browser isn't receiving events, test with the command-line script.

#### Test as Authenticated User:

1. Get your auth token from browser localStorage:
   - Open Dev Tools (F12)
   - Go to Application/Storage tab
   - Find localStorage
   - Copy value of `authToken`

2. Run test script:
```bash
node test_stream_websocket.cjs "YOUR_AUTH_TOKEN_HERE"
```

#### Test as Guest (Unauthenticated):

Run without token:
```bash
node test_stream_websocket.cjs
```

You should see:
```
✅ Connected to WebSocket server
Socket ID: xxxxx
Joining global stream room...
✅ Ready to receive stream events!
Waiting for new activities...
```

3. Have User 2 post a comment

4. You should see:
```
🎉 NEW ACTIVITY RECEIVED: {
  "id": "...",
  "type": "comment",
  ...
}
```

**If the test script receives the event but browser doesn't:**
- Browser WebSocket connection issue
- Try hard refresh (Ctrl+Shift+R)
- Check browser console for connection errors

### Step 6: Check React Query Cache

If WebSocket events are received but UI doesn't update, check if React Query cache is being updated:

In browser console, after receiving the WebSocket event, run:
```javascript
// Check global stream cache
window.__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__?.queryClient?.getQueryData(['api', 'stream', 'global'])
```

This should show an array of activities. The new comment should be at the beginning (index 0).

### Step 7: Force Reconnection

If nothing works, try forcing a WebSocket reconnection:

In browser console on `/stream` page:
```javascript
// Get socket instance
const socket = window.__SOCKET__;
// Reconnect
if (socket) socket.disconnect(); socket.connect();
```

Then try posting a comment again.

## Common Issues

### Issue: "Socket connected: false"
**Solution:** Wait a few seconds. WebSocket connection is asynchronous. If it stays false, check:
- Server is running on port 5001
- No firewall blocking WebSocket connections

### Issue: "No socket available - will retry shortly"
**Solution:** Socket is still initializing. This is normal on first page load. If it persists:
1. Check that App.tsx is calling `initializeSocket()`
2. Check browser console for socket connection errors
3. Reload the page

### Issue: WebSocket connects but no events received
**Solution:** 
1. Check if room was joined (look for "Joining global stream room" log)
2. Verify backend broadcasted event (check server logs)
3. Try reconnecting (see Step 7)

### Issue: Events received but UI doesn't update
**Solution:**
1. Check React Query cache (Step 6)
2. Check for JavaScript errors in console
3. Hard refresh the page (Ctrl+Shift+R)

## Success Criteria

When working correctly:
1. User 1 opens `/stream` → sees "Socket connected: true"
2. User 2 posts comment → User 1's console shows "[STREAM] New activity received"
3. Comment appears immediately at top of User 1's stream
4. Toast notification appears saying "New comment posted"
5. No manual refresh needed

## Need Help?

If you've completed all steps and it still doesn't work, provide:
1. Screenshot of browser console logs
2. Screenshot of server terminal logs
3. Which step failed
4. Any error messages
