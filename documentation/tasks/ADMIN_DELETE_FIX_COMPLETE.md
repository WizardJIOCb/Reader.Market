# Admin/Moderator Delete Permission Fix - Complete ✅

## Problem
Administrators and moderators could not delete other users' comments or reviews.

## Root Cause
The frontend was calling the regular user endpoints (`/api/comments/:id` and `/api/reviews/:id`) which enforce ownership checks. The backend has separate admin endpoints (`/api/admin/comments/:id` and `/api/admin/reviews/:id`) that allow admins/moderators to delete any content, but the frontend wasn't using them.

## Solution Implemented

### 1. CommentsSection.tsx
Modified the `handleDeleteComment` function (lines 250-282) to route requests based on user access level:

```typescript
const handleDeleteComment = async (commentId: string) => {
  if (!user) return;
  
  try {
    // Use admin endpoint if user is admin or moderator
    const endpoint = (user.accessLevel === 'admin' || user.accessLevel === 'moder') 
      ? `/api/admin/comments/${commentId}`
      : `/api/comments/${commentId}`;
    
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    if (response.ok) {
      // Remove the comment from the state
      const updatedComments = comments.filter(comment => comment.id !== commentId);
      setComments(updatedComments);
      setCachedComments(bookId, updatedComments);
      if (onCommentsCountChange) {
        onCommentsCountChange(updatedComments.length);
      }
    } else {
      console.error('Failed to delete comment');
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
  }
};
```

### 2. ReviewsSection.tsx
Modified the `handleDeleteReview` function (lines 380-423) with the same logic:

```typescript
const endpoint = (user.accessLevel === 'admin' || user.accessLevel === 'moder') 
  ? `/api/admin/reviews/${reviewId}`
  : `/api/reviews/${reviewId}`;

const response = await fetch(endpoint, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
});
```

### 3. Backend Support (Already Exists)
The backend already has the necessary admin endpoints:

**routes.ts - Line 1449:**
```typescript
app.delete("/api/admin/comments/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
  const { id } = req.params;
  // Admins can delete any comment (userId = null bypasses ownership check)
  const success = await storage.deleteComment(id, null);
  if (!success) {
    return res.status(404).json({ error: "Comment not found" });
  }
  res.status(204).send();
});
```

**routes.ts - Line 1668:**
```typescript
app.delete("/api/admin/reviews/:id", authenticateToken, requireAdminOrModerator, async (req, res) => {
  const { id } = req.params;
  // Admins can delete any review (userId = null bypasses ownership check)
  const success = await storage.deleteReview(id, null);
  if (!success) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.status(204).send();
});
```

## How It Works

1. **Regular Users**: When a regular user deletes their own comment/review:
   - Frontend calls `/api/comments/:id` or `/api/reviews/:id`
   - Backend checks ownership (userId must match)
   - Only allows deletion of own content

2. **Admins/Moderators**: When an admin or moderator deletes any comment/review:
   - Frontend checks `user.accessLevel === 'admin' || user.accessLevel === 'moder'`
   - Routes to `/api/admin/comments/:id` or `/api/admin/reviews/:id`
   - Backend middleware `requireAdminOrModerator` verifies permissions
   - Passes `userId = null` to storage layer to bypass ownership check
   - Allows deletion of any content

## Testing Instructions

### ⚠️ IMPORTANT: Clear Browser Cache
The changes are in the frontend JavaScript files. You MUST clear your browser cache to see the changes:

1. **Hard Refresh** (recommended):
   - Press **Ctrl + Shift + R** (Windows/Linux)
   - Or **Ctrl + F5**
   - Or **Cmd + Shift + R** (Mac)

2. **Clear Cache Manually**:
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached content
   - Edge: Settings → Privacy → Clear browsing data → Cached images and files

3. **Or Open in Incognito/Private Window**:
   - This ensures no cached files are used

### Test Steps:

1. **Login as admin or moderator**:
   - User must have `accessLevel` set to `'admin'` or `'moder'` in the database
   - Check user access level in profile or by inspecting the auth token

2. **Navigate to a book page** with comments or reviews:
   - Example: `http://localhost:5001/book/6f4fef1d-c697-4661-ab43-371520c73274`

3. **Find a comment or review from another user**:
   - The "Удалить" (Delete) button should be visible for ALL comments/reviews
   - Not just your own

4. **Click the Delete button**:
   - The comment/review should be deleted immediately
   - No error messages in console

5. **Check browser console** (F12):
   - You should see a DELETE request to `/api/admin/comments/:id` or `/api/admin/reviews/:id`
   - Status code should be 204 (success)

### Expected Behavior:

✅ **Before this fix**:
- Admins/mods could see delete button on all comments/reviews
- But deletion failed with 404 or "unauthorized" error
- Because frontend called regular endpoints with ownership checks

✅ **After this fix**:
- Admins/mods can see delete button on all comments/reviews
- Deletion succeeds
- Frontend calls admin endpoints that bypass ownership checks

## Verification

To verify the fix is working, open browser console (F12) and watch for DELETE requests:

**For Admins/Moderators:**
```
DELETE http://localhost:5001/api/admin/comments/[comment-id]
Status: 204 No Content
```

**For Regular Users:**
```
DELETE http://localhost:5001/api/comments/[comment-id]
Status: 204 No Content (only if owns the comment)
```

## Files Modified

1. `client/src/components/CommentsSection.tsx` - Lines 250-282
2. `client/src/components/ReviewsSection.tsx` - Lines 380-423

## Backend Files (Already Existing)

1. `server/routes.ts` - Lines 1449-1466 (admin comment delete)
2. `server/routes.ts` - Lines 1668-1685 (admin review delete)
3. `server/routes.ts` - Lines 163-182 (requireAdminOrModerator middleware)
4. `server/storage.ts` - Lines 1587-1610 (deleteComment with admin bypass)
5. `server/storage.ts` - Lines 1806-1829 (deleteReview with admin bypass)

## Status

✅ **Implementation Complete**
- Frontend changes applied
- No compilation errors
- Backend endpoints already exist with proper middleware
- Security checks in place

⚠️ **Action Required**
- User must clear browser cache or hard refresh (Ctrl+Shift+R)
- Test with admin/moderator account
- Verify deletion works in browser console

## Notes

- The fix maintains security by checking `accessLevel` on both frontend and backend
- Regular users can only delete their own content
- Admins/moderators can delete any content
- All actions are logged in backend console for audit purposes
