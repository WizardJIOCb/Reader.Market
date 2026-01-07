# Group Books Display Fix - 2026-01-07

## Problem
When opening a group, associated books were not displayed under the group name. Books only appeared after editing and saving in settings, and disappeared again after page reload.

## Root Cause
The `fetchGroups()` function was calling `/api/groups` which returns a list of groups with basic information but **without** the associated books. When users clicked on a group, the code was setting `selectedGroup` directly from this basic list, which didn't include the `books` array.

## Solution

### Frontend Changes - Messages.tsx

#### 1. Added `fetchGroupDetails()` Function
Created a new function to fetch full group details including books:

```typescript
const fetchGroupDetails = async (groupId: string) => {
  try {
    console.log('Fetching full group details for:', groupId);
    const response = await fetch(`/api/groups/${groupId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    console.log('Group details response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Group details received:', data);
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch group details:', error);
    return null;
  }
};
```

This function calls `GET /api/groups/:groupId` which returns:
- Group basic info (name, description, privacy)
- Channels
- Members with memberCount
- **Associated books array**

#### 2. Updated Group List Click Handler
Changed the onClick handler for groups in the list to fetch full details:

**Before:**
```typescript
onClick={() => setSelectedGroup(group)}
```

**After:**
```typescript
onClick={async () => {
  // Fetch full group details including books
  const fullGroupDetails = await fetchGroupDetails(group.id);
  if (fullGroupDetails) {
    setSelectedGroup(fullGroupDetails);
  }
}}
```

#### 3. Updated Search Result Click Handler
Also updated the search result handler for consistency:

**Before:**
```typescript
if (joined) {
  setSelectedGroup(group);
}
```

**After:**
```typescript
if (joined) {
  // Fetch full group details before selecting
  const fullGroupDetails = await fetchGroupDetails(group.id);
  if (fullGroupDetails) {
    setSelectedGroup(fullGroupDetails);
  }
}
```

### Backend Verification
The backend endpoint `GET /api/groups/:groupId` (lines 2558-2591 in routes.ts) already correctly returns:
```typescript
const books = await storage.getGroupBooks(groupId);
res.json({ ...group, channels, members, books, memberCount });
```

So no backend changes were needed - the data was available, just not being fetched by the frontend.

## Benefits

1. **Books Always Display**: Books now show immediately when opening a group
2. **Persistent Display**: Books remain visible after page reload
3. **Consistent Data**: The group object always has complete information
4. **Better UX**: No need to edit settings to see books

## Technical Flow

### Old Flow (Broken)
1. User loads Messages page
2. `fetchGroups()` calls `/api/groups` → Returns list without books
3. User clicks group
4. `setSelectedGroup(group)` → Group has no books array
5. **Books don't display** ❌

### New Flow (Fixed)
1. User loads Messages page
2. `fetchGroups()` calls `/api/groups` → Returns list without books (for listing only)
3. User clicks group
4. `fetchGroupDetails(groupId)` calls `/api/groups/:groupId` → Returns **full details with books**
5. `setSelectedGroup(fullGroupDetails)` → Group has books array
6. **Books display correctly** ✅

## Additional Notes

- The book links already had `target="_blank"` and `rel="noopener noreferrer"` from the previous implementation
- Books open in new window when clicked (as requested)
- The fix is minimal and doesn't affect other functionality
- Console logging added for debugging
- The solution is consistent with the existing pattern used for fetching user role and channels

## Files Modified

1. `client/src/pages/Messages.tsx`
   - Added `fetchGroupDetails()` function
   - Updated group list click handler
   - Updated search result click handler

## Testing Checklist

- [x] Books display when opening a group for the first time
- [x] Books persist after page reload
- [x] Books display after joining a new group via search
- [x] Books links open in new window
- [x] Group description also displays (from previous feature)
- [x] No console errors
- [x] No impact on existing functionality
