# Statistics for Books

## Overview
This document outlines the design for implementing book statistics that will be displayed in book cards throughout the application. The feature will track two key metrics:
1. Book card view counts (where reviews and comments are shown)
2. Book reader open counts (when users open books in the reader)

These statistics will appear in book cards after the reviews/comments count and before the last activity information.

## Requirements

### Functional Requirements
- Track the number of times a book card is viewed (where reviews and comments are displayed)
- Track the number of times a book is opened in the reader
- Display these statistics in book cards throughout the application
- Statistics should be visible to all users viewing the book card
- Statistics should be updated in real-time when actions occur

### Non-Functional Requirements
- Statistics tracking should not significantly impact application performance
- Data should be persisted reliably in the database
- The feature should be scalable to handle many books and users
- Statistics should be updated efficiently without blocking UI interactions

## System Architecture

### Database Schema Changes
The existing database already has some statistics tables (`reading_statistics` and `user_statistics`), but we need to add specific tables for book view statistics:

1. `book_view_statistics` table:
   - `id`: Primary key (UUID)
   - `book_id`: Foreign key referencing books table
   - `view_type`: Enum indicating type of view ('card_view' or 'reader_open')
   - `view_count`: Integer count of views
   - `last_viewed_at`: Timestamp of last view
   - `created_at`: Timestamp of record creation
   - `updated_at`: Timestamp of last update

### Frontend Components
- BookCard component will be updated to display the new statistics
- BookDetail page will trigger card view statistics updates
- Reader page will trigger reader open statistics updates

### Backend Services
- API endpoints to update statistics
- Storage layer methods to persist statistics data
- Integration with existing routes to handle statistics updates

## Data Flow

### Book Card View Tracking
1. User navigates to BookDetail page (where reviews and comments are shown)
2. Frontend sends request to backend to increment card view count
3. Backend updates statistics in database
4. Statistics are displayed in book cards throughout the application

### Book Reader Open Tracking
1. User opens book in reader (navigates to Reader page)
2. Frontend sends request to backend to increment reader open count
3. Backend updates statistics in database
4. Statistics are displayed in book cards throughout the application

## Implementation Approach

### Backend Implementation
- Add new API endpoints for updating book statistics
- Implement storage methods for statistics persistence
- Modify existing book retrieval methods to include statistics
- Ensure statistics updates are efficient and non-blocking

### Frontend Implementation
- Update BookCard component to display new statistics
- Add API calls to increment statistics when appropriate
- Ensure UI updates reflect the latest statistics
- Maintain existing functionality while adding new features

## User Interface Considerations

### Book Card Display
The new statistics will be displayed in the BookCard component between:
- The existing review/comment counts (already implemented)
- The last activity date information

The display format will be:
```
👁️ X просмотров карточки | 📖 Y открытий в читалке
```

### Responsive Design
- Statistics display should be responsive and adapt to different screen sizes
- On smaller screens, statistics might be displayed in a more compact format
- Ensure readability of statistics across all device types

## Performance Considerations

### Caching Strategy
- Consider caching frequently accessed statistics to improve performance
- Implement cache invalidation when statistics are updated
- Balance between data freshness and performance

### Database Optimization
- Ensure proper indexing on statistics tables for efficient queries
- Optimize statistics update operations to minimize database load
- Consider batch updates for high-frequency operations

## Security and Access Control

### Data Privacy
- Statistics are public and visible to all users
- No sensitive information should be stored in statistics
- Ensure statistics cannot be manipulated by unauthorized users

### Rate Limiting
- Implement rate limiting to prevent abuse of statistics endpoints
- Prevent users from artificially inflating statistics through automation

## Error Handling

### Failure Scenarios
- Handle database connection failures gracefully
- Statistics updates should not block core functionality
- Implement fallback behavior when statistics are unavailable

### Logging
- Log statistics update operations for monitoring
- Track any failures in statistics updates
- Monitor for unusual patterns in statistics updates- Track any failures in statistics updates
- Monitor for unusual patterns in statistics updates