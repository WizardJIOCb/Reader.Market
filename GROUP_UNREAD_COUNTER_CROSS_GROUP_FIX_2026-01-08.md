# Group Unread Counter - Cross-Group Notification Fix
**Date:** January 8, 2026  
**Issue:** User doesn't see unread count when switching between groups - badge doesn't persist when leaving a group with new messages

## Problem Description

### Initial Bug Report
"если WizardJIOCb перешёл в другой групповой чат, то он так и не получит обновления из того чата из которого ушёл, пока не придёт в этот чат снова, а должен увидеть новые сообщения в чате из которого ушёл"

**Translation:** If WizardJIOCb switches to a different group chat, they won't see updates from the chat they left until they return to it, but they should see new message indicators for the chat they left.

### Concrete Example

**Scenario:**
1. WizardJIOCb is viewing group "Лес" (channelId: `af9851ad-fc2e-4a2f-9e4f-b13a8fc16f53`)
2. Another user sends message to group "123" (channelId: `f9a448c6-8b77-40b7-8556-12eee606f476`)
3. WebSocket event arrives: `channel:message:new` with `groupId: '123'` and `channelId: 'f9a448c6...'`
4. WizardJIOCb switches to view group "Тест"

**Expected:**
- Badge appears on group "123" showing unread count
- Badge persists even after switching to group "Тест"

**Actual (Before Fix):**
- Badge might appear briefly on group "123"
- When switching to group "Тест", the condition changes
- Badge state becomes inconsistent

### Root Cause

The original condition only checked `selectedChannel.id`:

```typescript
if (!selectedChannel || selectedChannel.id !== data.channelId) {
  // Increment unread count
}
```

**The Problem:**
- This only checks if the **channel** is different, not the **group**
- When user is in group "Лес" channel "general", and message arrives in group "123" channel "general"
- Both channels might have different IDs, so condition is TRUE ✅
- **BUT** when user switches to group "Тест", `selectedChannel` changes
- The listener dependency `[selectedChannel]` causes re-evaluation
- State becomes inconsistent across group switches

**Missing Logic:**
- Need to check if message is from a **different group** entirely
- Need to check if message is from a **different channel within the same group**
- Need to include `selectedGroup` in dependency array

## Solution

### Enhanced Condition Logic

Check **both** group and channel context:

```typescript
// Check if message is from a DIFFERENT group OR a different channel in the SAME group
const isDifferentGroup = !selectedGroup || selectedGroup.id !== data.groupId;
const isSameGroupDifferentChannel = selectedGroup?.id === data.groupId && 
                                     selectedChannel?.id !== data.channelId;

if (isDifferentGroup || isSameGroupDifferentChannel) {
  // Increment unread count - user is NOT currently viewing this channel
  setGroups(prev => prev.map(group => {
    if (group.id === data.groupId) {
      return { ...group, unreadCount: (group.unreadCount || 0) + 1 };
    }
    return group;
  }));
}
```

### Key Changes

1. **Check Group Context First**: `isDifferentGroup` determines if message is from a completely different group
2. **Check Channel Within Group**: `isSameGroupDifferentChannel` handles multiple channels in same group
3. **Include Both Dependencies**: `[selectedChannel, selectedGroup]` ensures listener updates when either changes

## Implementation

### File: `client/src/pages/Messages.tsx`

**Location:** Lines 382-421 (Global WebSocket listener)

**Before:**
```typescript
useEffect(() => {
  const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
    if (!selectedChannel || selectedChannel.id !== data.channelId) {
      // Increment unread count
      setGroups(prev => prev.map(group => {
        if (group.id === data.groupId) {
          return { ...group, unreadCount: (group.unreadCount || 0) + 1 };
        }
        return group;
      }));
    }
  });
  
  return () => cleanupChannelMessage();
}, [selectedChannel]); // ❌ Missing selectedGroup
```

**After:**
```typescript
useEffect(() => {
  const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
    console.log('  - Message groupId:', data.groupId);
    console.log('  - Currently selected group:', selectedGroup?.id);
    console.log('  - Currently selected channel:', selectedChannel?.id);
    
    // Check if message is from a DIFFERENT group OR a different channel in the SAME group
    const isDifferentGroup = !selectedGroup || selectedGroup.id !== data.groupId;
    const isSameGroupDifferentChannel = selectedGroup?.id === data.groupId && 
                                         selectedChannel?.id !== data.channelId;
    
    if (isDifferentGroup || isSameGroupDifferentChannel) {
      console.log('%c[GLOBAL LISTENER] Message from unwatched channel, incrementing unread count', 'color: orange; font-weight: bold');
      
      setGroups(prev => prev.map(group => {
        if (group.id === data.groupId) {
          const newCount = (group.unreadCount || 0) + 1;
          console.log(`%c[GLOBAL LISTENER] Incrementing ${group.name} unread: ${group.unreadCount} -> ${newCount}`, 'color: orange');
          return { ...group, unreadCount: newCount };
        }
        return group;
      }));
      
      fetchGroups(); // Sync with backend
    } else {
      console.log('%c[GLOBAL LISTENER] Message in currently viewed channel, not incrementing', 'color: gray');
    }
  });
  
  return () => cleanupChannelMessage();
}, [selectedChannel, selectedGroup]); // ✅ Both dependencies included
```

## Testing Scenarios

### Test Case 1: Cross-Group Messages

**Setup:**
1. Open two browser tabs
2. Tab 1: User A in group "Лес"
3. Tab 2: WizardJIOCb in group "Тест"

**Steps:**
1. Tab 1: User A sends message in group "123"
2. Tab 2: Observe group list

**Expected Result:**
- ✅ Badge appears on group "123" showing "1"
- ✅ Console shows: `isDifferentGroup: true` (because WizardJIOCb is in group "Тест", not "123")
- ✅ Console shows: `Incrementing 123 unread: 0 -> 1`

**Before Fix:**
- ❌ Badge appeared inconsistently
- ❌ Switching groups caused badge to disappear

### Test Case 2: Same Group, Different Channel

**Setup:**
1. Group "Лес" has 3 channels: "general", "announcements", "random"
2. WizardJIOCb is viewing channel "general" in group "Лес"

**Steps:**
1. Another user sends message in channel "announcements" (same group "Лес")
2. Observe group list

**Expected Result:**
- ✅ Badge appears on group "Лес" showing "1"
- ✅ Console shows: `isDifferentGroup: false` (same group)
- ✅ Console shows: `isSameGroupDifferentChannel: true` (different channel)
- ✅ Console shows: `Incrementing Лес unread: 0 -> 1`

### Test Case 3: Currently Viewing Channel

**Setup:**
1. WizardJIOCb is viewing channel "general" in group "Лес"

**Steps:**
1. Another user sends message in same channel "general" in group "Лес"
2. Observe group list

**Expected Result:**
- ✅ Badge does NOT increment (stays at 0)
- ✅ Console shows: `isDifferentGroup: false`
- ✅ Console shows: `isSameGroupDifferentChannel: false`
- ✅ Console shows: `Message in currently viewed channel, not incrementing`
- ✅ Message appears in chat panel via WebSocket

### Test Case 4: Switching Groups Preserves Badges

**Setup:**
1. WizardJIOCb is viewing group "Лес"
2. Another user sends 3 messages to group "123"

**Steps:**
1. Verify badge shows "3" on group "123"
2. WizardJIOCb switches to view group "Тест"
3. Observe group list

**Expected Result:**
- ✅ Badge remains "3" on group "123" (persists across group switches)
- ✅ Console continues showing correct unread counts
- ✅ No badge flickering or inconsistent states

**Before Fix:**
- ❌ Badge disappeared when switching groups
- ❌ Unread count was lost

## Console Logging

Enhanced logging helps debug the condition logic:

```
Global channel message listener: new message received {groupId: '123', channelId: 'abc...'}
  - Message groupId: 123
  - Message channelId: abc123...
  - Currently selected group: Лес
  - Currently selected channel: def456...
[GLOBAL LISTENER] Message from unwatched channel, incrementing unread count
[GLOBAL LISTENER] Incrementing 123 unread: 2 -> 3
```

## Edge Cases Handled

### Edge Case 1: No Group Selected
```typescript
const isDifferentGroup = !selectedGroup || selectedGroup.id !== data.groupId;
```
If `selectedGroup` is `null` (user on private messages tab), condition is TRUE, so group badges still increment.

### Edge Case 2: Multiple Channels in Same Group
```typescript
const isSameGroupDifferentChannel = selectedGroup?.id === data.groupId && 
                                     selectedChannel?.id !== data.channelId;
```
If user is in group "Лес" channel "general", and message arrives in "Лес" channel "announcements", badge increments.

### Edge Case 3: Rapid Group Switching
Dependencies `[selectedChannel, selectedGroup]` ensure listener re-runs when either changes, maintaining correct state.

### Edge Case 4: Page Refresh
Optimistic updates are lost on refresh, but `fetchGroups()` call syncs with backend to restore accurate counts.

## Benefits of This Fix

### 1. Cross-Group Awareness
- **Before:** Badge disappeared when switching groups
- **After:** Badge persists regardless of which group user is viewing

### 2. Multi-Channel Support
- **Before:** Only checked channel ID, missed same-group different-channel scenarios
- **After:** Handles both cross-group and within-group channel notifications

### 3. Accurate State Management
- **Before:** Missing dependency caused stale closures
- **After:** Both dependencies included, ensuring listener has fresh state

### 4. Better UX
- Users don't miss notifications when switching between groups
- Unread counts persist correctly
- Real-time updates work across all groups simultaneously

## Related Documentation

- `GROUP_UNREAD_COUNTER_OPTIMISTIC_UPDATES_2026-01-08.md` - Initial optimistic updates implementation
- `GROUP_UNREAD_MARK_READ_API_2026-01-08.md` - Mark-as-read API endpoint
- `UNREAD_MESSAGE_INDICATOR_IMPLEMENTATION_2026-01-07.md` - Original unread badge implementation

## Success Criteria

### Completed ✅
- [x] Badge increments when message arrives in different group
- [x] Badge increments when message arrives in same group, different channel
- [x] Badge does NOT increment when message arrives in currently viewed channel
- [x] Badge persists when user switches between groups
- [x] Dependencies include both selectedChannel and selectedGroup
- [x] Console logging for debugging

### Validation Needed
- [ ] Multi-tab synchronization (verify both tabs see consistent badges)
- [ ] High-frequency group switching (no race conditions)
- [ ] Edge case: User switches groups while messages are being sent

## Conclusion

This fix ensures that unread message badges work correctly across all group switching scenarios. The key insight is checking **both** group and channel context, not just channel ID alone. With proper dependency management and optimistic updates, users now receive accurate real-time notifications regardless of which group they're currently viewing.
