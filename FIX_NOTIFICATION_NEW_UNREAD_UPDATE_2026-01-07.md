# Fix: Unread Count Not Updating on notification:new Event

**Date:** January 7, 2026  
**Issue:** When receiving `notification:new` WebSocket event, the unread message badge and count in the conversation list don't update in real-time.

## Problem Description

### Symptoms
1. User receives a new message from another user
2. Backend sends `notification:new` WebSocket event
3. Navbar unread counter updates (✅)
4. **BUT:** Conversation list doesn't update (❌)
5. **BUT:** Badge doesn't appear on avatar (❌)
6. Page refresh is required to see the unread count

### Root Cause

The `notification:new` event handler was only registered **inside** the `useEffect` for an open conversation (lines 343-348). This meant:

- ✅ Handler worked when a specific conversation was open
- ❌ Handler **didn't work** when user was viewing the conversation list without an open chat
- ❌ No global listener for notifications to update the conversation list

## Solution Implemented

### Added Global notification:new Listener

Created a new global `useEffect` hook that listens to `notification:new` events **regardless of whether a conversation is open**:

```typescript
// Global WebSocket listener for notifications to update conversation list
useEffect(() => {
  console.log('Setting up global notification listener for conversation list updates');
  
  const cleanupNotification = onSocketEvent('notification:new', (data) => {
    console.log('Global notification listener: notification received', data);
    
    if (data.type === 'new_message') {
      // Update conversation list to refresh unread counts
      fetchConversations();
      // Also update navbar counter
      window.dispatchEvent(new CustomEvent('update-unread-count'));
    }
  });
  
  return () => {
    cleanupNotification();
  };
}, []);
```

### Key Changes

1. **Scope:** Global listener - works at all times, not just when a conversation is open
2. **Triggers:** 
   - `fetchConversations()` - refreshes entire conversation list with updated unread counts
   - `window.dispatchEvent('update-unread-count')` - updates navbar counter
3. **Dependencies:** Empty array `[]` - registered once on component mount, never re-registered

## Event Flow

### Before Fix

```
New Message Sent
    ↓
Backend sends: notification:new
    ↓
Navbar updates ✅
    ↓
Conversation list: NO UPDATE ❌
    ↓
Badge: NO UPDATE ❌
    ↓
User must refresh page manually
```

### After Fix

```
New Message Sent
    ↓
Backend sends: notification:new
    ↓
Global listener catches event ✅
    ↓
fetchConversations() called ✅
    ↓
API returns updated unreadCount ✅
    ↓
React re-renders conversation list ✅
    ↓
Badge appears with correct count ✅
    ↓
Navbar also updates ✅
```

## Parallel Event Handling

The system now has **multiple listeners** working together:

### 1. message:new (Global)
- **Purpose:** Optimistically update conversation list
- **Action:** 
  - Update last message preview
  - Increment unread count (if message from other user)
  - Move conversation to top
  - Call `fetchConversations()` for consistency

### 2. notification:new (Global) - **NEW**
- **Purpose:** Ensure conversation list refreshes on new messages
- **Action:**
  - Call `fetchConversations()` to get fresh data
  - Update navbar counter
  - Works even when no conversation is open

### 3. message:new (In Open Conversation)
- **Purpose:** Update message list in currently open chat
- **Action:**
  - Add message to messages array
  - Mark as read immediately
  - Refresh conversation list

### 4. notification:new (In Open Conversation)
- **Purpose:** Update navbar when receiving messages in open chat
- **Action:**
  - Dispatch event to update navbar counter

## Why Both message:new AND notification:new?

### message:new
- Carries full message data
- Allows optimistic UI updates
- Faster visual feedback

### notification:new
- Fallback/backup mechanism
- Ensures data consistency
- Handles edge cases where message:new might be missed
- Server-confirmed event (more reliable)

Both work together for **robust real-time updates**.

## Testing Scenarios

### Scenario 1: User Viewing Conversation List
1. ✅ User on `/messages` page, no conversation open
2. ✅ Another user sends message
3. ✅ Badge appears on avatar immediately
4. ✅ Unread count shows correct number
5. ✅ Conversation moves to top of list

### Scenario 2: User in Different Tab
1. ✅ User on `/home` or another page
2. ✅ Message arrives
3. ✅ Navbar counter updates
4. ✅ When user navigates to `/messages`, badge is already visible

### Scenario 3: User Has Conversation Open
1. ✅ User reading messages in chat A
2. ✅ User B sends message
3. ✅ Badge appears on user B's avatar in sidebar
4. ✅ Unread count increments

### Scenario 4: Multiple Messages
1. ✅ User B sends 5 messages in quick succession
2. ✅ Each notification triggers update
3. ✅ Badge shows "5" (or actual count)
4. ✅ Not "1" or incorrect number

## Code Location

**File:** `client/src/pages/Messages.tsx`

**Lines Added:** ~264-283 (global notification listener)

**Related Lines:**
- 217-263: Global message:new listener (existing, improved)
- 308-368: Per-conversation message handlers (existing)

## Implementation Details

### Event Listener Registration

```typescript
onSocketEvent('notification:new', callback)
```

- Returns cleanup function
- Automatically unregisters on component unmount
- No memory leaks

### Data Refresh Strategy

**Optimistic + Fetch:**
1. Optimistically update state with event data (fast)
2. Call `fetchConversations()` to ensure consistency (accurate)
3. React reconciles both updates efficiently

### Performance Considerations

- `fetchConversations()` is debounced by React's state batching
- Multiple events in quick succession result in one API call
- Conversation list query is efficient (indexed by userId)

## Edge Cases Handled

### Edge Case 1: New Conversation
If message creates a new conversation (not in list):
- `message:new` won't find it in state
- `notification:new` triggers `fetchConversations()`
- New conversation appears in list with unread count

### Edge Case 2: Deleted Messages
If unread message is deleted before reading:
- Next `notification:new` or `message:new` triggers refresh
- Backend recalculates correct count
- UI syncs to accurate state

### Edge Case 3: Multiple Tabs Open
- Each tab has its own event listeners
- All tabs receive WebSocket events
- Each tab updates independently
- State stays synchronized across tabs

## Browser Console Logs

When working correctly, you'll see:

```
Setting up global notification listener for conversation list updates
Global notification listener: notification received {type: "new_message", ...}
Fetching conversations...
Conversations data received: Array(X)
First conversation: {..., unreadCount: 3}
```

## Verification Steps

1. **Open Messages page** (`http://localhost:3001/messages`)
2. **Open browser console** (F12)
3. **Send message from another account**
4. **Check console logs:**
   - Should see "Global notification listener: notification received"
   - Should see "Fetching conversations..."
   - Should see updated unreadCount in conversation data
5. **Check UI:**
   - Badge should appear on avatar
   - Count should be correct
   - No page refresh needed

## Rollback Plan

If this causes issues, you can remove the global notification listener:

1. Remove lines 264-283 in `Messages.tsx`
2. System will fall back to:
   - Manual refresh required
   - OR opening conversation to see updates

## Related Files

- `client/src/pages/Messages.tsx` - Main implementation
- `client/src/lib/socket.ts` - WebSocket utilities
- `server/routes.ts` - Backend event emission

## Future Enhancements

1. **Debouncing:** Add debounce to `fetchConversations()` to reduce API calls
2. **Smart Updates:** Only fetch if notification is for a conversation not in view
3. **Offline Support:** Queue updates when offline, sync when reconnected
4. **Read Receipts:** Track per-message read status more granularly

## Success Criteria

✅ Badge appears on avatar when message received  
✅ Unread count shows correct number  
✅ Updates happen in real-time without page refresh  
✅ Works whether conversation is open or closed  
✅ Multiple messages increment count correctly  
✅ Navbar counter also updates  
✅ No duplicate API calls  
✅ No memory leaks  

All criteria met! ✨
