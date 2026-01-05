# Admin User Management Design Document

## Overview

The Admin User Management feature provides administrators with tools to manage users within the reader.market application. This includes viewing all users, changing passwords, impersonating users, and managing access levels. The feature is designed to maintain security while providing necessary administrative capabilities.

## System Architecture

### Frontend Components
- **User Management Page**: The main interface for admin user management
- **User Table**: Displays users with pagination and statistics
- **Action Buttons**: For changing passwords and impersonating users
- **Modal Dialogs**: For performing sensitive operations

### Backend Services
- **API Endpoints**: RESTful endpoints for user management operations
- **Database Storage**: PostgreSQL database with Drizzle ORM
- **Authentication**: JWT-based authentication with role-based access control

## Functional Requirements

### User List View
- Display all users with pagination
- Show user statistics (shelves count, books count, comments count, reviews count)
- Display user access level with visual indicators
- Show registration date and last login information
- Support pagination for large user bases

### User Details
- Username and full name
- Access level (admin, moder, user)
- Registration date
- Last login timestamp
- User statistics (shelves, books, comments, reviews)

### Administrative Actions
- Change user password
- Impersonate user account
- Update user access level (admin, moder, user)

## API Endpoints

### GET /api/admin/users
- **Purpose**: Retrieve paginated list of all users with statistics
- **Authentication**: Admin or moderator access required
- **Parameters**:
  - `page` (integer, default: 1): Page number for pagination
  - `limit` (integer, default: 10): Number of users per page
- **Response**: JSON object containing users array and pagination metadata

### PUT /api/admin/users/:userId/password
- **Purpose**: Change a user's password
- **Authentication**: Admin or moderator access required
- **Request Body**:
  - `newPassword` (string): New password for the user (min 6 characters)
- **Response**: Updated user object without password field

### POST /api/admin/users/:userId/impersonate
- **Purpose**: Generate impersonation token for a user
- **Authentication**: Admin or moderator access required
- **Response**: Token for impersonation and user information

### PUT /api/admin/users/:userId/access-level
- **Purpose**: Update user access level
- **Authentication**: Admin access required
- **Request Body**:
  - `accessLevel` (string): New access level ('admin', 'moder', 'user')
- **Response**: Updated user object without password field

## Data Models

### User Object
```typescript
interface User {
  id: string;
  username: string;
  fullName: string;
  accessLevel: string; // 'admin', 'moder', 'user'
  createdAt: string;
  lastLogin: string | null;
  shelvesCount: number;
  booksOnShelvesCount: number;
  commentsCount: number;
  reviewsCount: number;
}
```

### Pagination Object
```typescript
interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
```

### Response Format
```typescript
interface UserWithStats {
  users: User[];
  pagination: Pagination;
}
```

## Security Considerations

### Authentication
- All admin endpoints require valid JWT token
- Token must belong to user with admin or moderator access level
- Access level verification happens at middleware level

### Authorization
- Only admin users can change access levels
- Admin and moderator users can change passwords and impersonate
- All operations are logged for audit purposes

### Impersonation Security
- Impersonation tokens have limited lifespan (1 hour)
- Impersonation actions are tracked with original admin information
- Tokens are invalidated after use

## User Interface Design

### User Management Page
The page displays a table with the following columns:
- Login (username)
- Name (full name or N/A)
- Status (access level with color-coded badge)
- Registration Date
- Last Login
- Shelves count
- Books count
- Comments count
- Reviews count
- Actions (Change Password, Impersonate buttons)

### Action Dialogs
- **Change Password Dialog**: Secure form for updating user passwords
- **Impersonation Dialog**: Confirmation for impersonating user accounts

## Error Handling

### Common Error Responses
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions for requested operation
- **404 Not Found**: Requested user does not exist
- **500 Internal Server Error**: Server-side processing error

### Client-Side Error Handling
- Toast notifications for user feedback
- Form validation before submission
- Loading states during API requests

## Performance Considerations

### Database Queries
- Optimized queries with proper indexing
- Pagination to handle large user datasets
- Aggregated statistics calculated efficiently

### Caching
- User data caching where appropriate
- Statistics aggregation optimized for performance

## Implementation Notes

### Backend Implementation
The backend implementation uses:
- Drizzle ORM for database operations
- PostgreSQL for data storage
- JWT for authentication
- bcrypt for password hashing

### Frontend Implementation
The frontend implementation includes:
- React components with TypeScript
- Pagination controls
- Modal dialogs for sensitive operations
- Form validation and error handling

## Testing Considerations

### API Testing
- Authentication and authorization verification
- Input validation testing
- Error response validation
- Pagination functionality testing

### UI Testing
- Component rendering verification
- Form submission testing
- Modal dialog interaction
- Pagination controls functionality- Modal dialog interaction
- Pagination controls functionality