# Menu Item Highlighting Design

## Overview

Implement visual highlighting for the currently active menu item in the main header navigation to provide users with clear positional awareness within the application.

## Objective

Enhance user experience by making it immediately obvious which page or section the user is currently viewing through distinctive visual styling of the corresponding navigation menu item.

## Scope

This design covers both desktop navigation (Navbar component) and mobile navigation (MobileMenu component).

### In Scope
- Active state detection based on current route
- Visual styling for active menu items
- Consistent styling across desktop and mobile
- Support for all existing menu items:
  - Home (`/home`)
  - Stream (`/stream`)
  - Search (`/search`)
  - Shelves (`/shelves`)
  - About (`/`)
  - Messages (`/messages`)
  - Profile (`/profile/:id`)
  - Admin Panel (`/admin`)

### Out of Scope
- Modification of menu structure or order
- Changes to authentication logic
- Mobile menu behavior changes (already established in project specifications)

## Current State Analysis

### Desktop Navigation (Navbar.tsx)
- Menu items are rendered as Link components with basic hover styling
- Current styling: `text-sm hover:text-primary transition-colors`
- No active state indication
- Uses `wouter` for routing (Link component)

### Mobile Navigation (MobileMenu.tsx)
- Menu items are rendered within a Sheet (slide-out menu)
- Current styling: `px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors`
- No active state indication
- Closes automatically on navigation (SheetClose wrapper)

## Visual Design Strategy

### Recommended Approach: Multi-Indicator Highlighting

Combine multiple visual cues for maximum clarity:

1. **Color**: Active text color changes to primary theme color
2. **Weight**: Active text becomes bold
3. **Underline/Border**: Subtle bottom border indicator
4. **Background** (mobile only): Light background tint

### Rationale

- **Color alone** may not be sufficient for users with color vision deficiency
- **Multiple indicators** ensure accessibility and clear visual hierarchy
- **Consistent pattern** helps users quickly scan and identify location
- **Subtle design** maintains professional appearance without overwhelming UI

### Visual Specification

#### Desktop Navigation
| State | Text Color | Font Weight | Border Bottom | Background |
|-------|-----------|-------------|---------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Primary | Normal (400) | None | Transparent |
| Active | Primary | Semibold (600) | 2px solid primary | Transparent |

#### Mobile Navigation
| State | Text Color | Font Weight | Border Left | Background |
|-------|-----------|-------------|-------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Accent foreground | Normal (400) | None | Accent |
| Active | Primary | Semibold (600) | 3px solid primary | Accent (10% opacity) |

## Technical Approach

### Route Matching Strategy

Since the project uses `wouter` for routing, the active state detection should:

1. **Use wouter's useLocation hook** to get current path
2. **Implement exact matching** for specific routes
3. **Handle dynamic segments** (e.g., `/profile/:id` should match when viewing any profile)
4. **Account for trailing slashes** and query parameters

### Route Matching Logic

| Menu Item | Route Pattern | Match Type |
|-----------|--------------|------------|
| Home | `/home` | Exact |
| Stream | `/stream` | Exact |
| Search | `/search` | Exact |
| Shelves | `/shelves` | Exact |
| About | `/` | Exact |
| Messages | `/messages` | Starts with (includes `/messages/:conversationId`) |
| Profile | `/profile/:id` | Starts with |
| Admin Panel | `/admin` | Starts with (includes `/admin/*`) |

### Conditional Active State Determination

The system should determine if a menu item is active by:
- Extracting the current pathname from the router
- Comparing it against each menu item's route pattern
- Applying the appropriate match type (exact or starts-with)
- Returning boolean active state for each menu item

## Component Structure

### Desktop Navigation Enhancement

For each navigation Link component:
- Wrap the active state logic in a reusable pattern
- Apply conditional className based on active state
- Maintain existing hover and transition effects
- Preserve icon positioning and badge display (for Messages)

### Mobile Navigation Enhancement

For each mobile menu Link component:
- Apply similar active state detection
- Use mobile-specific active styling
- Maintain SheetClose functionality
- Preserve existing border and layout structure

## Styling Implementation

### Desktop Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border bottom: 2px solid with primary color
- Maintain smooth transition for all properties

### Mobile Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border left: 3px solid with primary color
- Background: Accent color at 10% opacity
- Maintain smooth transition for all properties

## Accessibility Considerations

### Visual Indicators
- Multiple visual cues ensure users with color blindness can identify active state
- Sufficient color contrast maintained (WCAG AA compliance)
- Font weight change provides additional non-color indicator

### Screen Reader Support
- Consider adding `aria-current="page"` attribute to active menu items
- Maintains existing `aria-label` attributes
- No changes to semantic HTML structure

### Keyboard Navigation
- Active highlighting does not interfere with keyboard focus indicators
- Focus states remain distinct from active states

## Edge Cases

### Multiple Possible Active States
- When on `/profile/:id`, both the user's own profile link should be highlighted
- Admin panel icon and menu item both highlight when on admin routes

### Root Path Ambiguity
- The "/" route (About) should only be active on exact match
- Should not be active when on "/home" or other routes

### Unauthenticated Users
- Profile link redirects to `/login`, but should not highlight when on login page
- Only authenticated user menu items (Shelves, Messages) can be active

## User Experience Flow

### Navigation Interaction
1. User clicks on a menu item
2. Route changes to new page
3. Menu item immediately shows active state
4. Previous active item returns to inactive state
5. Mobile menu closes (existing behavior preserved)

### Visual Feedback Timeline
- Active state applies instantly on route change (0ms)
- Transition effects for hover remain at current duration
- No loading states or delays in highlighting

## Design Constraints

### Maintain Existing Behavior
- Menu items must retain current hover effects
- Unread message badge positioning unchanged
- Mobile menu close-on-click behavior preserved
- Admin shield icon placement unchanged
- Language switcher functionality unchanged

### Styling Consistency
- Use existing theme colors (primary, accent, muted-foreground)
- Match current typography scale
- Maintain responsive breakpoints
- Follow established spacing patterns

### Performance
- Route matching logic must be efficient (O(1) per menu item)
- No unnecessary re-renders on route changes
- Minimal impact on page load time

## Success Criteria

### Functional Requirements
- Active menu item correctly highlights based on current route
- Highlighting updates immediately on navigation
- Works consistently across all menu items
- Functions identically for authenticated and unauthenticated users

### Visual Requirements
- Active state is immediately recognizable
- Styling is consistent with overall design system
- No visual glitches or flashing during route transitions
- Mobile and desktop styling feel cohesive

### Accessibility Requirements
- Active state distinguishable without relying solely on color
- Screen readers announce current page appropriately
- Keyboard navigation unaffected

## Implementation Notes

### Component Dependencies
- `wouter` library (useLocation hook)
- Existing UI components (Link, Badge, icons)
- Theme system (CSS variables for colors)

### Testing Considerations
- Test all route patterns for correct matching
- Verify highlighting on direct URL access
- Check behavior on browser back/forward navigation
- Validate mobile and desktop responsiveness
- Test with different theme modes (if applicable)

## Future Enhancements

Potential future improvements outside current scope:
- Animated transitions between active states
- Breadcrumb integration for nested routes
- Secondary navigation highlighting
- Customizable highlighting styles per user preference
  - Search (`/search`)
  - Shelves (`/shelves`)
  - About (`/`)
  - Messages (`/messages`)
  - Profile (`/profile/:id`)
  - Admin Panel (`/admin`)

### Out of Scope
- Modification of menu structure or order
- Changes to authentication logic
- Mobile menu behavior changes (already established in project specifications)

## Current State Analysis

### Desktop Navigation (Navbar.tsx)
- Menu items are rendered as Link components with basic hover styling
- Current styling: `text-sm hover:text-primary transition-colors`
- No active state indication
- Uses `wouter` for routing (Link component)

### Mobile Navigation (MobileMenu.tsx)
- Menu items are rendered within a Sheet (slide-out menu)
- Current styling: `px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors`
- No active state indication
- Closes automatically on navigation (SheetClose wrapper)

## Visual Design Strategy

### Recommended Approach: Multi-Indicator Highlighting

Combine multiple visual cues for maximum clarity:

1. **Color**: Active text color changes to primary theme color
2. **Weight**: Active text becomes bold
3. **Underline/Border**: Subtle bottom border indicator
4. **Background** (mobile only): Light background tint

### Rationale

- **Color alone** may not be sufficient for users with color vision deficiency
- **Multiple indicators** ensure accessibility and clear visual hierarchy
- **Consistent pattern** helps users quickly scan and identify location
- **Subtle design** maintains professional appearance without overwhelming UI

### Visual Specification

#### Desktop Navigation
| State | Text Color | Font Weight | Border Bottom | Background |
|-------|-----------|-------------|---------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Primary | Normal (400) | None | Transparent |
| Active | Primary | Semibold (600) | 2px solid primary | Transparent |

#### Mobile Navigation
| State | Text Color | Font Weight | Border Left | Background |
|-------|-----------|-------------|-------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Accent foreground | Normal (400) | None | Accent |
| Active | Primary | Semibold (600) | 3px solid primary | Accent (10% opacity) |

## Technical Approach

### Route Matching Strategy

Since the project uses `wouter` for routing, the active state detection should:

1. **Use wouter's useLocation hook** to get current path
2. **Implement exact matching** for specific routes
3. **Handle dynamic segments** (e.g., `/profile/:id` should match when viewing any profile)
4. **Account for trailing slashes** and query parameters

### Route Matching Logic

| Menu Item | Route Pattern | Match Type |
|-----------|--------------|------------|
| Home | `/home` | Exact |
| Stream | `/stream` | Exact |
| Search | `/search` | Exact |
| Shelves | `/shelves` | Exact |
| About | `/` | Exact |
| Messages | `/messages` | Starts with (includes `/messages/:conversationId`) |
| Profile | `/profile/:id` | Starts with |
| Admin Panel | `/admin` | Starts with (includes `/admin/*`) |

### Conditional Active State Determination

The system should determine if a menu item is active by:
- Extracting the current pathname from the router
- Comparing it against each menu item's route pattern
- Applying the appropriate match type (exact or starts-with)
- Returning boolean active state for each menu item

## Component Structure

### Desktop Navigation Enhancement

For each navigation Link component:
- Wrap the active state logic in a reusable pattern
- Apply conditional className based on active state
- Maintain existing hover and transition effects
- Preserve icon positioning and badge display (for Messages)

### Mobile Navigation Enhancement

For each mobile menu Link component:
- Apply similar active state detection
- Use mobile-specific active styling
- Maintain SheetClose functionality
- Preserve existing border and layout structure

## Styling Implementation

### Desktop Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border bottom: 2px solid with primary color
- Maintain smooth transition for all properties

### Mobile Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border left: 3px solid with primary color
- Background: Accent color at 10% opacity
- Maintain smooth transition for all properties

## Accessibility Considerations

### Visual Indicators
- Multiple visual cues ensure users with color blindness can identify active state
- Sufficient color contrast maintained (WCAG AA compliance)
- Font weight change provides additional non-color indicator

### Screen Reader Support
- Consider adding `aria-current="page"` attribute to active menu items
- Maintains existing `aria-label` attributes
- No changes to semantic HTML structure

### Keyboard Navigation
- Active highlighting does not interfere with keyboard focus indicators
- Focus states remain distinct from active states

## Edge Cases

### Multiple Possible Active States
- When on `/profile/:id`, both the user's own profile link should be highlighted
- Admin panel icon and menu item both highlight when on admin routes

### Root Path Ambiguity
- The "/" route (About) should only be active on exact match
- Should not be active when on "/home" or other routes

### Unauthenticated Users
- Profile link redirects to `/login`, but should not highlight when on login page
- Only authenticated user menu items (Shelves, Messages) can be active

## User Experience Flow

### Navigation Interaction
1. User clicks on a menu item
2. Route changes to new page
3. Menu item immediately shows active state
4. Previous active item returns to inactive state
5. Mobile menu closes (existing behavior preserved)

### Visual Feedback Timeline
- Active state applies instantly on route change (0ms)
- Transition effects for hover remain at current duration
- No loading states or delays in highlighting

## Design Constraints

### Maintain Existing Behavior
- Menu items must retain current hover effects
- Unread message badge positioning unchanged
- Mobile menu close-on-click behavior preserved
- Admin shield icon placement unchanged
- Language switcher functionality unchanged

### Styling Consistency
- Use existing theme colors (primary, accent, muted-foreground)
- Match current typography scale
- Maintain responsive breakpoints
- Follow established spacing patterns

### Performance
- Route matching logic must be efficient (O(1) per menu item)
- No unnecessary re-renders on route changes
- Minimal impact on page load time

## Success Criteria

### Functional Requirements
- Active menu item correctly highlights based on current route
- Highlighting updates immediately on navigation
- Works consistently across all menu items
- Functions identically for authenticated and unauthenticated users

### Visual Requirements
- Active state is immediately recognizable
- Styling is consistent with overall design system
- No visual glitches or flashing during route transitions
- Mobile and desktop styling feel cohesive

### Accessibility Requirements
- Active state distinguishable without relying solely on color
- Screen readers announce current page appropriately
- Keyboard navigation unaffected

## Implementation Notes

### Component Dependencies
- `wouter` library (useLocation hook)
- Existing UI components (Link, Badge, icons)
- Theme system (CSS variables for colors)

### Testing Considerations
- Test all route patterns for correct matching
- Verify highlighting on direct URL access
- Check behavior on browser back/forward navigation
- Validate mobile and desktop responsiveness
- Test with different theme modes (if applicable)

## Future Enhancements

Potential future improvements outside current scope:
- Animated transitions between active states
- Breadcrumb integration for nested routes
- Secondary navigation highlighting
- Customizable highlighting styles per user preference
  - Home (`/home`)
  - Stream (`/stream`)
  - Search (`/search`)
  - Shelves (`/shelves`)
  - About (`/`)
  - Messages (`/messages`)
  - Profile (`/profile/:id`)
  - Admin Panel (`/admin`)

### Out of Scope
- Modification of menu structure or order
- Changes to authentication logic
- Mobile menu behavior changes (already established in project specifications)

## Current State Analysis

### Desktop Navigation (Navbar.tsx)
- Menu items are rendered as Link components with basic hover styling
- Current styling: `text-sm hover:text-primary transition-colors`
- No active state indication
- Uses `wouter` for routing (Link component)

### Mobile Navigation (MobileMenu.tsx)
- Menu items are rendered within a Sheet (slide-out menu)
- Current styling: `px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors`
- No active state indication
- Closes automatically on navigation (SheetClose wrapper)

## Visual Design Strategy

### Recommended Approach: Multi-Indicator Highlighting

Combine multiple visual cues for maximum clarity:

1. **Color**: Active text color changes to primary theme color
2. **Weight**: Active text becomes bold
3. **Underline/Border**: Subtle bottom border indicator
4. **Background** (mobile only): Light background tint

### Rationale

- **Color alone** may not be sufficient for users with color vision deficiency
- **Multiple indicators** ensure accessibility and clear visual hierarchy
- **Consistent pattern** helps users quickly scan and identify location
- **Subtle design** maintains professional appearance without overwhelming UI

### Visual Specification

#### Desktop Navigation
| State | Text Color | Font Weight | Border Bottom | Background |
|-------|-----------|-------------|---------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Primary | Normal (400) | None | Transparent |
| Active | Primary | Semibold (600) | 2px solid primary | Transparent |

#### Mobile Navigation
| State | Text Color | Font Weight | Border Left | Background |
|-------|-----------|-------------|-------------|------------|
| Inactive | Default text | Normal (400) | None | Transparent |
| Hover | Accent foreground | Normal (400) | None | Accent |
| Active | Primary | Semibold (600) | 3px solid primary | Accent (10% opacity) |

## Technical Approach

### Route Matching Strategy

Since the project uses `wouter` for routing, the active state detection should:

1. **Use wouter's useLocation hook** to get current path
2. **Implement exact matching** for specific routes
3. **Handle dynamic segments** (e.g., `/profile/:id` should match when viewing any profile)
4. **Account for trailing slashes** and query parameters

### Route Matching Logic

| Menu Item | Route Pattern | Match Type |
|-----------|--------------|------------|
| Home | `/home` | Exact |
| Stream | `/stream` | Exact |
| Search | `/search` | Exact |
| Shelves | `/shelves` | Exact |
| About | `/` | Exact |
| Messages | `/messages` | Starts with (includes `/messages/:conversationId`) |
| Profile | `/profile/:id` | Starts with |
| Admin Panel | `/admin` | Starts with (includes `/admin/*`) |

### Conditional Active State Determination

The system should determine if a menu item is active by:
- Extracting the current pathname from the router
- Comparing it against each menu item's route pattern
- Applying the appropriate match type (exact or starts-with)
- Returning boolean active state for each menu item

## Component Structure

### Desktop Navigation Enhancement

For each navigation Link component:
- Wrap the active state logic in a reusable pattern
- Apply conditional className based on active state
- Maintain existing hover and transition effects
- Preserve icon positioning and badge display (for Messages)

### Mobile Navigation Enhancement

For each mobile menu Link component:
- Apply similar active state detection
- Use mobile-specific active styling
- Maintain SheetClose functionality
- Preserve existing border and layout structure

## Styling Implementation

### Desktop Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border bottom: 2px solid with primary color
- Maintain smooth transition for all properties

### Mobile Active Styles
- Text color: Primary theme color
- Font weight: 600 (semibold)
- Border left: 3px solid with primary color
- Background: Accent color at 10% opacity
- Maintain smooth transition for all properties

## Accessibility Considerations

### Visual Indicators
- Multiple visual cues ensure users with color blindness can identify active state
- Sufficient color contrast maintained (WCAG AA compliance)
- Font weight change provides additional non-color indicator

### Screen Reader Support
- Consider adding `aria-current="page"` attribute to active menu items
- Maintains existing `aria-label` attributes
- No changes to semantic HTML structure

### Keyboard Navigation
- Active highlighting does not interfere with keyboard focus indicators
- Focus states remain distinct from active states

## Edge Cases

### Multiple Possible Active States
- When on `/profile/:id`, both the user's own profile link should be highlighted
- Admin panel icon and menu item both highlight when on admin routes

### Root Path Ambiguity
- The "/" route (About) should only be active on exact match
- Should not be active when on "/home" or other routes

### Unauthenticated Users
- Profile link redirects to `/login`, but should not highlight when on login page
- Only authenticated user menu items (Shelves, Messages) can be active

## User Experience Flow

### Navigation Interaction
1. User clicks on a menu item
2. Route changes to new page
3. Menu item immediately shows active state
4. Previous active item returns to inactive state
5. Mobile menu closes (existing behavior preserved)

### Visual Feedback Timeline
- Active state applies instantly on route change (0ms)
- Transition effects for hover remain at current duration
- No loading states or delays in highlighting

## Design Constraints

### Maintain Existing Behavior
- Menu items must retain current hover effects
- Unread message badge positioning unchanged
- Mobile menu close-on-click behavior preserved
- Admin shield icon placement unchanged
- Language switcher functionality unchanged

### Styling Consistency
- Use existing theme colors (primary, accent, muted-foreground)
- Match current typography scale
- Maintain responsive breakpoints
- Follow established spacing patterns

### Performance
- Route matching logic must be efficient (O(1) per menu item)
- No unnecessary re-renders on route changes
- Minimal impact on page load time

## Success Criteria

### Functional Requirements
- Active menu item correctly highlights based on current route
- Highlighting updates immediately on navigation
- Works consistently across all menu items
- Functions identically for authenticated and unauthenticated users

### Visual Requirements
- Active state is immediately recognizable
- Styling is consistent with overall design system
- No visual glitches or flashing during route transitions
- Mobile and desktop styling feel cohesive

### Accessibility Requirements
- Active state distinguishable without relying solely on color
- Screen readers announce current page appropriately
- Keyboard navigation unaffected

## Implementation Notes

### Component Dependencies
- `wouter` library (useLocation hook)
- Existing UI components (Link, Badge, icons)
- Theme system (CSS variables for colors)

### Testing Considerations
- Test all route patterns for correct matching
- Verify highlighting on direct URL access
- Check behavior on browser back/forward navigation
- Validate mobile and desktop responsiveness
- Test with different theme modes (if applicable)

## Future Enhancements

Potential future improvements outside current scope:
- Animated transitions between active states
- Breadcrumb integration for nested routes
- Secondary navigation highlighting
- Customizable highlighting styles per user preference
