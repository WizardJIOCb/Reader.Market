# Public Stream Page Design

## Overview
Implementation of a public activity feed page (Stream/Поток) that displays real-time site activity accessible to both authenticated and unauthenticated users. The page features three tabs: Global Stream (all site activities), My Stream (personal notifications), and My Shelves Stream (activities for books on user's shelves), with real-time updates via WebSocket and admin moderation capabilities.

## Strategic Goals
- Increase engagement by showcasing community activity in real-time
- Provide transparency into platform dynamics for all visitors
- Create personalized notification center for registered users
- Enable efficient content moderation through centralized activity view
- Drive user registration by demonstrating active community

## Navigation Integration

### Authenticated Users
The Stream menu item appears after "Home" in the main navigation menu, between "Home" and "Search" items.

**Desktop Navigation:**
- Position: Second item after Home
- Label translations:
  - English: "Stream"
  - Russian: "Поток"

**Mobile Navigation:**
- Position: After Home item in mobile sheet menu
- Same translation keys

### Unauthenticated Users
For non-authenticated users, the Stream link appears in the top navigation bar alongside Login and Register buttons.

**Desktop Navigation:**
- Position: Before Login/Register buttons
- Visual treatment: Link style similar to other navigation items
- Label: Same translations as authenticated users

**Mobile Navigation:**
- Position: At top of mobile menu before Login/Register buttons
- Same styling as other menu items

## Page Structure

### URL Routing
- Route path: `/stream`
- Publicly accessible (no authentication required)
- Server-side rendering friendly

### Tab Navigation

#### Global Tab
Displays all recent activities across the platform:
- New news articles published
- New books added to the library
- New comments on books
- New reviews on books
- Real-time like/reaction counts
- Real-time comment counts
- Real-time review counts

#### My Tab (Authenticated Users Only)
Personalized activity feed showing:
- Comments or reviews I created received likes/reactions
- Mentions of my username in comments/reviews
- Private messages received
- Replies to my comments/reviews
- Quotes/citations of my content

For unauthenticated users, this tab shows a message encouraging registration with benefits list.

#### My Shelves Tab (Authenticated Users Only)
Filtered activity feed showing events related to books on user's shelves:
- New comments on books from my shelves
- New reviews on books from my shelves
- New reactions on comments/reviews for books from my shelves
- Updates to book metadata (if applicable)

**Filter Controls:**
- "All Shelves" - Shows activities from all books across all user shelves (default)
- "Specific Shelf" - Dropdown selector to filter by individual shelf name
- "Specific Books" - Multi-select to filter by specific books from shelves

**Filter Behavior:**
- Filter selection persists during session
- Filter state saved to local storage
- Real-time updates respect current filter settings
- Clear filter button to reset to "All Shelves"

For unauthenticated users, this tab shows a message encouraging registration with benefits list highlighting shelf tracking.

### Activity Card Structure

Each activity entry displays:

**Common Information:**
- Activity type indicator (icon + label)
- Timestamp (relative: "2 minutes ago", absolute on hover)
- Author information (avatar, username, profile link)
- Content preview (truncated to 200 characters with "show more")
- Entity link (book title, news title, etc.)

**Type-Specific Information:**

**News Article:**
- News title
- Content preview
- View count
- Comment count
- Reaction count
- Author avatar and name
- Link to full news article

**New Book:**
- Book cover thumbnail
- Book title and author
- Genre tags
- Uploader information
- Link to book detail page

**Book Comment:**
- Book title context
- Comment content preview
- Commenter avatar and name
- Reaction count
- Link to book detail page with comment highlighted

**Book Review:**
- Book title context
- Review rating (1-10 scale with visual stars/badge)
- Review content preview
- Reviewer avatar and name
- Reaction count
- Link to book detail page with review section

### Real-Time Updates

#### WebSocket Event Types

**Activity Events:**
- `stream:news:new` - New news article published
- `stream:book:new` - New book added
- `stream:comment:new` - New comment posted
- `stream:review:new` - New review posted
- `stream:reaction:update` - Reaction count changed
- `stream:content:edit` - Content edited
- `stream:content:delete` - Content deleted

**Personal Events (My Tab):**
- `stream:personal:like` - Your content received a like
- `stream:personal:mention` - You were mentioned
- `stream:personal:message` - New private message
- `stream:personal:reply` - Reply to your content
- `stream:personal:quote` - Your content was quoted

**Shelf Events (My Shelves Tab):**
- `stream:shelf:comment` - New comment on shelf book
- `stream:shelf:review` - New review on shelf book
- `stream:shelf:reaction` - New reaction on shelf book content

#### Update Behavior
- New activities appear at the top with slide-in animation
- Existing items update counters in real-time without full refresh
- Edited content updates in place with visual indicator
- Deleted content removes with fade-out animation
- Maximum 50 items displayed with infinite scroll to load more
- Auto-scroll disabled when user scrolls up (manual position)
- "New items available" banner appears when auto-scroll disabled

## Data Model Extensions

### Activity Feed Table
New database table to track and query activities efficiently:

**Table Name:** `activity_feed`

**Columns:**
- `id` - UUID primary key
- `activity_type` - Text (news, book, comment, review)
- `entity_id` - UUID reference to related entity
- `user_id` - UUID reference to actor
- `target_user_id` - UUID reference (for personal notifications)
- `book_id` - UUID reference (for shelf-related activities, nullable)
- `metadata` - JSONB (flexible storage for type-specific data)
- `created_at` - Timestamp
- `updated_at` - Timestamp
- `deleted_at` - Timestamp (soft delete)

**Indexes:**
- `activity_type` + `created_at` (for Global stream queries)
- `target_user_id` + `created_at` (for My stream queries)
- `entity_id` (for quick lookups and updates)
- `book_id` + `created_at` (for My Shelves stream queries)

**Metadata JSONB Structure:**

**For News:**
```
{
  "title": "string",
  "content_preview": "string (200 chars)",
  "view_count": number,
  "comment_count": number,
  "reaction_count": number,
  "author_name": "string",
  "author_avatar": "string"
}
```

**For Books:**
```
{
  "title": "string",
  "author": "string",
  "cover_url": "string",
  "genre": "string",
  "uploader_name": "string",
  "uploader_avatar": "string"
}
```

**For Comments:**
```
{
  "book_id": "uuid",
  "book_title": "string",
  "content_preview": "string (200 chars)",
  "reaction_count": number,
  "author_name": "string",
  "author_avatar": "string"
}
```

**For Reviews:**
```
{
  "book_id": "uuid",
  "book_title": "string",
  "rating": number,
  "content_preview": "string (200 chars)",
  "reaction_count": number,
  "author_name": "string",
  "author_avatar": "string"
}
```

## API Endpoints

### GET /api/stream/global
Fetch global activity feed

**Query Parameters:**
- `limit` - Number (default 50, max 100)
- `offset` - Number (default 0)
- `before` - Timestamp (pagination cursor)

**Response:**
```
{
  "activities": [
    {
      "id": "uuid",
      "type": "news|book|comment|review",
      "entityId": "uuid",
      "userId": "uuid",
      "metadata": {...},
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "hasMore": boolean,
  "nextCursor": "timestamp"
}
```

### GET /api/stream/personal
Fetch personalized activity feed (requires authentication)

**Query Parameters:**
- Same as global endpoint

**Response:**
- Same structure as global endpoint

### GET /api/stream/shelves
Fetch shelf-filtered activity feed (requires authentication)

**Query Parameters:**
- `limit` - Number (default 50, max 100)
- `offset` - Number (default 0)
- `before` - Timestamp (pagination cursor)
- `shelfIds` - Comma-separated shelf UUIDs (optional, filters by specific shelves)
- `bookIds` - Comma-separated book UUIDs (optional, filters by specific books)

**Response:**
```
{
  "activities": [
    {
      "id": "uuid",
      "type": "comment|review",
      "entityId": "uuid",
      "userId": "uuid",
      "bookId": "uuid",
      "metadata": {...},
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "hasMore": boolean,
  "nextCursor": "timestamp"
}
```

### GET /api/stream/shelves/filters
Fetch available filter options for user's shelves (requires authentication)

**Response:**
```
{
  "shelves": [
    {
      "id": "uuid",
      "name": "string",
      "bookCount": number
    }
  ],
  "books": [
    {
      "id": "uuid",
      "title": "string",
      "shelfIds": ["uuid"]
    }
  ]
}
```

### WebSocket Events
Client subscribes to real-time channels:
- `stream:global` - All users receive global updates
- `stream:personal:{userId}` - Authenticated users receive personal updates
- `stream:shelves:{userId}` - Authenticated users receive shelf-related updates

## Admin Moderation Features

### Permission Requirements
Users with `accessLevel` = 'admin' or 'moder' can perform moderation actions.

### Moderation Actions

#### Delete Action
Available on all activity cards for admins/moderators:
- Visual: Small "X" button on hover (top-right corner)
- Action: Deletes the underlying entity (news, comment, review)
- Confirmation: Modal dialog with entity preview
- Effect: Immediate removal from feed with WebSocket broadcast
- API endpoint routing:
  - News: `/api/admin/news/{id}` (DELETE)
  - Comments: `/api/admin/comments/{id}` (DELETE)
  - Reviews: `/api/admin/reviews/{id}` (DELETE)

#### Edit Action
Available on comments and reviews for admins/moderators:
- Visual: Pencil icon button on hover
- Action: Opens inline editor or modal
- Fields editable:
  - Comment/Review content
  - Review rating (for reviews only)
- API endpoint routing:
  - Comments: `/api/admin/comments/{id}` (PUT)
  - Reviews: `/api/admin/reviews/{id}` (PUT)

### Moderation UI Elements
- Badge indicator on cards showing "Edited by moderator" when applicable
- Audit log reference (stored in metadata)
- Moderator actions visible only to other moderators/admins

## Search Functionality

### Search Interface
Optional implementation - search bar positioned above activity feed:

**Features:**
- Full-text search across all activity content
- Filter by activity type (multi-select dropdown)
- Date range filter
- Author filter (autocomplete user search)
- Sort options: Recent first, Oldest first, Most reactions

**Search Query:**
```
{
  "query": "string",
  "types": ["news", "book", "comment", "review"],
  "dateFrom": "timestamp",
  "dateTo": "timestamp",
  "authorId": "uuid",
  "sortBy": "recent|oldest|reactions"
}
```

### Search API

**Endpoint:** GET /api/stream/search

**Query Parameters:**
- `q` - Search query string
- `types` - Comma-separated activity types
- `dateFrom` - ISO timestamp
- `dateTo` - ISO timestamp
- `authorId` - UUID
- `sortBy` - Sort option
- `limit` - Number
- `offset` - Number

**Response:**
Same structure as global feed endpoint

## Translation Keys

### Navigation
```
en:
  navigation:
    stream: "Stream"

ru:
  navigation:
    stream: "Поток"
```

### Page Content
```
en:
  stream:
    title: "Activity Stream"
    globalTab: "Global"
    myTab: "My Stream"
    myShelvesTab: "My Shelves"
    noActivities: "No activities yet"
    loadMore: "Load more"
    newItemsAvailable: "New items available. Click to refresh."
    activityTypes:
      news: "New Article"
      book: "New Book"
      comment: "New Comment"
      review: "New Review"
    myStream:
      unauthenticated: "Sign in to see your personalized activity feed"
      benefits:
        - "Get notified when your content receives likes"
        - "See who mentioned you in comments"
        - "Track replies to your reviews"
        - "Never miss a private message"
    myShelvesStream:
      unauthenticated: "Sign in to track activities on your favorite books"
      benefits:
        - "Stay updated on new comments for books on your shelves"
        - "See new reviews for books you're interested in"
        - "Get notified about discussions on your collection"
      filters:
        allShelves: "All Shelves"
        specificShelf: "Filter by Shelf"
        specificBooks: "Filter by Books"
        clearFilter: "Clear Filter"
        selectShelf: "Select a shelf..."
        selectBooks: "Select books..."
        noShelves: "You don't have any shelves yet"
        noBooks: "No books on your shelves"

ru:
  stream:
    title: "Поток активности"
    globalTab: "Глобальный"
    myTab: "Мой поток"
    myShelvesTab: "Мои полки"
    noActivities: "Пока нет активности"
    loadMore: "Загрузить ещё"
    newItemsAvailable: "Доступны новые записи. Нажмите для обновления."
    activityTypes:
      news: "Новая статья"
      book: "Новая книга"
      comment: "Новый комментарий"
      review: "Новая рецензия"
    myStream:
      unauthenticated: "Войдите, чтобы увидеть персональную ленту активности"
      benefits:
        - "Получайте уведомления о лайках ваших материалов"
        - "Узнавайте, кто вас упоминает в комментариях"
        - "Отслеживайте ответы на ваши рецензии"
        - "Не пропускайте личные сообщения"
    myShelvesStream:
      unauthenticated: "Войдите, чтобы отслеживать активность по вашим любимым книгам"
      benefits:
        - "Следите за новыми комментариями к книгам на ваших полках"
        - "Узнавайте о новых рецензиях на интересующие вас книги"
        - "Получайте уведомления об обсуждениях вашей коллекции"
      filters:
        allShelves: "Все полки"
        specificShelf: "Фильтр по полке"
        specificBooks: "Фильтр по книгам"
        clearFilter: "Очистить фильтр"
        selectShelf: "Выберите полку..."
        selectBooks: "Выберите книги..."
        noShelves: "У вас ещё нет полок"
        noBooks: "Нет книг на ваших полках"
```

## Technical Implementation Strategy

### Component Architecture

**Page Component:** `StreamPage.tsx`
- Route handling
- Tab state management
- WebSocket connection initialization
- Infinite scroll logic
- Search integration

**Sub-components:**
- `StreamTabs` - Tab navigation (3 tabs)
- `ActivityList` - Scrollable activity container
- `ActivityCard` - Individual activity item
- `NewItemsBanner` - "New items available" notification
- `StreamSearch` - Search interface
- `UnauthenticatedMyStream` - Registration CTA for My Tab
- `ShelfFilters` - Filter controls for My Shelves tab
- `UnauthenticatedShelvesStream` - Registration CTA for My Shelves Tab

### State Management

**Local State:**
- `activeTab` - Current tab (global/my/shelves)
- `activities` - Array of activity objects
- `hasMore` - Pagination flag
- `loading` - Loading state
- `scrollPosition` - User scroll tracking
- `newItemsCount` - Count of new items when auto-scroll disabled
- `shelfFilters` - Selected shelf/book filters (for My Shelves tab)
- `availableShelves` - User's shelves list
- `availableBooks` - Books from user's shelves

**Real-time State Updates:**
- Optimistic UI updates for new activities
- Counter increments for reactions/comments
- Content removal for deletions
- Content updates for edits

### Performance Optimizations

**Pagination Strategy:**
- Initial load: 50 items
- Infinite scroll: 25 items per page
- Cursor-based pagination using timestamps
- Virtualized list rendering for 100+ items

**Caching Strategy:**
- Cache global feed in memory (5 minutes TTL)
- Cache personal feed per user session
- Cache shelves feed per user session
- Cache filter options (shelves, books) for 10 minutes
- Invalidate cache on user actions
- Service worker caching for offline support (future enhancement)

**Real-time Optimization:**
- Batch WebSocket events (100ms debounce)
- Throttle counter updates (500ms)
- Coalesce multiple edits to same entity
- Queue updates when tab not visible, apply on focus

## User Experience Considerations

### Loading States
- Initial page load: Skeleton cards (3-5 placeholders)
- Pagination: Loading spinner at bottom
- Real-time updates: Smooth slide-in animation
- Search: Overlay loading state with spinner

### Empty States
- Global tab: "No activities yet" with illustration
- My tab (authenticated): "No personal notifications yet" with tips
- My tab (unauthenticated): Registration CTA with benefits
- My Shelves tab (authenticated, no shelves): "Create your first shelf" CTA
- My Shelves tab (authenticated, no activities): "No activity on your shelves yet"
- My Shelves tab (unauthenticated): Registration CTA with shelf benefits
- Search results: "No results found" with suggestions

### Error Handling
- WebSocket connection failure: Banner with retry button
- API request failure: Error toast with retry option
- Deleted content: Graceful removal without errors
- Network offline: Cached content with "Offline" indicator

### Accessibility
- Keyboard navigation support
- Screen reader announcements for new activities
- ARIA labels on all interactive elements
- Focus management for modals and inline editors
- Sufficient color contrast for all text

## Security Considerations

### Access Control
- Public access to global feed (no authentication)
- Personal feed requires valid authentication token
- Shelves feed requires valid authentication token
- Shelf filter data only accessible by shelf owner
- Admin actions verify `accessLevel` on backend
- Rate limiting on API endpoints (100 requests/minute per IP)

### Content Moderation
- Admin delete actions log moderator identity
- Soft delete preserves audit trail
- Edit history tracked in metadata
- Inappropriate content flagging (future enhancement)

### Data Privacy
- Personal feed filters by `target_user_id`
- Shelves feed filters by user's shelf books only
- No exposure of private message content (only notification)
- User profiles respect privacy settings
- GDPR compliance for activity history deletion

## Migration Strategy

### Database Migration
1. Create `activity_feed` table
2. Create indexes
3. Backfill recent activities (last 30 days)
4. Set up triggers for new content

### Trigger Implementation
Automatic activity feed entries on:
- News publication
- Book upload
- Comment creation
- Review creation
- Reaction addition (batch update counters)

### Rollback Plan
- Activity feed is supplementary data
- No breaking changes to existing features
- Can disable page without data loss
- Original entity tables remain authoritative

## Success Metrics

### Engagement Metrics
- Daily active users viewing stream page
- Average time spent on stream page
- Click-through rate to entity details
- Return visitor rate

### Activity Metrics
- Activities per day across all types
- Most active time periods
- Most engaged content types
- User-to-user interaction patterns

### Moderation Metrics
- Moderation actions per day
- Average response time to violations
- False positive rate (restored content)
- User reports vs proactive moderation ratio

## Future Enhancements

### Phase 2 Features
- User following system (see activities from followed users)
- Content filtering preferences (hide certain activity types)
- Activity categories/tags
- Trending section based on reaction velocity
- Push notifications integration
- Email digest of personalized activities

### Phase 3 Features
- AI-powered content recommendations
- Sentiment analysis on comments/reviews
- Automated spam detection
- Activity analytics dashboard
- Export activity history (GDPR compliance)
- Third-party integrations (RSS feed, API webhooks)

## Open Questions
1. Should deleted activities remain visible to admins in a "Moderation History" view?
2. Should we implement reaction inline in stream cards or require navigation to entity?
3. Should mentions trigger email notifications in addition to stream appearance?
4. What is the desired retention period for activity feed data?
5. Should private groups have separate activity streams?
6. Should shelf activity include book additions/removals from shelves?
7. How should we handle activities for books removed from shelves (keep or hide)?

## Dependencies
- Existing WebSocket infrastructure (messaging system)
- User authentication system
- Admin authorization middleware
- Translation (i18n) system
- Database migration tooling
- Frontend routing system

## Constraints
- Must maintain existing WebSocket event patterns
- Cannot break existing admin API endpoints
- Must support both authenticated and unauthenticated access
- Real-time updates should not impact server performance
- Mobile-responsive design required
3. Should mentions trigger email notifications in addition to stream appearance?
4. What is the desired retention period for activity feed data?
5. Should private groups have separate activity streams?

## Dependencies
- Existing WebSocket infrastructure (messaging system)
- User authentication system
- Admin authorization middleware
- Translation (i18n) system
- Database migration tooling
- Frontend routing system

## Constraints
- Must maintain existing WebSocket event patterns
- Cannot break existing admin API endpoints
- Must support both authenticated and unauthenticated access
- Real-time updates should not impact server performance
- Mobile-responsive design required
- User authentication system
- Admin authorization middleware
- Translation (i18n) system
- Database migration tooling
- Frontend routing system

## Constraints
- Must maintain existing WebSocket event patterns
- Cannot break existing admin API endpoints
- Must support both authenticated and unauthenticated access
- Real-time updates should not impact server performance
- Mobile-responsive design required
