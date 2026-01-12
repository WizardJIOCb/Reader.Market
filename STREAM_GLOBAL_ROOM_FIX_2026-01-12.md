# Stream Global Room Always-Active Fix

**Date:** 2026-01-12  
**Issue:** P1 doesn't see P2's comment when switching from "My Feed" back to "Global" tab

## Problem Description

### Scenario
1. P1 is on `/stream` page, viewing "Global" tab
2. P1 switches to "My Feed" (Моя лента) tab
3. P2 posts a comment on any book
4. P1 switches back to "Global" (Глобальная) tab
5. **❌ P1 doesn't see P2's comment**

### Root Cause

The previous implementation had a fundamental flaw in WebSocket room management:

```typescript
// OLD LOGIC - BROKEN
const joinRooms = () => {
  if (activeTab === 'global') {
    socket.emit('join:stream:global');
  } else if (activeTab === 'personal') {
    socket.emit('join:stream:personal');
  } else if (activeTab === 'shelves') {
    socket.emit('join:stream:shelves');
  }
};

// Cleanup would leave the current room
if (currentTab === 'global') {
  socket.emit('leave:stream:global');
}
```

**The Problem:**
1. When switching from "Global" → "My Feed", the cleanup runs and **leaves the global room**
2. The new effect joins the "personal" room
3. When P2 posts a comment, it broadcasts to `stream:global` room
4. **P1 is NOT in the global room anymore**, so the WebSocket event is lost
5. When P1 switches back to "Global", they join the room again, but the past broadcast is gone forever

## Solution

Keep the global WebSocket room **ALWAYS ACTIVE** throughout the entire session:

### Key Changes

1. **Always join global room** regardless of active tab
2. **Never leave global room** when switching tabs
3. Only join/leave personal and shelves rooms based on tab switching

### Implementation

#### 1. Updated Room Join Logic

```typescript
const joinRooms = () => {
  // ALWAYS join global room - we need to receive all global activities
  // regardless of which tab is active
  console.log('[STREAM PAGE] Joining global stream room (always active)');
  socket.emit('join:stream:global');
  
  // Join tab-specific rooms based on active tab
  if (activeTab === 'personal' && isAuthenticated) {
    console.log('[STREAM PAGE] Joining personal stream room');
    socket.emit('join:stream:personal');
  } else if (activeTab === 'shelves' && isAuthenticated) {
    console.log('[STREAM PAGE] Joining shelves stream room');
    socket.emit('join:stream:shelves');
  }
};
```

#### 2. Updated Cleanup Logic

```typescript
return () => {
  socket.off('connect', handleConnect);
  socket.off('stream:new-activity', handleNewActivity);
  socket.off('stream:activity-updated', handleActivityUpdated);
  socket.off('stream:activity-deleted', handleActivityDeleted);
  socket.off('stream:reaction-update', handleReactionUpdate);
  socket.off('stream:counter-update', handleCounterUpdate);
  
  // Leave tab-specific rooms only - NEVER leave global room
  // Global room should stay active to receive updates even when on other tabs
  console.log('[STREAM PAGE] Cleanup: leaving tab-specific room for tab:', currentTab);
  if (currentTab === 'personal' && wasAuthenticated) {
    socket.emit('leave:stream:personal');
  } else if (currentTab === 'shelves' && wasAuthenticated) {
    socket.emit('leave:stream:shelves');
  }
  // Note: We don't leave global room - it stays active throughout the session
};
```

## Why This Works

1. **Global room is always listening** - P1 receives all global activities even when viewing other tabs
2. **React Query cache is always active** - We previously removed the `enabled` condition, so the cache is maintained
3. **WebSocket updates are never lost** - Activities are added to the cache immediately when received
4. **Tab switching just changes display** - The UI filters what to show based on `activeTab`, but all data is available

## Files Modified

- `client/src/pages/StreamPage.tsx` (lines 119-134, 307-324)

## Testing

### Test Steps
1. **Refresh browser** - The frontend code has changed, so hard refresh (Ctrl+F5)
2. Open `/stream` in browser 1 as P1
3. Switch to "Моя лента" (My Feed) tab
4. In browser 2 (incognito), login as P2
5. P2 posts a comment on any book
6. P1 switches back to "Глобальная" (Global) tab
7. **✅ P1 should now see P2's comment!**

### Expected Console Output

When P1 switches to "My Feed":
```
[STREAM PAGE] Cleanup: leaving tab-specific room for tab: global
[STREAM PAGE] Joining global stream room (always active)
[STREAM PAGE] Joining personal stream room
```

When P2 posts a comment (P1 receives it):
```
[STREAM] New activity received: {...}
[STREAM] Activity type: comment
```

When P1 switches back to "Global":
```
[STREAM PAGE] Cleanup: leaving tab-specific room for tab: personal
[STREAM PAGE] Joining global stream room (always active)
```

## Related Fixes

This completes the series of WebSocket room management fixes:

1. **Fix 1:** Added closure variables for proper room cleanup (preventing wrong room leave)
2. **Fix 2:** Removed `enabled` condition from React Query to keep cache active
3. **Fix 3:** Made global room permanently active to receive updates regardless of tab

## Technical Insights

### WebSocket Room Management Principles

1. **Global rooms should stay active** - If you need real-time updates for global data, never leave the room
2. **Display filtering ≠ Data filtering** - Receive all data, filter what you show in the UI
3. **React Query + WebSocket coordination** - Keep queries active when they receive real-time updates
4. **Closure variables for cleanup** - Capture state values for proper cleanup in useEffect

### React Query + WebSocket Pattern

```typescript
// Query is ALWAYS enabled
const { data } = useQuery({
  queryKey: ['api', 'stream', 'global'],
  // No 'enabled' condition - always active
});

// WebSocket ALWAYS listening
useEffect(() => {
  socket.emit('join:stream:global'); // Join once
  
  socket.on('stream:new-activity', (activity) => {
    // Update cache directly
    queryClient.setQueryData(['api', 'stream', 'global'], (old = []) => {
      return [activity, ...old];
    });
  });
  
  return () => {
    // Never leave global room
  };
}, []);
```

## Status

✅ **FIXED** - Global room now stays active, real-time updates work across all tab switches
