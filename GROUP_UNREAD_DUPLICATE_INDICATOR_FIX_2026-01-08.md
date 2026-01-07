# Group Unread Duplicate Indicator Fix

**Date:** January 8, 2026  
**Issue:** User sees TWO unread indicators in group chats - one showing "0" as plain text, another showing "1" as styled blue badge  
**Status:** Fix Ready

## Problem Confirmed

User reports: "в групповых чатах вижу индикатор сообщений отображается как 0 просто текстом без стилей. и есть другой элемент в групповых чатах где показано 1 сообщение он синий и другой."

Translation: "In group chats I see a message indicator displayed as 0 just as plain text without styles. And there's another element in group chats showing 1 message - it's blue and different."

### Visual Description
- ❌ **Unstyled**: Plain text "0" (possibly from memberCount or incorrectly displayed unreadCount)
- ✅ **Styled**: Blue badge showing "1" (correct implementation at line 1235-1241)

## Root Cause Analysis

After investigation, the most likely cause is:

### Theory: Member Count vs Unread Count Confusion

**Line 1248:**
```tsx
{group.memberCount && ` • ${group.memberCount} ${t('messages:members')}`}
```

This displays: "Private • 3 members" or similar text

**Possible Issues:**
1. If `unreadCount` is somehow being passed as `memberCount` from backend
2. If `unreadCount` is being rendered somewhere else as plain text
3. If there's a data inconsistency where `unreadCount: 0` shows as text

### Current Badge Implementation (CORRECT)

**Lines 1235-1241:**
```tsx
{group.unreadCount && group.unreadCount > 0 && (
  <div className="absolute -bottom-1 -left-1 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center border-2 border-background">
    {group.unreadCount > 99 ? '99+' : group.unreadCount}
  </div>
)}
```

This is styled correctly and positioned on avatar.

## Solution: Add Debug Logging

Since we cannot visually inspect, let's add temporary debugging to identify where "0" is coming from:

### Step 1: Add Debug Console Logs

```tsx
{console.log('[GROUP DEBUG]', {
  id: group.id,
  name: group.name,
  unreadCount: group.unreadCount,
  memberCount: group.memberCount,
  hasUnreadBadge: !!(group.unreadCount && group.unreadCount > 0)
})}
```

### Step 2: Verify Data Structure

Check if backend is returning correct data:
- `unreadCount` should be number or undefined
- `memberCount` should be number representing members, not unread messages

### Step 3: Ensure No Accidental Rendering

Check that `unreadCount` is NOT being rendered anywhere as plain text (e.g., in a description, subtitle, or debugging element left in production).

## Proposed Fix

If the issue is `unreadCount: 0` showing as plain text somewhere, we need to:

1. Remove any accidental `{group.unreadCount}` text rendering
2. Ensure only the styled badge shows unreadCount
3. Verify backend data structure is correct

### Implementation

Add explicit check to prevent rendering "0":

```tsx
{group.unreadCount && group.unreadCount > 0 && (
  <div className="absolute -bottom-1 -left-1 ...">
    {group.unreadCount > 99 ? '99+' : group.unreadCount}
  </div>
)}
```

This already exists! So the issue must be:
- Backend returning wrong data
- OR there's another place rendering unreadCount we haven't found

## Next Steps

1. **Add Debug Logging** (temporary)
2. **User provides screenshot** showing both indicators
3. **Check browser DevTools** - inspect element showing "0"
4. **Verify backend response** - check API /api/groups returns correct data structure

## Files to Check

- `client/src/pages/Messages.tsx` - Lines 1213-1253 (group list rendering)
- `server/storage.ts` - `getUserGroups()` function
- Backend API response for `/api/groups`

## Temporary Debug Code

Add this before the group list rendering (line 1213):

```tsx
{groups.length > 0 && console.log('[GROUPS DATA]', groups.map(g => ({
  name: g.name,
  unreadCount: g.unreadCount,
  memberCount: g.memberCount
})))}
```

This will show in browser console what data is being received.

## Status

⏸️ **Awaiting More Information**
- Need screenshot or browser DevTools inspection
- Need console log output to see data structure
- Need confirmation of where "0" text appears

Once we identify the exact source, we can implement targeted fix.
