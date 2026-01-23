# Group Deletion Feature - 2026-01-07

## Summary

Added a "Delete Group" button in group settings with a confirmation dialog. Only administrators can delete groups.

## Features Implemented

### 1. New "Danger Zone" Tab

**File**: `client/src/components/GroupSettingsPanel.tsx`

Added a third tab in group settings visible only to administrators:
- Tab shows as "Опасная зона" (Danger Zone) with a trash icon
- Contains a red-bordered card with delete group button
- Only visible when `isAdmin` is true

### 2. Delete Group Functionality

**Function**: `deleteGroup()`

- Uses DELETE `/api/groups/:groupId` endpoint
- Bypasses Vite proxy with direct backend URL in development
- Shows success toast on deletion
- Calls `onGroupDeleted` callback to notify parent
- Closes settings panel after successful deletion

**Backend Endpoint**: Already exists at `server/routes.ts` line 2617
- Checks if user is the group creator
- Only creator can delete the group
- Soft-deletes the group (sets `deletedAt` timestamp)

### 3. Confirmation Dialog

Two-step confirmation process:
1. Click "Удалить группу навсегда" button in Danger Zone tab
2. Confirm in AlertDialog with clear warning message

**Dialog Features**:
- Red title: "Удалить группу?"
- Strong warning about permanent deletion
- Clear message: "Все участники, каналы и сообщения будут удалены"
- Cancel button to abort
- Red "Да, удалить группу" button to confirm

### 4. Parent Component Integration

**File**: `client/src/pages/Messages.tsx`

Added `onGroupDeleted` callback that:
1. Clears selected group
2. Clears selected channel
3. Clears messages
4. Refreshes groups list

This ensures the UI properly updates after group deletion.

## User Flow

1. Administrator opens group settings (⚙️ icon)
2. Navigates to "Опасная зона" tab
3. Sees warning card about group deletion
4. Clicks "Удалить группу навсегда" button
5. Confirmation dialog appears with strong warnings
6. Confirms deletion
7. Group is deleted from database
8. UI updates: settings close, group list refreshes, selection cleared
9. Success toast appears

## Technical Details

### Component Props

```typescript
interface GroupSettingsPanelProps {
  groupId: string;
  isAdmin: boolean;
  isModerator: boolean;
  onClose?: () => void;
  onChannelsChange?: () => void;
  onMembersChange?: () => void;
  onGroupDeleted?: () => void;  // NEW
}
```

### State Management

```typescript
const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
```

### API Call

```typescript
const deleteGroup = async () => {
  const apiUrl = import.meta.env.DEV 
    ? `http://localhost:5001/api/groups/${groupId}`
    : `/api/groups/${groupId}`;
  
  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });
  
  if (response.ok) {
    // Success handling
    if (onGroupDeleted) onGroupDeleted();
    if (onClose) onClose();
  }
};
```

### UI Layout Changes

- TabsList changed from `grid-cols-2` to `grid-cols-3`
- Third tab only rendered when `isAdmin` is true
- Danger Zone tab uses red color scheme for warnings

## Files Modified

1. **client/src/components/GroupSettingsPanel.tsx**
   - Added `onGroupDeleted` prop
   - Added `deleteGroupDialogOpen` state
   - Added `deleteGroup()` function
   - Added "Danger Zone" tab (admin only)
   - Added delete group confirmation dialog

2. **client/src/pages/Messages.tsx**
   - Added `onGroupDeleted` callback to GroupSettingsPanel
   - Callback clears selection and refreshes groups list

## Security

- Only administrators can see the delete button
- Backend verifies user is the group creator
- Two-step confirmation prevents accidental deletion
- Clear warning messages about permanent data loss

## Backend Support

The backend endpoint already exists and properly handles:
- Permission checking (creator only)
- Soft deletion (sets deletedAt timestamp)
- Returns 204 No Content on success
- Returns 403 Forbidden if not creator
- Returns 404 Not Found if group doesn't exist

## Testing Checklist

After implementing:
1. ✅ Only administrators see "Опасная зона" tab
2. ✅ Delete button shows clear warnings
3. ✅ Confirmation dialog appears on click
4. ✅ Cancel button aborts deletion
5. ✅ Confirm button deletes group
6. ✅ UI clears selection after deletion
7. ✅ Groups list refreshes
8. ✅ Success toast appears
9. ✅ Settings panel closes
10. ✅ Backend returns 204 on success
11. ✅ Backend rejects non-creators with 403

## Visual Design

The Danger Zone tab uses destructive styling:
- Red border on card (`border-destructive`)
- Red title text (`text-destructive`)
- Red delete button (`variant="destructive"`)
- Warning icon (Trash2)
- Clear, bold warning messages
