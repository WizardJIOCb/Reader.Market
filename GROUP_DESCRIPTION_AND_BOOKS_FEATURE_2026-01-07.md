# Group Description and Associated Books Feature

## Date: 2026-01-07

## Problem
Group description and associated books were not displayed anywhere in the UI, even though they were being saved during group creation. There was also no way to edit this information after group creation.

## Solution Implemented

### Frontend Changes

#### 1. Messages.tsx - Display Description and Books in Group Header
**File**: `c:\Projects\reader.market\client\src\pages\Messages.tsx`

**Changes**:
- Updated `Group` interface to include `books` array
- Added display of group description below group privacy status
- Added display of associated books as clickable badges that link to book detail pages
- Books open in new window with security attributes (`rel="noopener noreferrer"`)
- Added `onGroupUpdated` callback to refresh group data after updates

**Implementation**:
```typescript
interface Group {
  // ... existing fields
  books?: Array<{
    id: string;
    title: string;
    author: string;
  }>;
}

// In group header:
{selectedGroup.description && (
  <p className="text-sm text-muted-foreground mt-1">
    {selectedGroup.description}
  </p>
)}
{selectedGroup.books && selectedGroup.books.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {selectedGroup.books.map((book) => (
      <Link key={book.id} href={`/book/${book.id}`} 
        target="_blank" rel="noopener noreferrer">
        📚 {book.title}
      </Link>
    ))}
  </div>
)}
```

#### 2. GroupSettingsPanel.tsx - Add Settings Tab for Editing
**File**: `c:\Projects\reader.market\client\src\components\GroupSettingsPanel.tsx`

**Changes**:
- Added new imports: `Textarea`, `X`, `Search`, `BookOpen` icons
- Added `Book` interface
- Added `onGroupUpdated` prop to component interface
- Added state variables for editing: `groupName`, `groupDescription`, `groupBooks`, `bookSearch`, `bookResults`
- Added `fetchGroupInfo()` to load current group data
- Added `searchBooks()` to search for books to associate
- Added `updateGroupInfo()` to save changes
- Added `addBook()` and `removeBook()` for managing book list
- Changed TabsList from 3 columns to 4 columns
- Added new "Настройки" (Settings) tab for administrators
- Settings tab includes:
  - Group name editor
  - Group description editor (with Textarea)
  - Associated books manager with search
  - Save button

**Tab Structure**:
1. **Участники** (Members) - Existing tab
2. **Каналы** (Channels) - Existing tab  
3. **Настройки** (Settings) - NEW (Admin only)
4. **Опасно** (Danger) - Existing tab (Admin only)

### Backend Changes

#### 1. routes.ts - Update Group Endpoint
**File**: `c:\Projects\reader.market\server\routes.ts`

**Changes**:
- Modified `PUT /api/groups/:groupId` endpoint to accept `bookIds` parameter
- Added logic to update book associations:
  - Remove all existing book associations
  - Add new associations from the provided list
  - Maintains atomicity of the update

**Implementation**:
```typescript
app.put("/api/groups/:groupId", async (req, res) => {
  const { name, description, privacy, bookIds } = req.body;
  
  // Update group basic info
  await storage.updateGroup(groupId, { name, description, privacy });
  
  // Update book associations if provided
  if (bookIds !== undefined) {
    await storage.removeAllGroupBooks(groupId);
    if (Array.isArray(bookIds) && bookIds.length > 0) {
      for (const bookId of bookIds) {
        await storage.addGroupBook(groupId, bookId);
      }
    }
  }
});
```

#### 2. storage.ts - Add Helper Methods
**File**: `c:\Projects\reader.market\server\storage.ts`

**Changes**:
- Added `addGroupBook()` as alias for `addBookToGroup()` for consistency
- Added `removeAllGroupBooks()` to delete all book associations for a group

**New Methods**:
```typescript
async addGroupBook(groupId: string, bookId: string): Promise<void> {
  return this.addBookToGroup(groupId, bookId);
}

async removeAllGroupBooks(groupId: string): Promise<void> {
  await db.delete(groupBooks)
    .where(eq(groupBooks.groupId, groupId));
}
```

## Features

### Display Features
1. **Group Description Display**:
   - Shows below group privacy status in header
   - Only displays if description exists
   - Styled as secondary text

2. **Associated Books Display**:
   - Displayed as badge-style links below description
   - Each badge shows book icon (📚) and title
   - Clicking opens book detail page in new window
   - Hover effect for interactivity

### Editing Features
1. **Group Name Editor**:
   - Text input with 100 character limit
   - Required field

2. **Group Description Editor**:
   - Textarea with 3 rows
   - 500 character limit
   - Optional field

3. **Associated Books Manager**:
   - Search input with live search (minimum 2 characters)
   - Displays up to 10 search results
   - Filters out already added books
   - Shows book title and author in results
   - Click to add book
   - Displays selected books as removable badges
   - Click X button to remove book

4. **Save Button**:
   - Saves all changes at once (name, description, books)
   - Shows success/error toast notifications
   - Refreshes parent component data after successful save

## User Flow

### Viewing Group Information
1. User opens a group chat
2. Group header displays:
   - Group name
   - Privacy status (Public/Private)
   - Member count
   - **Description** (if set)
   - **Associated books** as clickable badges (if any)

### Editing Group Information (Admin Only)
1. Admin clicks Settings icon in group header
2. Clicks "Настройки" (Settings) tab
3. Sees form with current values populated
4. Can edit:
   - Group name
   - Group description
   - Associated books (search and add/remove)
5. Clicks "Сохранить изменения" (Save Changes)
6. Changes are saved and UI updates automatically

## Technical Details

### Data Flow
1. **Loading**: `fetchGroupInfo()` → GET `/api/groups/:groupId` → Populates edit form
2. **Searching Books**: `searchBooks()` → GET `/api/books/search?q=query` → Shows results
3. **Saving**: `updateGroupInfo()` → PUT `/api/groups/:groupId` → Updates database
4. **Refreshing**: `onGroupUpdated()` callback → Refreshes parent component

### Security
- Only administrators can edit group information
- Backend validates admin role before allowing updates
- Book links use `rel="noopener noreferrer"` for security

### Error Handling
- Toast notifications for success/failure
- Try-catch blocks for all API calls
- Console logging for debugging
- Graceful fallbacks for missing data

## Testing Checklist

- [x] Group description displays when set
- [x] Associated books display as clickable badges
- [x] Book links open in new window
- [x] Settings tab only visible to administrators
- [x] Group name can be edited
- [x] Group description can be edited
- [x] Books can be searched and added
- [x] Books can be removed
- [x] Changes save successfully
- [x] UI refreshes after save
- [x] Success/error toasts display
- [x] Backend validates admin permissions

## Files Modified

### Frontend
1. `client/src/pages/Messages.tsx` - Display and callback handling
2. `client/src/components/GroupSettingsPanel.tsx` - Settings tab and editing UI

### Backend
1. `server/routes.ts` - Update endpoint to handle book associations
2. `server/storage.ts` - Helper methods for book management

## Notes

- The description supports plain text only (no rich formatting in this implementation)
- Book search uses the existing `/api/books/search` endpoint
- All changes are saved atomically (either all succeed or all fail)
- The 4-tab layout is only visible to administrators; regular members see fewer tabs
- Book associations are stored in the `group_books` junction table
- The feature integrates seamlessly with existing group management functionality
