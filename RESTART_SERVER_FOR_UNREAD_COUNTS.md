# How to Activate Unread Message Indicators

## Problem
You're seeing the global unread counter in the navbar, but **not** seeing individual unread badges in the conversation/group list in the left panel of the Messages page.

## Root Cause
The backend code in `server/storage.ts` has been updated to include `unreadCount` fields, but the **server is still running the old code**. Node.js doesn't automatically reload changes in TypeScript files.

## Solution: Restart the Server

### Step 1: Stop the Current Server

**Option A: Using stop script (Recommended)**
```powershell
.\stop-dev.bat
```

**Option B: Manual Process Kill**
```powershell
# Find the Node.js process
Get-Process node

# Kill all Node processes
Stop-Process -Name node -Force
```

**Option C: Close the terminal**
- Simply close the terminal window where `npm run dev` is running

### Step 2: Start the Server Fresh

```powershell
npm run dev
```

Wait for the server to fully start. You should see:
```
Connecting to database with URL: postgresql://...
Registering API routes...
API routes registered successfully
✓ Vite server started at http://localhost:5001
```

### Step 3: Verify the Backend is Returning Unread Counts

Open your browser:
1. Go to `http://localhost:3001/messages`
2. Open DevTools (F12)
3. Go to Console tab
4. Look for the log: `"First conversation:"` 
5. Expand the object and check if `unreadCount` field is present

**Expected Output:**
```json
{
  "id": "some-id",
  "otherUser": {...},
  "lastMessage": {...},
  "updatedAt": "2026-01-07...",
  "unreadCount": 0    // <-- This field should be present!
}
```

### Step 4: Test Unread Count API (Optional)

You can use the test script to verify the API:

1. Get your auth token:
   - Open DevTools (F12)
   - Go to Application tab
   - Click on Local Storage → http://localhost:3001
   - Copy the value of `authToken`

2. Run the test script:
```powershell
node test_unread_counts.cjs "YOUR_TOKEN_HERE"
```

This will show if `unreadCount` is being returned by the API.

### Step 5: Create Test Unread Messages

To see the badges in action:

1. **Open two browser windows side by side**
   - Window 1: Login as User A
   - Window 2: Login as User B (or use incognito mode)

2. **Send a message from User B to User A**
   - User B: Go to Messages → Start conversation with User A
   - User B: Send a message: "Hello, this is a test!"

3. **Check User A's messages page**
   - User A: Should see a badge with "1" next to User B's name
   - The badge should be a blue circle with white text

4. **Click the conversation**
   - Badge should disappear after messages are viewed

## What the Badges Look Like

### Private Conversations
```
[Avatar] [Username + Last Message]         [1]
                                            ↑
                                      Blue badge
```

### Groups
```
[Group Icon] [Group Name + Member Count]   [5]
                                            ↑
                                      Blue badge
```

## Troubleshooting

### Badge Still Not Showing?

**Check 1: Browser Console Errors**
```javascript
// Open DevTools Console and run:
// Look at the first conversation
console.log('Conversations:', JSON.stringify(conversations, null, 2));
```

**Check 2: Verify unreadCount in Data**
The console.log in `fetchConversations()` should show:
```
Conversations data received: Array(X)
First conversation: {
  ...
  "unreadCount": 0  // <-- Must be present
}
```

**Check 3: Clear Browser Cache**
```
Ctrl + Shift + R  (Hard reload)
```

**Check 4: Check Network Tab**
1. Open DevTools → Network tab
2. Filter: XHR
3. Reload page
4. Click on `/api/conversations` request
5. Look at Response tab
6. Verify `unreadCount` is in the JSON

### Common Issues

**Issue: Port 5001 already in use**
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5001
```
Solution:
```powershell
Stop-Process -Name node -Force
npm run dev
```

**Issue: TypeScript compilation errors**
Check the terminal output for any TypeScript errors. If you see errors, the code didn't compile properly.

**Issue: Database connection failed**
Make sure PostgreSQL is running:
```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*
```

## Verification Checklist

After restarting:

- [ ] Server starts without errors
- [ ] Can access http://localhost:3001/messages
- [ ] Browser console shows "Fetching conversations..."
- [ ] Console log shows `unreadCount` field in conversation objects
- [ ] Can send messages between users
- [ ] Badge appears with unread count
- [ ] Badge disappears when conversation is opened
- [ ] Badge shows correct count (1, 2, 3... or 99+)
- [ ] Real-time updates work (badge updates without refresh)

## Quick Command Reference

```powershell
# Stop server
.\stop-dev.bat

# Start server
npm run dev

# Kill all Node processes (if stop script doesn't work)
Stop-Process -Name node -Force

# Check if server is running
Get-Process node

# Test API endpoint
node test_unread_counts.cjs "YOUR_AUTH_TOKEN"
```

## Next Steps After Restart

1. ✅ Server restarted successfully
2. ✅ Backend returns `unreadCount` in API responses  
3. ✅ Frontend displays badges in conversation list
4. ✅ Real-time updates work via WebSocket
5. ✅ Badges disappear when messages are read

The feature should now be fully functional! If you still don't see badges after following all these steps, check the browser console for any JavaScript errors.
# How to Activate Unread Message Indicators

## Problem
You're seeing the global unread counter in the navbar, but **not** seeing individual unread badges in the conversation/group list in the left panel of the Messages page.

## Root Cause
The backend code in `server/storage.ts` has been updated to include `unreadCount` fields, but the **server is still running the old code**. Node.js doesn't automatically reload changes in TypeScript files.

## Solution: Restart the Server

### Step 1: Stop the Current Server

**Option A: Using stop script (Recommended)**
```powershell
.\stop-dev.bat
```

**Option B: Manual Process Kill**
```powershell
# Find the Node.js process
Get-Process node

# Kill all Node processes
Stop-Process -Name node -Force
```

**Option C: Close the terminal**
- Simply close the terminal window where `npm run dev` is running

### Step 2: Start the Server Fresh

```powershell
npm run dev
```

Wait for the server to fully start. You should see:
```
Connecting to database with URL: postgresql://...
Registering API routes...
API routes registered successfully
✓ Vite server started at http://localhost:5001
```

### Step 3: Verify the Backend is Returning Unread Counts

Open your browser:
1. Go to `http://localhost:3001/messages`
2. Open DevTools (F12)
3. Go to Console tab
4. Look for the log: `"First conversation:"` 
5. Expand the object and check if `unreadCount` field is present

**Expected Output:**
```json
{
  "id": "some-id",
  "otherUser": {...},
  "lastMessage": {...},
  "updatedAt": "2026-01-07...",
  "unreadCount": 0    // <-- This field should be present!
}
```

### Step 4: Test Unread Count API (Optional)

You can use the test script to verify the API:

1. Get your auth token:
   - Open DevTools (F12)
   - Go to Application tab
   - Click on Local Storage → http://localhost:3001
   - Copy the value of `authToken`

2. Run the test script:
```powershell
node test_unread_counts.cjs "YOUR_TOKEN_HERE"
```

This will show if `unreadCount` is being returned by the API.

### Step 5: Create Test Unread Messages

To see the badges in action:

1. **Open two browser windows side by side**
   - Window 1: Login as User A
   - Window 2: Login as User B (or use incognito mode)

2. **Send a message from User B to User A**
   - User B: Go to Messages → Start conversation with User A
   - User B: Send a message: "Hello, this is a test!"

3. **Check User A's messages page**
   - User A: Should see a badge with "1" next to User B's name
   - The badge should be a blue circle with white text

4. **Click the conversation**
   - Badge should disappear after messages are viewed

## What the Badges Look Like

### Private Conversations
```
[Avatar] [Username + Last Message]         [1]
                                            ↑
                                      Blue badge
```

### Groups
```
[Group Icon] [Group Name + Member Count]   [5]
                                            ↑
                                      Blue badge
```

## Troubleshooting

### Badge Still Not Showing?

**Check 1: Browser Console Errors**
```javascript
// Open DevTools Console and run:
// Look at the first conversation
console.log('Conversations:', JSON.stringify(conversations, null, 2));
```

**Check 2: Verify unreadCount in Data**
The console.log in `fetchConversations()` should show:
```
Conversations data received: Array(X)
First conversation: {
  ...
  "unreadCount": 0  // <-- Must be present
}
```

**Check 3: Clear Browser Cache**
```
Ctrl + Shift + R  (Hard reload)
```

**Check 4: Check Network Tab**
1. Open DevTools → Network tab
2. Filter: XHR
3. Reload page
4. Click on `/api/conversations` request
5. Look at Response tab
6. Verify `unreadCount` is in the JSON

### Common Issues

**Issue: Port 5001 already in use**
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5001
```
Solution:
```powershell
Stop-Process -Name node -Force
npm run dev
```

**Issue: TypeScript compilation errors**
Check the terminal output for any TypeScript errors. If you see errors, the code didn't compile properly.

**Issue: Database connection failed**
Make sure PostgreSQL is running:
```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*
```

## Verification Checklist

After restarting:

- [ ] Server starts without errors
- [ ] Can access http://localhost:3001/messages
- [ ] Browser console shows "Fetching conversations..."
- [ ] Console log shows `unreadCount` field in conversation objects
- [ ] Can send messages between users
- [ ] Badge appears with unread count
- [ ] Badge disappears when conversation is opened
- [ ] Badge shows correct count (1, 2, 3... or 99+)
- [ ] Real-time updates work (badge updates without refresh)

## Quick Command Reference

```powershell
# Stop server
.\stop-dev.bat

# Start server
npm run dev

# Kill all Node processes (if stop script doesn't work)
Stop-Process -Name node -Force

# Check if server is running
Get-Process node

# Test API endpoint
node test_unread_counts.cjs "YOUR_AUTH_TOKEN"
```

## Next Steps After Restart

1. ✅ Server restarted successfully
2. ✅ Backend returns `unreadCount` in API responses  
3. ✅ Frontend displays badges in conversation list
4. ✅ Real-time updates work via WebSocket
5. ✅ Badges disappear when messages are read

The feature should now be fully functional! If you still don't see badges after following all these steps, check the browser console for any JavaScript errors.
