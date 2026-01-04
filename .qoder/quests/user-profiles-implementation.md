# User Profiles Implementation Design

## Overview

This document outlines the design for implementing fully functional user profiles in the Reader.market application. The implementation will allow users to have comprehensive profiles with personal information, book shelves, reading statistics, and private messaging capabilities. The application already has a basic profile page with mock data and a frontend messaging interface, but needs backend implementation for private messaging and enhanced profile functionality.

## Goals

- Enhance user profile creation and management with backend support
- Enable viewing of user profiles by clicking on usernames throughout the application
- Display user's book shelves and reading activity with real data
- Implement profile customization features with backend persistence
- Add fully functional private messaging between users
- Enable profile sharing capabilities

## Requirements

### Functional Requirements

1. **Profile Access**
   - Users can click on any username to navigate to that user's profile
   - Profile pages accessible via direct URLs with user ID parameter
   - Support for viewing own profile vs other users' profiles

2. **Profile Content**
   - Personal information display (name, username, bio, profile picture)
   - User's book shelves and associated books
   - Reading statistics and achievements (books read, words read, letters read)
   - Recently read books section
   - Profile header with avatar and follow/share options

3. **Profile Management**
   - Edit personal information (name, bio, profile picture)
   - Update profile with backend persistence
   - Profile settings and visibility options

4. **Private Messaging**
   - Send private messages to other users
   - View message history with other users
   - Real-time message notifications
   - Message threading and conversation management
   - Message composition interface

5. **Profile Sharing**
   - Share profile functionality
   - Direct profile URLs for sharing

### Non-Functional Requirements

- Performance: Profile pages should load within 2 seconds
- Security: Private information must be properly protected
- Scalability: Support for thousands of user profiles
- Privacy: Users control visibility of their profile information

## System Architecture

### Components

1. **Profile Service**
   - Manages user profile data from the existing users table
   - Handles profile retrieval, updates, and display
   - Integrates with existing user authentication

2. **Messaging Service**
   - Handles private message creation and retrieval
   - Manages message threading and conversations
   - Provides real-time messaging capabilities

3. **Profile UI Components**
   - Enhanced profile display components
   - Profile editing interface
   - Messaging interface components

### Data Models

#### User Profile Entity (extends existing users table)
- User ID (Primary Key)
- Username (unique)
- Email
- Full Name
- Bio/Description
- Avatar URL
- Created At
- Updated At

#### Message Entity (new table to be added)
- Message ID (Primary Key)
- Sender ID (references users.id)
- Recipient ID (references users.id)
- Message Content
- Timestamp
- Read Status
- Updated At

#### Conversation Entity (new table to be added)
- Conversation ID (Primary Key)
- User1 ID (references users.id)
- User2 ID (references users.id)
- Last Message ID (references messages.id)
- Created At
- Updated At

## User Interface Design

### Profile Page Layout

The enhanced profile page will feature:
- Header section with profile picture, name, username and message button
- Tabs for different profile sections (About, Shelves)
- Bio section with HTML rendering support
- Statistics grid showing books read, words read, and letters read
- Recently read books section
- User's book shelves with associated books
- Profile editing capabilities for own profile

### Messaging Interface

The messaging interface will include:
- Modal dialog for composing messages
- Message history display
- Real-time message notifications

## Implementation Approach

### Backend Implementation

1. Create new database tables for messaging functionality
   - messages table for storing individual messages
   - conversations table for tracking user conversations
2. Implement API endpoints for:
   - Viewing user profiles by ID
   - Updating user profiles
   - Sending private messages
   - Retrieving message history
   - Managing conversations
3. Enhance existing profile endpoint to support viewing other users' profiles

### Frontend Implementation

1. Enhance existing Profile.tsx to:
   - Fetch and display real profile data based on URL parameter
   - Support viewing other users' profiles
   - Implement profile editing functionality
   - Integrate with messaging system
2. Add click handlers to usernames throughout the application to navigate to user profiles
3. Implement private messaging interface

## Database Schema Changes

### New Tables

1. **Messages Table**
   ```sql
   CREATE TABLE messages (
     id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
     sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     recipient_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     content TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL,
     updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
     read_status BOOLEAN DEFAULT FALSE
   );
   
   CREATE INDEX idx_messages_sender_id ON messages(sender_id);
   CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
   CREATE INDEX idx_messages_created_at ON messages(created_at);
   ```

2. **Conversations Table**
   ```sql
   CREATE TABLE conversations (
     id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
     user1_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     user2_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     last_message_id VARCHAR(255) REFERENCES messages(id),
     created_at TIMESTAMP DEFAULT NOW() NOT NULL,
     updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
     UNIQUE(user1_id, user2_id) -- Prevent duplicate conversations
   );
   
   CREATE INDEX idx_conversations_user1_id ON conversations(user1_id);
   CREATE INDEX idx_conversations_user2_id ON conversations(user2_id);
   ```

## API Endpoints

### Profile Endpoints
- GET /api/profile/:userId - Get specific user profile by ID
- PUT /api/profile - Update current user profile
- GET /api/profile - Get current user profile (existing)

### Messaging Endpoints
- POST /api/messages - Send a new message
- GET /api/messages/:userId - Get message history with specific user
- GET /api/conversations - Get list of conversations for current user
- PUT /api/messages/:messageId/read - Mark message as read

## Security Considerations

- Authentication required for all messaging endpoints
- Authorization checks to ensure users can only access their own messages
- Content validation for profile information and messages
- Rate limiting for messaging functionality
- Privacy controls for profile visibility

## Privacy Controls

- Username and profile information are public by default
- Users can control visibility of specific profile elements
- Message privacy is enforced through authentication

## Implementation Plan

### Phase 1: Profile Enhancement
1. Update the existing Profile page to fetch real data from backend
2. Implement profile viewing by user ID parameter
3. Add click handlers to usernames throughout the application
4. Implement profile editing functionality

### Phase 2: Database Schema
1. Create messages and conversations tables using Drizzle ORM
2. Add the new table definitions to the shared schema
3. Generate and apply database migrations

### Phase 3: Backend API
1. Implement messaging API endpoints
2. Add business logic for conversation management
3. Implement message validation and security checks

### Phase 4: Frontend Messaging UI
1. Integrate messaging functionality with the profile page
2. Implement real-time message notifications
3. Create messaging interface components

### Phase 5: Testing and Deployment
1. Test profile functionality
2. Test messaging functionality
3. Perform integration testing
4. Deploy to production

## Future Enhancements

- Friend/follower system
- Advanced privacy settings
- Profile analytics
- Rich text formatting for messages
- File attachments in messages
- Group messaging
- Message search functionality