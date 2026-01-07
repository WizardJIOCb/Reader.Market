# Group Channel and Member Deletion Fix - 2026-01-07

## Problem

DELETE requests for both channels and members were returning 204 No Content (success) but resources were not actually being removed from the database or UI.

### Issues Identified

1. **Channel Deletion**: Channels were being soft-deleted (archivedAt timestamp set) but `getGroupChannels()` was not filtering out archived channels
2. **Member Removal**: The route was treating `memberId` parameter as a userId, but frontend was sending the group_members table ID (membership record ID)

## Root Causes

### Channel Deletion Issue

**File**: `server/storage.ts` (lines 3213-3224)

The `getGroupChannels()` method was retrieving ALL channels for a group, including archived ones:

```typescript
// BEFORE - Wrong
async getGroupChannels(groupId: string): Promise<any[]> {
  const result = await db.select()
    .from(channels)
    .where(eq(channels.groupId, groupId))  // No archived filter!
    .orderBy(asc(channels.displayOrder));
  return result;
}
```

The `deleteChannel()` method correctly archived channels, but they remained visible:

```typescript
async deleteChannel(id: string): Promise<void> {
  await db.update(channels)
    .set({ archivedAt: new Date() })  // Soft delete
    .where(eq(channels.id, id));
}
```

### Member Removal Issue

**File**: `server/routes.ts` (line 2705-2729)

The route was treating `memberId` as a userId:

```typescript
// BEFORE - Wrong
app.delete("/api/groups/:groupId/members/:memberId", ...)
  const memberRole = await storage.getGroupMemberRole(groupId, memberId);
  // memberId is actually group_members.id, not users.id!
  await storage.removeGroupMember(groupId, memberId);
```

**File**: `server/storage.ts` (line 3106-3119)

The `removeGroupMember()` method expected userId but received membership ID:

```typescript
// BEFORE - Wrong
async removeGroupMember(groupId: string, userId: string): Promise<void> {
  await db.delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)  // Wrong! This is membership ID
      )
    );
}
```

## Solutions Implemented

### Fix 1: Filter Archived Channels

**File**: `server/storage.ts`

Added `isNull()` import and updated `getGroupChannels()`:

```typescript
// Import added
import { eq, and, inArray, desc, asc, sql, or, ilike, isNull } from "drizzle-orm";

// AFTER - Correct
async getGroupChannels(groupId: string): Promise<any[]> {
  const result = await db.select()
    .from(channels)
    .where(
      and(
        eq(channels.groupId, groupId),
        isNull(channels.archivedAt)  // Filter out archived channels
      )
    )
    .orderBy(asc(channels.displayOrder));
  return result;
}
```

### Fix 2: Delete Member by Membership ID

**File**: `server/storage.ts`

Updated `removeGroupMember()` to delete by membership ID directly:

```typescript
// AFTER - Correct
async removeGroupMember(groupId: string, membershipId: string): Promise<void> {
  await db.delete(groupMembers)
    .where(eq(groupMembers.id, membershipId));  // Delete by membership ID
}
```

**File**: `server/routes.ts`

Updated route to fetch member record to check role:

```typescript
// AFTER - Correct
app.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
  const requesterRole = await storage.getGroupMemberRole(groupId, userId);
  
  // Get the member to be removed to check their role
  const members = await storage.getGroupMembers(groupId);
  const memberToRemove = members.find(m => m.id === memberId);
  
  if (!memberToRemove) {
    return res.status(404).json({ error: "Member not found" });
  }
  
  // Moderators can't remove admins
  if (requesterRole === 'moderator' && memberToRemove.role === 'administrator') {
    return res.status(403).json({ error: "Moderators cannot remove administrators" });
  }
  
  await storage.removeGroupMember(groupId, memberId);
  res.status(204).send();
});
```

### Fix 3: Frontend Direct Backend URLs (Already Completed)

**File**: `client/src/components/GroupSettingsPanel.tsx`

All API calls updated to bypass Vite proxy in development:

```typescript
const apiUrl = import.meta.env.DEV 
  ? `http://localhost:5001/api/groups/${groupId}/channels/${channelId}`
  : `/api/groups/${groupId}/channels/${channelId}`;
```

Applied to:
- `fetchMembers()`
- `fetchChannels()`
- `searchUsers()`
- `addMember()`
- `updateMemberRole()`
- `createChannel()`
- `deleteChannel()`
- `removeMember()`

## Files Modified

1. **server/storage.ts**
   - Added `isNull` import
   - Updated `getGroupChannels()` to filter archived channels
   - Updated `removeGroupMember()` to delete by membership ID

2. **server/routes.ts**
   - Updated DELETE `/api/groups/:groupId/members/:memberId` route to properly handle membership ID

3. **client/src/components/GroupSettingsPanel.tsx** (already completed in previous fix)
   - Updated all API calls to use direct backend URLs

## Testing

After applying these fixes:

1. ✅ Deleting a channel should remove it from the channel list immediately
2. ✅ Deleting a member should remove them from the members list immediately
3. ✅ Archived channels should not appear in channel selectors
4. ✅ Only admins and moderators can delete channels
5. ✅ Moderators cannot remove administrators
6. ✅ UI updates happen automatically via callbacks

## Related Issues

This fix addresses the issue where:
- DELETE requests returned 204 No Content
- But resources remained visible in the UI
- Root causes were:
  1. Soft-deleted channels not being filtered
  2. Member deletion using wrong identifier (userId vs membershipId)
