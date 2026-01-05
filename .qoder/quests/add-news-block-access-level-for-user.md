# Design Document: Add News Block with User Access Levels

## Overview
This document outlines the design for adding a news block to the landing page with user access levels and admin functionality. The implementation will include:
- Adding a news block to the landing page before the "How It Works" section
- Implementing user access levels (admin, moder, etc.)
- Creating admin functionality for managing news and comments/reviews
- Assigning specific access rights to user WizardJIOCb

## System Architecture

### User Access Control
The system will implement a role-based access control (RBAC) system by extending the existing user schema with an access level field.

#### User Schema Extension
- Add `accessLevel` field to the users table with values: 'admin', 'moder', 'user'
- Default value will be 'user' for new accounts
- The specific user WizardJIOCb will be assigned 'admin' access level
- Update shared/schema.ts to include the new field in the Drizzle schema definition

### News Management System
A new news module will be implemented with the following components:
- News entity with title, content, author, creation date, and publication status
- Admin interface for creating, editing, and deleting news
- Display logic for showing news on the landing page

### Admin Interface
The admin panel will be accessible only to users with 'admin' or 'moder' access levels and will include:
- News management section
- Comments and reviews moderation section

## Component Design

### Frontend Components
1. **NewsBlock Component**
   - Displays latest news items on the landing page
   - Located before the "How It Works" section
   - Responsive design compatible with existing layout

2. **AdminDashboard Component**
   - Accessible only to admin/moder users
   - Contains navigation to different admin sections
   - News management interface
   - Comments/reviews moderation interface

3. **NewsManagement Component**
   - Form for creating/editing news
   - Table/list view for existing news
   - CRUD operations for news items

4. **CommentsModeration Component**
   - Displays pending/new comments and reviews
   - Tools for approving, editing, or deleting content
   - Filtering and search capabilities

### Backend Endpoints
1. **News API Endpoints**
   - GET `/api/news` - Retrieve published news
   - GET `/api/news/:id` - Retrieve specific news item
   - POST `/api/admin/news` - Create news (admin/moder only)
   - PUT `/api/admin/news/:id` - Update news (admin/moder only)
   - DELETE `/api/admin/news/:id` - Delete news (admin/moder only)

2. **Admin Validation Middleware**
   - Middleware to check user access level before allowing admin operations
   - Will verify that user has 'admin' or 'moder' access level

3. **Comments/Reviews Moderation Endpoints**
   - GET `/api/admin/comments/pending` - Get pending comments
   - GET `/api/admin/reviews/pending` - Get pending reviews
   - DELETE `/api/admin/comments/:id` - Delete comment (admin/moder only)
   - DELETE `/api/admin/reviews/:id` - Delete review (admin/moder only)

## Database Schema Changes

### Users Table Extension
The existing users table will be extended with an access level field:
- `accessLevel` - text field with default value 'user'
- Values: 'admin', 'moder', 'user'
- Database migration will be created to add this field to the existing users table

### News Table
A new news table will be created with the following structure:
- `id` - Primary key, varchar with random UUID default
- `title` - Text, not null
- `content` - Text, not null
- `authorId` - Foreign key referencing users.id
- `published` - Boolean, default false
- `publishedAt` - Timestamp, nullable
- `createdAt` - Timestamp with default now
- `updatedAt` - Timestamp with default now
- Migration will be created to add this table to the database

## User Experience Flow

### Landing Page News Block
1. When loading the landing page, news items will be fetched from the API
2. News items will be displayed in a visually appealing block before the "How It Works" section
3. Each news item will show title, excerpt, author, and publication date

### Admin Access Flow
1. Only users with 'admin' or 'moder' access level can access admin sections
2. Admin navigation will be available in the main navigation for authorized users
3. Unauthorized access attempts will be redirected or show access denied message

### News Management Flow
1. Admin/moder users can create new news through the admin interface
2. News items can be saved as drafts (published = false) or published immediately
3. Published news will appear on the landing page
4. Admins can edit or delete existing news items

### Comments/Reviews Moderation Flow
1. New comments and reviews will be visible in the moderation section
2. Moderators can review, edit, or delete inappropriate content
3. Content remains visible to users until deleted by a moderator

## Security Considerations
- All admin functionality will be protected by access level validation
- Input validation and sanitization for all user-generated content
- Proper authentication checks on all endpoints
- Prevention of unauthorized access to admin sections

## Implementation Strategy
1. Create database migration to add accessLevel field to users table and create news table
2. Update shared/schema.ts to include the new accessLevel field and news schema
3. Extend storage.ts with methods for news management and user access level operations
4. Update routes.ts with new API endpoints for news and admin functionality
5. Create the news block component for the landing page
6. Develop admin dashboard components and routing
7. Implement admin validation middleware
8. Create news management interface
9. Add comments/reviews moderation interface
10. Assign admin access level to user WizardJIOCb through database update or admin interface

## Dependencies and Integration
- The new components will integrate with the existing authentication system
- Will use the same UI framework as the rest of the application
- Will follow existing code patterns and conventions

## Database Schema Update Process

To update the database schema on the server, the following console commands will be used:

1. After creating the migration files locally:
   - `npx drizzle-kit generate` - to generate the migration files

2. To apply migrations to the production database:
   - `npx drizzle-kit push` - to apply the schema changes directly, OR
   - `npx drizzle-kit migrate` - to run the migration files in sequence

The schema update should be performed as part of the deployment process, after the code changes have been deployed to the server. This ensures that the database structure matches the application expectations. The migration process should be done separately from the code deployment to ensure database integrity and allow for rollback if needed.