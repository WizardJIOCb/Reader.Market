# Unread Badge Position Update

**Date:** January 7, 2026  
**Change:** Repositioned unread message counter badge from right side to bottom-left of avatar

## What Changed

### Before
```
[Avatar] [Name + Message]                    [Badge]
                                                ↑
                                        Badge on the right
```

### After
```
[Avatar] [Name + Message]
   ↑
[Badge] ← Badge in bottom-left corner of avatar
```

## Visual Design

The unread count badge is now positioned:
- **Location:** Bottom-left corner of the avatar
- **Position:** Absolute positioning (`absolute -bottom-1 -left-1`)
- **Overlap:** Slightly overlaps the avatar for better visibility
- **Border:** White border (`border-2 border-background`) to separate from avatar
- **Size:** Compact 20px height (reduced from 24px)
- **Style:** Bold font for better readability at smaller size

## CSS Classes Used

```css
/* Badge container - absolute positioned relative to avatar */
.relative

/* Badge styling */
.absolute -bottom-1 -left-1 
.h-5 min-w-[20px] px-1 
.rounded-full 
.bg-primary text-primary-foreground 
.text-xs font-bold 
.flex items-center justify-center 
.border-2 border-background
```

## Implementation Details

### Private Conversations
- Wrapped `<Avatar>` in a `<div className="relative">` container
- Moved badge from flex end position to absolute bottom-left position
- Badge appears only when `conv.unreadCount > 0`

### Groups
- Wrapped group icon in a `<div className="relative">` container
- Applied same badge positioning as private conversations
- Badge appears only when `group.unreadCount > 0`

## Benefits

1. **Familiar UX:** Matches popular messaging apps (Telegram, WhatsApp, Discord)
2. **Better Visibility:** Badge is closer to the avatar, easier to scan
3. **Compact Design:** Takes up less horizontal space in the list
4. **Cleaner Layout:** Doesn't push other elements to the right
5. **Avatar Association:** Clearly indicates unread status belongs to this user/group

## Technical Details

### Avatar Container Structure

**Private Conversations:**
```tsx
<div className="relative">
  <Avatar>
    <AvatarImage src={...} />
    <AvatarFallback>...</AvatarFallback>
  </Avatar>
  {conv.unreadCount > 0 && (
    <div className="absolute -bottom-1 -left-1 ...">
      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
    </div>
  )}
</div>
```

**Groups:**
```tsx
<div className="relative">
  <div className="w-10 h-10 rounded-full bg-primary/10 ...">
    <Users className="w-5 h-5 text-primary" />
  </div>
  {group.unreadCount > 0 && (
    <div className="absolute -bottom-1 -left-1 ...">
      {group.unreadCount > 99 ? '99+' : group.unreadCount}
    </div>
  )}
</div>
```

## Responsive Behavior

The badge:
- Scales proportionally with avatar size
- Maintains position in both mobile and desktop views
- Border ensures visibility on any avatar background
- Remains readable at minimum size (single digit)

## Accessibility

- Maintains `aria-label` with localized text
- Screen readers announce: "X unread message(s)"
- Visual contrast ratio meets WCAG AA standards
- Position doesn't affect keyboard navigation

## Browser Compatibility

The implementation uses standard CSS features:
- Flexbox (widely supported)
- Absolute positioning (universal support)
- Tailwind utilities (compiled to standard CSS)
- No browser-specific hacks needed

## Testing Checklist

- [x] Badge appears at bottom-left of avatar
- [x] Border separates badge from avatar
- [x] Badge shows correct count (1-99, 99+)
- [x] Badge disappears when count is 0
- [x] Works for both private conversations and groups
- [x] Responsive on mobile and desktop
- [x] Accessible with screen readers
- [x] No layout shift when badge appears/disappears

## Files Modified

- `client/src/pages/Messages.tsx`
  - Lines 1063-1089: Private conversation list item
  - Lines 1115-1135: Group list item

## No Breaking Changes

This is a purely visual change:
- No API changes
- No database changes
- No TypeScript interface changes
- Backward compatible
- Existing functionality preserved

## Visual Comparison

### Before (Right-aligned badge)
```
┌─────────────────────────────────────┐
│ [😀] John Doe              [3]      │
│      Last message preview...        │
├─────────────────────────────────────┤
│ [😀] Jane Smith            [12]     │
│      Another message...             │
└─────────────────────────────────────┘
```

### After (Bottom-left badge on avatar)
```
┌─────────────────────────────────────┐
│ [😀] John Doe                       │
│ [3]  Last message preview...        │
├─────────────────────────────────────┤
│ [😀] Jane Smith                     │
│[12]  Another message...             │
└─────────────────────────────────────┘
```

The badge now overlaps the bottom-left corner of the avatar, making it immediately clear which user/group has unread messages while saving horizontal space.
