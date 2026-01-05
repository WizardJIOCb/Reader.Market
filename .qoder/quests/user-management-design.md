# User Management Section Design Document

## Overview
This document outlines the design for a User Management section in the admin panel that will allow administrators to view and manage all users in the system.

## Requirements
- Display a list of all users with pagination (10 users per page)
- Sort users with newest at the top and oldest at the bottom
- For each user, display:
  - Login and full name
  - Status (admin, user, moderator, etc.)
  - Registration date
  - Last login date
  - Number of shelves
  - Number of books on shelves
  - Number of comments
  - Number of reviews
- Allow admin to change user's password
- Allow admin to impersonate a user (log in as that user without login/password in a new window)

## Backend Implementation

### New API Endpoints

#### GET `/api/admin/users`
- Retrieve paginated list of users
- Query parameters:
  - `page` (default: 1)
  - `limit` (default: 10)
- Response includes user information and statistics

#### PUT `/api/admin/users/:id/password`
- Change a user's password
- Requires admin access level
- Request body: `{ newPassword: string }`

#### POST `/api/admin/users/:id/impersonate`
- Generate a temporary token for user impersonation
- Requires admin access level
- Response: `{ token: string, userId: string }`

### Storage Methods to Implement
- `getUsersWithStats(page: number, limit: number)`: Get users with their statistics
- `getUserStats(userId: string)`: Get specific user statistics
- `changeUserPassword(userId: string, newPassword: string)`: Update user password
- `impersonateUser(adminId: string, targetUserId: string)`: Handle user impersonation

## Frontend Implementation

### User Management Component
- Paginated table displaying user information
- Columns:
  - Username
  - Full Name
  - Access Level
  - Registration Date
  - Last Login Date
  - Shelves Count
  - Books Count
  - Comments Count
  - Reviews Count
  - Actions (Change Password, Impersonate)

### Pagination Component
- Navigate between pages of users
- Show 10 users per page
- Display current page and total pages

### Change Password Modal
- Form to change a user's password
- Input for new password
- Confirmation button

### Impersonate User Functionality
- Button to impersonate a user
- Opens new window/tab with impersonation token
- Secure handling of impersonation tokens

## Database Considerations

### User Statistics Query
The query will join multiple tables to get user statistics:
- `users` table for basic user information
- `shelves` table to count user shelves
- `shelf_books` table to count books on shelves
- `comments` table to count user comments
- `reviews` table to count user reviews

### Access Level Validation
- All endpoints require admin or moderator access level
- Validation middleware will check user permissions

## Security Considerations
- Impersonation tokens should have short expiration times
- Log all impersonation activities for audit purposes
- Password changes should follow security best practices
- Prevent unauthorized access to user management functions

## User Experience Flow

### Viewing Users
1. Admin navigates to User Management section
2. System displays first page of users (10 per page)
3. Users sorted by registration date (newest first)
4. Each row shows all required information

### Changing Password
1. Admin clicks "Change Password" for a user
2. Modal appears with password form
3. Admin enters new password
4. System updates user's password

### Impersonating User
1. Admin clicks "Impersonate" for a user
2. System generates temporary token
3. New window opens with user's session
4. Admin can experience the platform as that user

## Implementation Steps
1. Create backend API endpoints for user management
2. Implement storage methods to retrieve user statistics
3. Create frontend User Management component
4. Add pagination functionality
5. Implement change password feature
6. Implement user impersonation feature
7. Add security measures and audit logging
8. Test all functionality thoroughly