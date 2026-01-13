# Feature Design: Last Actions Tab on Stream Page

## Overview

Add a new tab called "Last Actions" (Последние действия) to the /stream page that tracks and displays comprehensive user navigation and interaction activities across the platform. This tab will show real-time user actions including page navigation, messaging activities, and content interactions, providing visibility into platform engagement patterns.

## Business Context

This feature enhances platform transparency and user engagement by:
- Displaying real-time user activity patterns
- Showing navigation flows across different platform sections
- Highlighting active areas and popular content
- Providing social proof through visible user engagement
- Maintaining user privacy by only showing actions in public contexts

## Feature Requirements

### Functional Requirements

#### Tab Structure

The new "Last Actions" tab will be positioned as follows:
- Tab order: Global | My Shelves | My Activity | Last Actions
- Last Actions is the fourth and final tab
- Available to all users (authenticated and unauthenticated)
- Shows all activities from Global tab PLUS additional navigation actions

#### Tracked User Actions

The system shall log and display the following user actions:

**Navigation Actions:**
- Navigated to home page
- Navigated to stream page
- Navigated to search page
- Navigated to my shelves page
- Navigated to about project page
- Navigated to messages page
- Navigated to a user profile (with link to that profile)
- Navigated to a news article (with link to that news)
- Navigated to a book page (with link to that book)
- Opened book reader (with link to that book)

**Messaging Actions (Public Context Only):**
- Sent message in a public group (not private groups or conversations)
- Group name and message preview displayed

#### Activity Entry Display Format

Each activity entry shall display:
- User profile information (avatar, username with link to profile)
- Action description (translated based on user language preference)
- Timestamp (relative time for recent actions, full date/time for older)
- Contextual link to related resource (profile, book, news, group)
- Action type icon for visual identification

### Non-Functional Requirements

#### Performance
- Activities shall load within 2 seconds for initial page view
- Real-time updates shall appear within 1 second of action occurrence
- Pagination or infinite scroll for handling large activity volumes
- Database queries optimized with proper indexing

#### Privacy
- Only public group messages are displayed (private groups excluded)
- Private conversation messages are never displayed
- User actions logged only for authenticated users
- Opt-out mechanism consideration for future implementation

#### Scalability
- Activity logging shall not impact page navigation performance
- Database storage strategy for activity retention (e.g., 30-day limit)
- Efficient cleanup of old activity records

## System Architecture

### Database Schema

#### New Table: user_actions

Purpose: Store comprehensive user navigation and interaction activities

Fields:
- id: unique identifier (UUID, primary key)
- user_id: reference to users table (required)
- action_type: type of action performed (enum/text, required)
- target_type: type of target entity (enum/text, optional)
- target_id: identifier of target entity (UUID, optional)
- metadata: additional context data (JSONB, optional)
- created_at: timestamp when action occurred (required)
- deleted_at: soft delete timestamp (optional)

Indexes:
- Primary key on id
- Index on user_id for user-specific queries
- Index on action_type for filtering
- Index on created_at for chronological sorting
- Composite index on (deleted_at, created_at) for efficient active records retrieval

#### Action Types Enumeration

Values and their meanings:
- navigate_home: User visited home page
- navigate_stream: User visited stream page
- navigate_search: User visited search page
- navigate_shelves: User visited my shelves page
- navigate_about: User visited about project page
- navigate_messages: User visited messages page
- navigate_profile: User visited a profile page
- navigate_news: User visited a news article page
- navigate_book: User visited a book detail page
- navigate_reader: User opened book reader
- send_group_message: User sent message in public group

#### Target Types Enumeration

Values:
- user: Target is a user profile
- book: Target is a book
- news: Target is a news article
- group: Target is a group

#### Metadata Structure

JSONB field containing action-specific data:

For navigation actions:
```
{
  "username": "target_username",
  "book_title": "title_of_book",
  "news_title": "title_of_news",
  "profile_username": "visited_profile_username"
}
```

For group messages:
```
{
  "group_id": "uuid",
  "group_name": "name_of_group",
  "message_preview": "First 100 characters..."
}
```

### Backend Components

#### Action Logging Middleware

A middleware function that captures navigation events:
- Intercepts route changes on protected endpoints
- Extracts user ID from authentication token
- Determines action type based on route pattern
- Collects metadata from request context
- Writes action record to database asynchronously
- Does not block response to user

Route Pattern Mapping:
- /home → navigate_home
- /stream → navigate_stream
- /search → navigate_search
- /shelves → navigate_shelves
- / → navigate_about
- /messages → navigate_messages
- /profile/:userId → navigate_profile (with target_id)
- /news/:newsId → navigate_news (with target_id)
- /book/:bookId → navigate_book (with target_id)
- /read/:bookId/:chapterId → navigate_reader (with target_id)

#### Group Message Handler Enhancement

Enhance existing group message creation endpoint:
- After successful message creation in public group
- Log action of type "send_group_message"
- Store group details and message preview in metadata
- Do not log for private groups

#### API Endpoints

**GET /api/stream/last-actions**

Purpose: Retrieve last actions activity feed

Query Parameters:
- limit: number of records to return (default: 50, max: 100)
- offset: pagination offset (default: 0)
- before: timestamp for cursor-based pagination (optional)

Authentication: Optional (public endpoint)

Response Format:
```
{
  "activities": [
    {
      "id": "uuid",
      "type": "navigate_book",
      "user": {
        "id": "uuid",
        "username": "string",
        "avatar_url": "string"
      },
      "target": {
        "type": "book",
        "id": "uuid",
        "title": "string"
      },
      "timestamp": "ISO8601",
      "metadata": {}
    }
  ],
  "pagination": {
    "total": 0,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

### Frontend Components

#### Tab Integration

Update StreamPage component:
- Add fourth tab "Last Actions" after "My Activity"
- Tab value: "last-actions"
- Tab label localization keys:
  - en: "Last Actions"
  - ru: "Последние действия"

#### LastActionsActivityCard Component

A new component to render last action entries:

Display Elements:
- User avatar (clickable, links to profile)
- Username (clickable, links to profile)
- Action description text (localized)
- Target link (book, news, profile, group as applicable)
- Timestamp with tooltip (same pattern as existing ActivityCard)
- Action type icon (consistent with existing activity types)

Action Icon Mapping:
- Navigation actions: appropriate icon per page type
  - Home: Home icon
  - Stream: Activity/RSS icon
  - Search: Search icon
  - Shelves: BookOpen icon
  - About: Info icon
  - Messages: MessageCircle icon
  - Profile: User icon
  - News: Newspaper icon
  - Book: Book icon
  - Reader: BookOpen icon
- Group message: MessageSquare icon

Localization Strings:

English:
- navigate_home: "visited home page"
- navigate_stream: "visited stream"
- navigate_search: "used search"
- navigate_shelves: "viewed their shelves"
- navigate_about: "visited about page"
- navigate_messages: "checked messages"
- navigate_profile: "viewed profile"
- navigate_news: "read news"
- navigate_book: "viewed book"
- navigate_reader: "started reading"
- send_group_message: "sent message in"

Russian:
- navigate_home: "посетил главную страницу"
- navigate_stream: "посетил ленту"
- navigate_search: "использовал поиск"
- navigate_shelves: "просмотрел свои полки"
- navigate_about: "посетил страницу О проекте"
- navigate_messages: "проверил сообщения"
- navigate_profile: "посмотрел профиль"
- navigate_news: "прочитал новость"
- navigate_book: "посмотрел книгу"
- navigate_reader: "начал читать"
- send_group_message: "отправил сообщение в"

#### Real-Time Updates

WebSocket integration:
- New event type: "stream:last-action"
- Broadcast to "stream:last-actions" room
- All connected clients in Last Actions tab receive updates
- Optimistic UI updates when user performs tracked actions

Socket Event Structure:
```
{
  "event": "stream:last-action",
  "data": {
    "id": "uuid",
    "type": "navigate_book",
    "user": {...},
    "target": {...},
    "timestamp": "ISO8601",
    "metadata": {...}
  }
}
```

### Integration Points

#### Existing Activity Feed Integration

Last Actions tab includes:
- All activities from Global Stream tab (news, books, comments, reviews)
- Additional navigation and messaging actions
- Unified display format for seamless user experience
- Chronological sorting by creation timestamp

Data retrieval strategy:
- Query both activity_feed and user_actions tables
- Union results based on created_at timestamp
- Apply single sort order (descending by time)
- Return unified activity list

#### Middleware Integration

Action logging middleware placement:
- Applied to all authenticated routes
- Fires after authentication verification
- Executes before route handler
- Non-blocking (fire-and-forget pattern for logging)

Exception handling:
- Logging failures do not affect user request
- Errors logged separately for monitoring
- Graceful degradation if database unavailable

## User Experience

### Visual Design Consistency

- Follow existing ActivityCard design patterns
- Use consistent spacing, typography, and colors
- Apply same hover states and transitions
- Maintain responsive layout for mobile devices

### Loading States

- Display skeleton loaders during initial fetch
- Show "Loading more..." indicator for pagination
- Display empty state message when no activities exist
- Error state with retry button for failed requests

### Empty State

When no activities are available:
- Icon: Activity/Zap icon
- Message (en): "No recent actions to display"
- Message (ru): "Нет недавних действий для отображения"
- Subtext: "User activities will appear here as they interact with the platform"

## Privacy and Security

### Data Access Control

- Action logging only for authenticated users
- Anonymous users do not generate action records
- Public data visibility only (no private conversations)
- User profile links respect existing access controls

### Data Retention

- Implement automatic cleanup of old action records
- Default retention period: 30 days
- Configurable via environment variable
- Database cleanup job runs daily

### Sensitive Information Handling

- Message previews limited to 100 characters
- No sensitive user data in metadata
- Profile URLs validated before storage
- XSS protection through proper escaping

## Testing Considerations

### Functional Testing

Test scenarios:
- Navigation to each tracked page type logs correct action
- Public group messages logged with proper metadata
- Private group messages not logged
- Real-time updates appear in Last Actions tab
- Pagination works correctly with large datasets
- Timestamp display formats correctly

### Performance Testing

Benchmarks:
- Action logging adds < 50ms overhead per request
- Last Actions tab loads within 2 seconds
- Database queries execute in < 100ms
- Real-time updates delivered in < 1 second
- System handles 1000+ concurrent logging operations

### Security Testing

Verify:
- Unauthenticated users cannot log actions
- Private content never appears in feed
- SQL injection prevention in queries
- XSS prevention in activity rendering
- Rate limiting on action logging endpoint

## Deployment Strategy

### Database Migration

Migration steps:
1. Create user_actions table with indexes
2. Deploy backend code with logging middleware (disabled)
3. Verify table creation and structure
4. Enable logging middleware via feature flag
5. Deploy frontend with new tab
6. Monitor logging performance and adjust as needed

### Feature Flag Control

Configuration:
- Environment variable: ENABLE_LAST_ACTIONS_TRACKING
- Default: false (disabled)
- Allows gradual rollout and quick disable if issues arise

### Monitoring

Track metrics:
- Action logging rate (actions per minute)
- Database write performance
- API endpoint response times
- Error rates in logging middleware
- User engagement with Last Actions tab

## Future Enhancements

### Potential Extensions

- User filtering (view actions by specific user)
- Action type filtering (show only navigation or only messages)
- Time range filtering (last hour, today, this week)
- Export activity history for analysis
- User opt-out preference for action tracking
- Admin analytics dashboard for activity insights
- Action heatmaps showing popular pages/content

### Scalability Improvements

- Partition user_actions table by date
- Implement read replicas for query performance
- Cache frequently accessed activity data
- Archive old records to separate storage
- Consider time-series database for high-volume scenarios

## Success Metrics

### Key Performance Indicators

- Last Actions tab engagement rate (% of stream page views)
- Average time spent on Last Actions tab
- Click-through rate on activity links
- Real-time update latency (p95, p99)
- Action logging success rate (> 99.9%)
- Database query performance (< 100ms p95)

### User Feedback

Collect feedback on:
- Usefulness of last actions visibility
- Privacy concerns or preferences
- Desired additional action types
- UI/UX improvements
- Performance perception
