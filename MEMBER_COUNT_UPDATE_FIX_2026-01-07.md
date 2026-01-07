# Member Count Update Fix - 2026-01-07

## Problem

When adding or removing members from a group, the member count was not updating in:
1. The groups list (left sidebar)
2. The selected group header (below group name)

## Root Cause

The GroupSettingsPanel component was updating its local member list, but wasn't notifying the parent Messages component to refresh the group data with the updated member count.

## Solution Implemented

### 1. Added Member Change Callback to GroupSettingsPanel

**File**: `client/src/components/GroupSettingsPanel.tsx`

Added new prop `onMembersChange` to notify parent component when members are added or removed:

```typescript
interface GroupSettingsPanelProps {
  groupId: string;
  isAdmin: boolean;
  isModerator: boolean;
  onClose?: () => void;
  onChannelsChange?: () => void;
  onMembersChange?: () => void;  // NEW
}
```

Updated `addMember()` function to call the callback:

```typescript
const addMember = async (userId: string) => {
  // ... API call
  if (response.ok) {
    toast({ title: 'Успех', description: 'Участник добавлен в группу' });
    setUserSearch('');
    setSearchResults([]);
    // Refresh members locally in the panel
    await fetchMembers();
    // Notify parent component to refresh member count
    if (onMembersChange) {
      onMembersChange();
    }
  }
};
```

Updated `removeMember()` function to call the callback:

```typescript
const removeMember = async (memberId: string) => {
  // ... API call
  if (response.ok) {
    toast({ title: 'Успех', description: 'Участник удален из группы' });
    setMemberToRemove(null);
    // Refresh members locally in the panel
    await fetchMembers();
    // Notify parent component to refresh member count
    if (onMembersChange) {
      onMembersChange();
    }
  }
};
```

### 2. Updated Messages Component to Handle Member Changes

**File**: `client/src/pages/Messages.tsx`

Added `onMembersChange` callback that:
1. Refreshes the entire groups list (updates member count in sidebar)
2. Re-fetches the selected group details (updates member count in header)

```typescript
<GroupSettingsPanel
  groupId={selectedGroup.id}
  isAdmin={userGroupRole === 'administrator'}
  isModerator={userGroupRole === 'moderator'}
  onClose={() => {
    setGroupSettingsOpen(false);
    fetchChannels(selectedGroup.id);
  }}
  onChannelsChange={() => {
    if (selectedGroup) {
      fetchChannels(selectedGroup.id);
    }
  }}
  onMembersChange={() => {
    // Refresh groups list to update member count
    fetchGroups();
    // Re-fetch selected group to update its member count in header
    if (selectedGroup) {
      fetch(`/api/groups/${selectedGroup.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      }).then(res => res.json()).then(updatedGroup => {
        setSelectedGroup(updatedGroup);
      }).catch(err => console.error('Failed to refresh group:', err));
    }
  }}
/>
```

### 3. Added Member Count to Single Group Endpoint

**File**: `server/routes.ts`

Updated GET `/api/groups/:groupId` endpoint to include `memberCount` field:

```typescript
app.get("/api/groups/:groupId", authenticateToken, async (req, res) => {
  // ... get group, channels, members, books
  
  // Add member count
  const memberCount = members.length;
  
  res.json({ ...group, channels, members, books, memberCount });
});
```

Note: The GET `/api/groups` endpoint already included `memberCount` via the `getUserGroups()` storage method.

## Files Modified

1. **client/src/components/GroupSettingsPanel.tsx**
   - Added `onMembersChange` prop
   - Updated `addMember()` to call callback after success
   - Updated `removeMember()` to call callback after success

2. **client/src/pages/Messages.tsx**
   - Added `onMembersChange` callback to GroupSettingsPanel
   - Callback refreshes groups list and selected group details

3. **server/routes.ts**
   - Updated GET `/api/groups/:groupId` to include `memberCount`

## Testing

After applying these fixes:

1. ✅ Adding a member updates the count in the groups list
2. ✅ Adding a member updates the count in the group header
3. ✅ Removing a member updates the count in the groups list
4. ✅ Removing a member updates the count in the group header
5. ✅ Member count displays correctly: "• N участников"

## Related Fixes

This follows the same callback pattern used for channel updates:
- `onChannelsChange` - notifies parent when channels are created/deleted
- `onMembersChange` - notifies parent when members are added/removed
