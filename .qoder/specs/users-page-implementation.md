# Users Page Implementation Specification

## Overview
Create a public "Пользователи" (Users) page accessible from the top navbar that allows visitors to browse, search, and sort through registered users with comprehensive statistics and quick actions.

## Requirements

### Access & Navigation
- **Access Level**: Public (no authentication required)
- **Menu Location**: Top navbar, positioned after "Stream" link
- **Route**: `/users`
- **Menu Label**: "Пользователи" (Russian) / "Users" (English)

### Search & Filtering
- Search by username and full name
- Debounced search input (500ms) to prevent excessive API calls
- Show blocked users with visual indicator (red border/badge)

### Sorting Options
- By rating (default, highest first)
- By shelves count
- By books count
- By comments count
- By reviews count
- By last activity date

### Pagination
- Configurable items per page: 5, 15, 30
- Offset-based pagination with page navigation
- Persist user's items-per-page preference in localStorage

### User Card Display
Each user card should show:
- Avatar image
- Username and full name
- Profile rating (color-coded badge)
- Registration date
- Last activity date
- Bio (if exists)
- Statistics:
  - Comments written count
  - Reviews written count
  - Shelves count
  - Books on shelves count
- Quick Actions:
  - "View Profile" link
  - "Send Message" button (requires authentication)

### Layout
- Responsive card-based grid:
  - Desktop (≥1024px): 3 columns
  - Tablet (768-1023px): 2 columns
  - Mobile (<768px): 1 column
- Controls section: Search, Sort dropdown, Items-per-page selector
- Pagination controls at bottom

## Architecture

### Backend Implementation

#### 1. Database Method: `getPublicUsers()`
**File**: `server/storage.ts`

**Purpose**: Fetch users with aggregated statistics in a single optimized query

**Parameters**:
- `page`: number (default: 1)
- `limit`: number (5 | 15 | 30, default: 15)
- `search`: string | undefined
- `sortBy`: 'rating' | 'shelves' | 'books' | 'comments' | 'reviews' | 'lastActivity' (default: 'rating')

**Query Strategy**: 
- Single LEFT JOIN query with GROUP BY
- Joins: users → shelves → shelf_books → comments → reviews
- Use COUNT(DISTINCT) to avoid duplicates
- Use COALESCE for null handling
- Dynamic ORDER BY based on sortBy parameter
- Exclude sensitive fields: email, accessLevel, blockReason

**Return Type**:
```typescript
{
  users: Array<{
    id: number;
    username: string;
    fullName: string | null;
    avatar: string | null;
    profileRating: number;
    registeredAt: Date;
    lastActivityAt: Date | null;
    bio: string | null;
    isBlocked: boolean;
    commentsCount: number;
    reviewsCount: number;
    shelvesCount: number;
    booksCount: number;
  }>;
  total: number;
}
```

#### 2. API Endpoint: `GET /api/public/users`
**File**: `server/routes.ts`

**Authentication**: None (public endpoint)

**Query Parameters**:
- `page`: number (optional, default: 1)
- `limit`: number (optional, default: 15, allowed: 5, 15, 30)
- `search`: string (optional)
- `sortBy`: string (optional, default: 'rating')

**Response Format**:
```json
{
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 15,
    "total": 142,
    "pages": 10
  }
}
```

**Security**:
- Whitelist sortBy parameter to prevent SQL injection
- Validate and clamp limit to allowed values (5, 15, 30)

### Frontend Implementation

#### 3. Page Component: `PublicUsers.tsx`
**File**: `client/src/pages/PublicUsers.tsx` (NEW)

**State Management**:
- `users`: User[] - fetched user data
- `loading`: boolean - loading state
- `pagination`: { page, limit, total, pages }
- `search`: string - controlled search input
- `debouncedSearch`: string - debounced search value (500ms)
- `sortBy`: string - current sort option
- `itemsPerPage`: number - persisted in localStorage

**Components Structure**:
```
PublicUsers
├── Header (title + description)
├── Controls
│   ├── Search input (debounced)
│   ├── Sort dropdown
│   └── Items-per-page selector
├── User Cards Grid (responsive)
│   └── UserCard (×N)
│       ├── Avatar
│       ├── User Info
│       ├── Statistics
│       └── Quick Actions
└── Pagination Controls
```

**User Card Design**:
- White background with border
- Hover state with shadow
- Blocked users: red border + "Blocked" badge
- Avatar: circular, 80px, fallback to placeholder
- Rating: color-coded badge (green ≥4, yellow 2-3.99, red <2)
- Stats: icon grid with labels
- Actions: two buttons side-by-side

#### 4. Navigation Integration
**File**: `client/src/components/Navbar.tsx`

**Changes**:
- Add "Пользователи" / "Users" link after "Stream" link
- Before authenticated-only links (Messages, Profile)
- Apply active state styling when on /users route
- Use translation key: `navigation:users`

#### 5. Routing Configuration
**File**: `client/src/App.tsx`

**Changes**:
- Import PublicUsers component
- Add route: `<Route path="/users" element={<PublicUsers />} />`
- Position in routes list with other public routes

#### 6. Localization

**New Files**:
- `client/src/locales/en/users.json`
- `client/src/locales/ru/users.json`

**Translation Keys**:
```json
{
  "title": "Users",
  "searchPlaceholder": "Search by username or name...",
  "sortBy": "Sort by",
  "sortOptions": {
    "rating": "Rating",
    "shelves": "Shelves",
    "books": "Books",
    "comments": "Comments",
    "reviews": "Reviews",
    "lastActivity": "Last Activity"
  },
  "itemsPerPage": "Items per page",
  "stats": {
    "shelves": "Shelves",
    "books": "Books",
    "comments": "Comments",
    "reviews": "Reviews"
  },
  "actions": {
    "viewProfile": "View Profile",
    "sendMessage": "Send Message"
  },
  "blocked": "Blocked",
  "registeredAt": "Registered",
  "lastActivity": "Last active",
  "noUsers": "No users found",
  "loading": "Loading users..."
}
```

**Update Files**:
- `client/src/locales/en/navigation.json` - add `"users": "Users"`
- `client/src/locales/ru/navigation.json` - add `"users": "Пользователи"`

## Implementation Sequence

### Phase 1: Backend Foundation
1. Add `getPublicUsers()` method to `server/storage.ts`
2. Add `GET /api/public/users` endpoint to `server/routes.ts`
3. Test endpoint with various parameters using curl/Postman

### Phase 2: Frontend Component
1. Create localization files (users.json for en/ru)
2. Update navigation.json with "users" key
3. Create `client/src/pages/PublicUsers.tsx`
4. Implement search, sort, pagination logic
5. Design user card component

### Phase 3: Navigation Integration
1. Update `client/src/components/Navbar.tsx`
2. Add route to `client/src/App.tsx`
3. Test navigation flow

### Phase 4: Polish & Testing
1. Add blocked user visual indicator
2. Implement "Send Message" button with auth check
3. Test all sort options
4. Test pagination with different limits
5. Test search functionality
6. Verify responsive design on mobile/tablet/desktop
7. Test localization (switch between EN/RU)

### Phase 5: Performance & Security
1. Verify database indexes on sortable columns
2. Test query performance with large user dataset
3. Verify no sensitive data exposed in API
4. Test SQL injection prevention in sortBy parameter

## Critical Files

### To Create:
- `client/src/pages/PublicUsers.tsx`
- `client/src/locales/en/users.json`
- `client/src/locales/ru/users.json`

### To Modify:
- `server/storage.ts` - add getPublicUsers()
- `server/routes.ts` - add GET /api/public/users
- `client/src/components/Navbar.tsx` - add menu item
- `client/src/App.tsx` - add route
- `client/src/locales/en/navigation.json` - add "users" key
- `client/src/locales/ru/navigation.json` - add "users" key

## Performance Considerations

### Database Optimization
- Use single LEFT JOIN query instead of N+1 queries
- Ensure indexes exist on:
  - `users.profileRating`
  - `users.lastActivityAt`
  - `shelves.userId`
  - `comments.userId`
  - `reviews.userId`

### Frontend Optimization
- Debounce search input (500ms)
- Use React.memo for user cards if needed
- Lazy load avatar images
- Cache itemsPerPage in localStorage

## Security Considerations

1. **Data Exposure**: Exclude sensitive fields (email, accessLevel, blockReason) from public API
2. **SQL Injection**: Whitelist sortBy parameter values
3. **Rate Limiting**: Consider rate limiting public endpoint (future enhancement)
4. **Authentication Check**: Verify user is logged in before showing message compose modal

## Testing Checklist

- [ ] Backend endpoint returns correct data structure
- [ ] Sorting works for all 6 options (rating, shelves, books, comments, reviews, lastActivity)
- [ ] Pagination calculates total pages correctly
- [ ] Search filters by username and fullName
- [ ] Blocked users show red border/badge
- [ ] "View Profile" links to correct user profile page
- [ ] "Send Message" button shows auth prompt if not logged in
- [ ] "Send Message" opens compose modal if logged in
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Items-per-page preference persists in localStorage
- [ ] Localization works for both EN and RU
- [ ] Loading state displays correctly
- [ ] Empty state displays when no users found
- [ ] Page navigation works correctly
- [ ] URL parameters update on filter/sort/page changes (optional enhancement)

## Future Enhancements (Not in Scope)

- Advanced filters (by registration date range, rating range)
- Export user list to CSV
- URL parameter persistence for sharing filtered views
- Infinite scroll option instead of pagination
- User comparison feature
- Follow/unfollow functionality from user cards
