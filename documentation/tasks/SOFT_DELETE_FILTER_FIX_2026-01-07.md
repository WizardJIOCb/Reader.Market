# Soft Delete Filter Fix - 2026-01-07

## Problem

After deleting a group via DELETE `/api/groups/:groupId`, the group was still appearing in the groups list when fetching GET `/api/groups`. 

**Root Cause**: The backend was performing a "soft delete" (setting `deletedAt` timestamp) but the storage methods were not filtering out deleted groups.

## Issue Details

**Observed Behavior**:
- DELETE `http://localhost:5001/api/groups/edfcb3a6-85f0-4c56-b86d-24917fbc17ef` returns 204 No Content (success)
- GET `http://localhost:3001/api/groups` still shows the deleted group in the list
- The group remained visible in the UI

**Backend Logic**:
The `deleteGroup()` method (line 3086-3094) performs a soft delete:
```typescript
async deleteGroup(id: string): Promise<void> {
  await db.update(groups)
    .set({ deletedAt: new Date() })  // Soft delete
    .where(eq(groups.id, id));
}
```

However, the following methods did not filter out soft-deleted groups:
1. `getGroup(id)` - Gets a single group
2. `getUserGroups(userId)` - Gets user's groups list
3. `searchGroups(query)` - Searches public groups

## Solution Implemented

### 1. Filter Deleted Groups in getUserGroups

**File**: `server/storage.ts` (line 3013-3049)

Added `isNull(groups.deletedAt)` filter to the WHERE clause:

```typescript
// BEFORE
.where(eq(groupMembers.userId, userId));

// AFTER
.where(
  and(
    eq(groupMembers.userId, userId),
    isNull(groups.deletedAt)
  )
);
```

**Effect**: Deleted groups no longer appear in user's groups list.

### 2. Filter Deleted Groups in searchGroups

**File**: `server/storage.ts` (line 3051-3071)

Added `isNull(groups.deletedAt)` filter to search:

```typescript
// BEFORE
.where(
  and(
    eq(groups.privacy, 'public'),
    or(
      ilike(groups.name, `%${query}%`),
      ilike(groups.description, `%${query}%`)
    )
  )
)

// AFTER
.where(
  and(
    eq(groups.privacy, 'public'),
    isNull(groups.deletedAt),  // NEW
    or(
      ilike(groups.name, `%${query}%`),
      ilike(groups.description, `%${query}%`)
    )
  )
)
```

**Effect**: Deleted groups no longer appear in search results.

### 3. Filter Deleted Groups in getGroup

**File**: `server/storage.ts` (line 3003-3017)

Added `isNull(groups.deletedAt)` filter:

```typescript
// BEFORE
const result = await db.select()
  .from(groups)
  .where(eq(groups.id, id));

// AFTER
const result = await db.select()
  .from(groups)
  .where(
    and(
      eq(groups.id, id),
      isNull(groups.deletedAt)
    )
  );
```

**Effect**: 
- Attempting to access a deleted group by ID returns `undefined`
- API endpoints will return 404 Not Found for deleted groups
- Deleted groups cannot be reopened or accessed

## Files Modified

**server/storage.ts**:
1. `getGroup()` - Added deletedAt filter
2. `getUserGroups()` - Added deletedAt filter
3. `searchGroups()` - Added deletedAt filter

## Testing

After applying these fixes:

1. ✅ Delete a group via DELETE `/api/groups/:groupId`
2. ✅ Verify GET `/api/groups` does not include the deleted group
3. ✅ Verify GET `/api/groups/:groupId` returns 404 for deleted group
4. ✅ Verify search does not return deleted groups
5. ✅ Verify UI removes deleted group from list immediately
6. ✅ Verify deleted group cannot be accessed

## Soft Delete Pattern

The system uses soft deletion for groups:
- Groups are not physically deleted from the database
- Instead, `deletedAt` timestamp is set
- All queries filter out records where `deletedAt IS NOT NULL`

**Benefits**:
- Data recovery is possible if needed
- Maintains referential integrity
- Audit trail of deleted groups
- Can analyze deletion patterns

**Considerations**:
- Database grows over time with deleted records
- Need periodic cleanup job for old deleted records (optional)
- All queries must include deletedAt filter

## Related Code Pattern

This same pattern should be used for other soft-deleted entities:
- Check if `deletedAt` field exists
- Always filter with `isNull(entity.deletedAt)` in queries
- Never return soft-deleted records to the client

## Migration Note

No database migration required - the `deletedAt` column already exists in the groups table. This fix only adds proper filtering logic.

## API Behavior Changes

**Before Fix**:
- GET `/api/groups` - Returned deleted groups ❌
- GET `/api/groups/:groupId` - Returned deleted group ❌
- GET `/api/groups/search?q=...` - Returned deleted groups ❌

**After Fix**:
- GET `/api/groups` - Excludes deleted groups ✅
- GET `/api/groups/:groupId` - Returns 404 for deleted group ✅
- GET `/api/groups/search?q=...` - Excludes deleted groups ✅

## Impact

- **Users**: Deleted groups immediately disappear from UI
- **API**: Consistent behavior across all group endpoints
- **Database**: Maintains deleted records for audit purposes
- **Performance**: Minimal impact (indexed deletedAt column)
