# Profile Shelf Layout Adjustment

## Overview

Adjust the profile page layout to improve book and shelf display density by matching the grid layout used in the "My Shelves" page. Additionally, reposition the "Share Profile" button to align with other action buttons in the header, implement functional profile sharing with clipboard copy functionality, and realign header buttons to the left.

## Problem Statement

### Current State

1. **Profile Page Book Grid**: Books and shelves display 5 items per row on desktop (`grid-cols-5`), which causes content overflow and horizontal scrolling issues on standard screen sizes.

2. **Recently Read Section**: Uses inconsistent grid layout with `grid-cols-3` for recently read books, but still faces display issues.

3. **Share Profile Button Position**: The "Share Profile" button is positioned below the user info section, separated from other action buttons (Edit Profile, Logout), creating visual inconsistency.

### Target State

1. **Consistent Grid Layout**: Match the "My Shelves" page grid system that uses 3 columns on desktop (`lg:grid-cols-3`), 2 columns on tablets (`sm:grid-cols-2`), and 1 column on mobile (`grid-cols-1`).

2. **Button Repositioning**: Move the "Share Profile" button to the header action button group, positioned before the "Logout" button for better visual hierarchy and accessibility.

## Scope

### In Scope

- Adjust grid layout for the "Recently Read" section in Profile page
- Adjust grid layout for shelf books display in Profile page
- Reposition "Share Profile" button to header action area
- Realign header action buttons from right to left alignment
- Remove "Delete Avatar" button from header
- Implement clipboard copy functionality for profile sharing
- Display toast notification on successful profile link copy
- Maintain responsive behavior across all device sizes

### Out of Scope

- Changes to BookCard component styling or internal layout
- Modifications to shelf data structure or API
- Changes to other profile page sections (bio, stats, avatar)
- Backend API modifications
- Avatar deletion functionality removal from backend
- Social media sharing integrations (only clipboard copy)
- Profile link shortening or custom URL generation

## Design Details

### Grid Layout Adjustment

#### Recently Read Section

**Current Implementation** (Line 681):
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

**Target Implementation**:
No changes needed - already matches the desired 3-column layout.

#### User Shelves Section

**Current Implementation** (Line 730):
```
grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
```

This creates a progressive grid that reaches 5 columns on large screens, causing overflow.

**Target Implementation**:
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

This matches the "My Shelves" page layout (Shelves.tsx line 554) and ensures consistent 3-column maximum on desktop.

### Button Repositioning and Layout Changes

#### Share Profile Button Relocation

**Current Location** (Lines 590-597):
The "Share Profile" button is positioned within the profile info section, below the username and avatar area.

**Target Location**:
Move to the header action buttons section (around lines 507-542), placing it before the "Logout" button.

#### Header Button Alignment

**Current Alignment**: Right-aligned (flex justify-end behavior)
**Target Alignment**: Left-aligned

#### Delete Avatar Button Removal

**Current State**: "Delete Avatar" button appears in header when user has an avatar (lines 526-537)
**Target State**: Remove this button entirely from the UI

**Layout Structure**:
```
Header Actions (when viewing own profile):
┌─────────────────────────────────────────────────────────────┐
│ [Upload/Change Avatar] [Edit Profile] [Share Profile]      │
│ [Logout]                                                    │
└─────────────────────────────────────────────────────────────┘
```

The button group should maintain:
- Left alignment using flex layout without justify-end
- Consistent spacing using `gap-2`
- `outline` variant for secondary actions
- `sm` size for compact display
- Icon + text combination for clarity
- Dynamic text for avatar button: "Добавить аватар" when no avatar, "Изменить аватар" when avatar exists

## Visual Comparison

### Grid Layout Comparison

| Page | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| My Shelves (Current) | 1 column | 2 columns | 3 columns |
| Profile (Current) | 2 columns | 3 columns | 5 columns |
| Profile (Target) | 1 column | 2 columns | 3 columns |

### Button Position Comparison

**Current Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header              [Camera] [X] [Edit] [Logout]           │
├─────────────────────────────────────────────────────────────┤
│ [Avatar]  Name / Username                                   │
│                                                              │
│           [Share Profile]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Target Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Camera] [Edit] [Share Profile] [Logout]                   │
├─────────────────────────────────────────────────────────────┤
│ [Avatar]  Name / Username                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Note: [X] represents the Delete Avatar button that will be removed

## Implementation Notes

### File to Modify

**Path**: `client/src/pages/Profile.tsx`

### Specific Changes Required

#### Change 1: Adjust Shelf Books Grid Layout

**Location**: Line 730

**Action**: Replace the grid class from `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

**Rationale**: Reduces maximum columns from 5 to 3, preventing horizontal overflow on standard desktop screens while maintaining responsive behavior.

#### Change 2: Realign Header Action Buttons to Left

**Location**: Line 505 (header section)

**Current Implementation**:
```
<header className="flex justify-between items-center mb-8">
  <div></div> {/* Empty div for spacing */}
  {isOwnProfile && (
    <div className="flex gap-2">
```

**Action**: 
1. Remove the empty div used for spacing
2. Change flex container from `justify-between` to default (left alignment)
3. Keep the button group structure with `flex gap-2`

**Target Implementation**:
```
<header className="flex items-center mb-8">
  {isOwnProfile && (
    <div className="flex gap-2">
```

#### Change 3: Remove Delete Avatar Button

**Location**: Lines 526-537

**Action**: Remove the entire conditional block that renders the "Delete Avatar" button

**Code to Remove**:
```
{profile.avatar && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleAvatarDelete}
    disabled={avatarUploading}
    className="gap-2"
  >
    <X className="w-4 h-4" />
    Удалить аватар
  </Button>
)}
```

**Rationale**: Simplifies the UI by removing the delete option. Users can still change their avatar by uploading a new one.

#### Change 4: Move Share Profile Button and Add Functionality

**Current Location**: Lines 590-597 (within profile info flex container)

**Target Location**: Lines 507-542 (header action buttons section)

**Action**: 
1. Remove the Share Profile button and its containing flex wrapper from the profile info section (lines 590-597)
2. Add the button to the header action buttons group
3. Position it after "Edit Profile" button and before "Logout" button
4. Ensure conditional rendering remains tied to `isOwnProfile` check
5. Add onClick handler: `onClick={handleShareProfile}`

**Button Code Structure**:
```
Button with:
- variant="outline"
- size="sm"
- className includes "gap-2" and "cursor-pointer"
- Contains Share2 icon
- Text: "Поделиться профилем"
- onClick={handleShareProfile}
```

#### Change 5: Implement Share Profile Handler

**Location**: Add new function near other handlers (after handleAvatarDelete, around line 328)

**Function Implementation**:

```
Function Name: handleShareProfile
Type: async () => void

Pseudocode:
  IF profile is null:
    RETURN early
  
  TRY:
    Construct profileUrl = `${window.location.origin}/profile/${profile.id}`
    AWAIT navigator.clipboard.writeText(profileUrl)
    
    Call toast with:
      - title: "Ссылка скопирована"
      - description: "Ссылка на профиль скопирована в буфер обмена"
  
  CATCH error:
    Call toast with:
      - title: "Ошибка"
      - description: error message OR "Не удалось скопировать ссылку"
      - variant: "destructive"
```

**Dependencies**:
- `profile` state (already available)
- `toast` from `useToast` hook (already imported and initialized)
- No additional imports required

### Share Profile Functionality

#### Clipboard Copy Implementation

**Functionality**: When user clicks the "Share Profile" button, the system should:
1. Construct the full profile URL using current user ID
2. Copy the URL to the system clipboard
3. Display a success toast notification
4. Handle copy failures gracefully

**URL Construction**:
- Use `window.location.origin` to get the base URL
- Append `/profile/` and the current user's ID
- Example: `http://localhost:3001/profile/605db90f-4691-4281-991e-b2e248e33915`

**Clipboard API**:
- Use modern `navigator.clipboard.writeText()` API
- Wrap in try-catch for error handling
- Fallback not required for modern browsers

**Toast Notification**:
- Use existing `useToast` hook (already imported in Profile.tsx)
- Display success message: "Ссылка скопирована" (Link copied)
- Description: "Ссылка на профиль скопирована в буфер обмена" (Profile link copied to clipboard)
- On error: Display error toast with message "Не удалось скопировать ссылку" (Failed to copy link)

**Event Handler Structure**:
```
Function: handleShareProfile
Type: async function
Logic:
  1. Get current user ID from profile state
  2. Construct full URL: `${window.location.origin}/profile/${profile.id}`
  3. Attempt clipboard write: await navigator.clipboard.writeText(url)
  4. On success: Show success toast
  5. On error: Show error toast with error message
```

### Responsive Considerations

#### Breakpoint Behavior

| Viewport | Grid Columns | Expected Behavior |
|----------|--------------|-------------------|
| < 640px (mobile) | 1 | Single column stack, no horizontal scroll |
| 640px - 1024px (tablet) | 2 | Two column layout, optimal for tablets |
| ≥ 1024px (desktop) | 3 | Three column layout, matches Shelves page |

#### Button Group Responsive Behavior

The header button group should:
- Be left-aligned at all screen sizes
- Wrap buttons on small screens if necessary to maintain readability
- Maintain consistent spacing with `gap-2`
- Allow natural flex wrapping with `flex-wrap` if needed on very small screens
- Buttons should stack vertically or wrap naturally on mobile devices

### Edge Cases

1. **Empty Shelves**: No change needed - empty state already handled with "Полка пуста" message
2. **Single Book**: Will display correctly in 3-column grid with remaining space
3. **Many Shelves**: Vertical scrolling remains unchanged
4. **Button Overflow**: On very small screens, buttons may wrap naturally with flex layout
5. **No Avatar State**: Upload avatar button displays "Добавить аватар" text
6. **With Avatar State**: Upload avatar button displays "Изменить аватар" text
7. **Avatar Deletion**: Users must upload a new avatar to replace existing one; no dedicated delete option

## Testing Checklist

### Visual Verification

- [ ] Profile page shelves display maximum 3 columns on desktop
- [ ] Recently read section maintains 3-column layout on desktop
- [ ] No horizontal scrolling occurs at standard viewport sizes (1024px+)
- [ ] Books align consistently with Shelves page grid
- [ ] Header action buttons are left-aligned
- [ ] Delete Avatar button is not present in header
- [ ] Share Profile button appears in header action group
- [ ] Share Profile button positioned after Edit Profile and before Logout
- [ ] Button spacing and styling consistent with other header buttons
- [ ] Avatar button text changes based on avatar presence ("Добавить" vs "Изменить")

### Responsive Testing

- [ ] Mobile (< 640px): Single column display for all book grids
- [ ] Tablet (640px-1024px): Two column display for all book grids
- [ ] Desktop (≥ 1024px): Three column display for all book grids
- [ ] Header buttons remain left-aligned at all screen sizes
- [ ] Button group wraps gracefully on small screens
- [ ] Share Profile button only visible when viewing own profile

### Functional Testing

- [ ] Share Profile button copies profile URL to clipboard
- [ ] Success toast appears after successful clipboard copy
- [ ] Toast displays correct title: "Ссылка скопирована"
- [ ] Toast displays correct description: "Ссылка на профиль скопирована в буфер обмена"
- [ ] Copied URL matches current profile URL format
- [ ] Error toast appears if clipboard copy fails
- [ ] Edit Profile button remains functional
- [ ] Logout button remains functional
- [ ] Avatar upload button remains functional
- [ ] Avatar upload works for both adding new and replacing existing avatars
- [ ] Book cards maintain clickability and navigation
- [ ] Grid layout does not affect data fetching or display logic
- [ ] No console errors related to removed Delete Avatar button

## Success Criteria

1. Profile page book and shelf grids match the 3-column layout of the Shelves page
2. No horizontal overflow or scrolling at viewport widths ≥ 1024px
3. Header action buttons are left-aligned instead of right-aligned
4. Delete Avatar button is completely removed from the UI
5. Share Profile button integrated seamlessly into header action buttons
6. Share Profile button successfully copies profile URL to clipboard on click
7. Success toast notification displays with correct Russian text after copy
8. Error handling works correctly for clipboard failures
9. Button order: Upload/Change Avatar → Edit Profile → Share Profile → Logout
10. Consistent visual hierarchy and spacing maintained
11. All responsive breakpoints function correctly
12. No regression in existing functionality

## References

### Related Files

- `client/src/pages/Profile.tsx` - Primary modification target
- `client/src/pages/Shelves.tsx` - Reference for target grid layout (line 554)
- `client/src/components/BookCard.tsx` - Book card component (no changes needed)
- `client/src/hooks/use-toast.ts` - Toast notification hook (already in use)

### Browser APIs Used

- **Clipboard API**: `navigator.clipboard.writeText()`
  - Browser Support: Modern browsers (Chrome 66+, Firefox 63+, Safari 13.1+, Edge 79+)
  - Requires HTTPS or localhost context
  - Async operation requiring user gesture (button click)

### Design Patterns

- Tailwind CSS Grid system
- Component conditional rendering based on `isOwnProfile`
- Button group layout patterns
- Responsive breakpoint strategy
- Async/await error handling pattern
- Toast notification pattern for user feedback
