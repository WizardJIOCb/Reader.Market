# Fix Book View Tracking Error

## Problem Statement

The book view tracking endpoint returns an error when attempting to track views with any ViewType including `reader_open`, `card_view`, and others.

### Error Details
- Endpoint: `POST /api/books/:bookId/track-view`
- Request Body: `{ viewType: "reader_open" | "card_view" }`
- Response: `{"error":"Failed to track book view"}`
- HTTP Status: 500

### Current Behavior
All requests to track book views fail regardless of the ViewType parameter value, preventing accurate analytics of user engagement with books.

## Root Cause Analysis

The failure occurs in the database layer when attempting to increment view counts. The implementation uses an upsert pattern with conflict resolution, but the database schema is missing a required constraint.

### Technical Details

#### Database Schema Issue
The `book_view_statistics` table structure:
- Has columns: `id`, `book_id`, `view_type`, `view_count`, `last_viewed_at`, `created_at`, `updated_at`
- Has indexes on `book_id` and `view_type` individually
- **Missing**: Unique constraint on the combination of `(book_id, view_type)`

#### Code Implementation
The storage layer method uses PostgreSQL upsert with conflict detection:
- Attempts to insert a new record with initial `view_count` of 1
- On conflict, should update the existing record by incrementing the counter
- Specifies conflict target as `[bookViewStatistics.bookId, bookViewStatistics.viewType]`

#### Why It Fails
PostgreSQL's `ON CONFLICT DO UPDATE` clause requires either:
1. A unique constraint on the specified columns, or
2. A unique index on the specified columns

Without this constraint, the database cannot determine when a conflict occurs, causing the operation to fail and throw an exception.

## Solution Design

### Database Migration

Create a new migration that adds a unique constraint to prevent duplicate entries for the same book and view type combination.

#### Migration Purpose
Ensure data integrity by allowing only one statistics record per book-viewType pair while enabling efficient upsert operations.

#### Constraint Specification
- Target table: `book_view_statistics`
- Constraint type: Unique constraint
- Columns: `(book_id, view_type)`
- Constraint name: `book_view_statistics_book_id_view_type_unique`

#### Migration Considerations

**Pre-migration Data Cleanup**
Before adding the constraint, check for and resolve any existing duplicate records:
- Query to identify duplicates: Find records where `(book_id, view_type)` pairs appear more than once
- Resolution strategy: Merge duplicate records by summing their view counts and keeping the most recent timestamp

**Migration Safety**
- Use a transaction to ensure atomicity
- Include rollback capability
- Test on a copy of production data first

### Code Verification

The existing code implementation is correct and does not require changes. Once the constraint is in place, the upsert pattern will function as designed:

1. First view of a book with a specific view type → Insert new record
2. Subsequent views → Update existing record by incrementing counter
3. Concurrent requests → Handled atomically by the database

### Testing Strategy

#### Unit Testing
Verify the incrementBookViewCount method:
- Test first view creates a new record
- Test subsequent views increment the counter
- Test concurrent requests don't create duplicates

#### Integration Testing
Verify the full endpoint flow:
- Send POST request with `card_view` → Expect success response
- Send POST request with `reader_open` → Expect success response
- Verify database records are created/updated correctly
- Test rapid successive calls to same endpoint

#### Validation Queries
After deployment, run these queries to confirm correct behavior:
- Count total records per book (should equal number of distinct view types)
- Check for any duplicate `(book_id, view_type)` pairs (should be zero)
- Verify view counts are incrementing on repeated views

## Implementation Steps

### Step 1: Data Analysis
Examine the current state of the `book_view_statistics` table to identify any existing duplicates that would prevent constraint creation.

### Step 2: Data Cleanup
If duplicates exist, consolidate them before adding the constraint:
- Aggregate view counts by `(book_id, view_type)`
- Use the latest `last_viewed_at` timestamp
- Delete duplicate records, keeping only the consolidated version

### Step 3: Create Migration File
Create a new migration file that:
- Includes data cleanup logic if needed
- Adds the unique constraint on `(book_id, view_type)`
- Provides rollback instructions

### Step 4: Test Migration
- Apply migration to a development database copy
- Verify constraint is created correctly
- Test the track-view endpoint with various scenarios

### Step 5: Deploy Migration
- Back up production database
- Apply migration during low-traffic period
- Monitor error logs for any issues

### Step 6: Verify Functionality
- Test the endpoint with both view types
- Check database records are being created/updated
- Monitor application logs for any errors
- Verify analytics dashboard reflects accurate counts

## Expected Outcome

After implementing this solution:

### Functional Requirements Met
- Track-view endpoint responds with success for valid requests
- View statistics are accurately recorded in the database
- No duplicate records are created for the same book-viewType combination
- Concurrent requests are handled safely without race conditions

### Performance Characteristics
- Database operations use efficient upsert pattern
- Unique constraint provides fast conflict detection
- Index on the constraint columns enables quick lookups

### Data Integrity
- One record per unique `(book_id, view_type)` pair
- View counts accurately reflect user engagement
- Timestamps track the most recent view for each combination

## Risk Assessment

### Low Risk
This is a schema-only change that adds a constraint to enforce existing business logic. The application code already expects this constraint to exist.

### Potential Issues
- If existing duplicates are present, they must be cleaned up first
- Brief table lock during constraint creation (typically milliseconds)
- Any in-flight requests during migration might fail temporarily

### Mitigation
- Analyze data before migration
- Apply during maintenance window or low-traffic period
- Have rollback plan ready
- Monitor closely after deployment

## Future Considerations

### Additional View Types
The current implementation supports `card_view` and `reader_open`. If additional view types are needed in the future, no schema changes are required—simply pass the new view type value.

### Analytics Enhancements
Consider adding aggregate views or materialized tables for:
- Daily/weekly/monthly view summaries
- Most viewed books by time period
- View type distribution analytics

### Performance Monitoring
Track the following metrics post-deployment:
- Response time of track-view endpoint
- Database query performance for view statistics
- Error rate of view tracking operations
