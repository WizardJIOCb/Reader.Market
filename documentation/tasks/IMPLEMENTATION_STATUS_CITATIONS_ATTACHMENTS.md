# Implementation Status: Message Citations, Replies, Emoji, and File Attachments

**Date**: January 8, 2026
**Status**: Phase 1-3 Backend Partially Complete, Frontend Pending

## Completed Work

### Phase 1: Database Migration ✅
- **Migration File Created**: `migrations/0010_add_message_replies_and_attachments.sql`
  - Added `file_uploads` table with all required fields
  - Added `quoted_message_id`, `quoted_text` to messages table
  - Added `attachment_urls`, `attachment_metadata` to messages, comments, reviews tables
  - Created indexes for performance optimization
  - Migration applied successfully to database

- **Schema Updated**: `shared/schema.ts`
  - Updated messages, comments, reviews tables with new fields
  - Added fileUploads table definition
  - All changes follow Drizzle ORM patterns

### Phase 2: Dependencies ✅
- **Packages Installed**:
  - `emoji-picker-react` - Emoji picker component for React
  - `sharp` - Server-side image processing and thumbnail generation
  - `file-type` - File type detection from magic numbers
  - `sanitize-filename` - Secure filename sanitization
  - `browser-image-compression` - Client-side image compression

### Phase 3: Backend Implementation ✅ (Partial)
#### File Upload API (`server/routes.ts`)
- **POST /api/uploads** ✅
  - Accepts single file upload (multipart/form-data)
  - Validates file type (images: JPEG, PNG, GIF, WEBP; documents: PDF, DOC, DOCX, TXT)
  - 20MB file size limit
  - Generates thumbnails for images (200x200px)
  - Returns upload ID, URL, filename, fileSize, mimeType, thumbnailUrl
  - Files stored in `/uploads/attachments/temp/` directory

- **GET /api/uploads/:uploadId** ✅
  - Authenticated access verification
  - Checks user permissions based on entity type
  - Serves file with appropriate Content-Type headers
  - Returns 403 for unauthorized access
  - Returns 410 for deleted files

- **DELETE /api/uploads/:uploadId** ✅
  - Soft delete implementation
  - Only uploader or admin/moderator can delete
  - Updates deletedAt timestamp

#### Storage Layer (`server/storage.ts`)
- **createFileUpload()** ✅
  - Inserts file record into file_uploads table
  - Returns complete upload record

- **getFileUpload()** ✅
  - Retrieves file upload by ID
  - Returns undefined if not found

- **updateFileUploadThumbnail()** ✅
  - Updates thumbnail URL for image uploads

- **updateFileUploadEntity()** ✅
  - Links uploaded file to message/comment/review
  - Updates entityType and entityId

- **verifyFileAccess()** ✅
  - Comprehensive access control logic
  - Checks conversation membership for message attachments
  - Checks group membership for channel messages
  - Public access for comment/review attachments
  - Uploader always has access

- **softDeleteFileUpload()** ✅
  - Marks file as deleted without physical removal

## Pending Work

### Phase 3: Backend Implementation (Remaining)
#### Message API Updates ⏳
Need to update message creation routes/handlers to:
- Accept `quotedMessageId` and `quotedText` parameters
- Accept `attachments` array with upload IDs
- Link uploaded files to created messages via `updateFileUploadEntity()`
- Return quoted message details in message responses
- Implement GET /api/messages/:messageId/thread endpoint

#### Comment & Review API Updates ⏳
- Update POST /api/books/:bookId/comments to accept attachments
- Update POST /api/books/:bookId/reviews to accept attachments  
- Link attachments to comments/reviews after creation
- Return attachment metadata in GET responses

### Phase 4: Frontend Components ⏳
#### Emoji Picker Component
**File**: `client/src/components/EmojiPicker.tsx`
- Integrate emoji-picker-react library
- Create reusable wrapper component
- Add recent emoji persistence (localStorage)
- Support for all text input contexts
- Mobile-responsive positioning

#### Attachment Components
**Files**:
- `client/src/components/AttachmentButton.tsx` - File picker trigger
- `client/src/components/AttachmentPreview.tsx` - Preview before sending
- `client/src/components/AttachmentDisplay.tsx` - Display in sent messages
- `client/src/lib/fileUploadManager.ts` - Upload service with progress tracking

**Features**:
- File validation (type, size)
- Upload progress indicators
- Image compression before upload
- Thumbnail display
- Multiple file support (max 5)
- Remove attachment before sending
- Lightbox viewer for images
- Download handler for documents

#### Quoted Message Components
**Files**:
- `client/src/components/QuotedMessagePreview.tsx` - Preview in input area
- `client/src/components/MessageWithQuote.tsx` - Display quoted message in chat

**Features**:
- Show sender name and avatar
- Truncate long messages (3 lines max)
- Click to scroll to original message
- "[Message Deleted]" placeholder for deleted messages
- Visual styling (border, background color)

### Phase 5: UI Integration ⏳
#### Messages.tsx Updates
- Add emoji picker button to input toolbar
- Add attachment button to input toolbar
- Add reply button to message hover menu
- Integrate QuotedMessagePreview in input area
- Integrate MessageWithQuote for displaying replies
- Handle text selection for quoting
- Update message submission to include attachments and quotes
- Add AttachmentDisplay for message attachments

#### CommentsSection.tsx Updates
- Add emoji picker to comment input
- Add attachment button to comment input
- Display attachments in comments
- Update comment submission API calls

#### ReviewsSection.tsx Updates
- Add emoji picker to review input
- Add attachment button to review input
- Display attachments in reviews
- Update review submission API calls

### Phase 6: Testing ⏳
#### Functional Testing
- Message reply with quote display
- Text selection quoting
- Emoji insertion in all contexts
- File upload (images and documents)
- Attachment display and download
- Access control verification
- Thumbnail generation

#### Edge Cases
- Reply to deleted message
- Very long messages with quotes
- Multiple attachments
- Large file uploads
- Unsupported file types
- Network interruptions during upload
- Concurrent uploads

## Technical Notes

### File Storage Structure
```
uploads/
├── attachments/
│   └── temp/
│       ├── {timestamp}-{filename}.ext
│       └── thumb_{timestamp}-{filename}.ext
├── messages/
│   └── {year}/{month}/
├── comments/
│   └── {year}/{month}/
└── reviews/
    └── {year}/{month}/
```

### Database Schema Changes
```sql
-- file_uploads table
CREATE TABLE file_uploads (
  id VARCHAR PRIMARY KEY,
  uploader_id VARCHAR NOT NULL REFERENCES users(id),
  file_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id VARCHAR,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- messages table additions
ALTER TABLE messages 
  ADD COLUMN quoted_message_id VARCHAR REFERENCES messages(id),
  ADD COLUMN quoted_text TEXT,
  ADD COLUMN attachment_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN attachment_metadata JSONB;

-- Similar for comments and reviews tables
```

### API Endpoints Summary

#### Implemented ✅
- POST /api/uploads - Upload file attachment
- GET /api/uploads/:uploadId - Download/view attachment
- DELETE /api/uploads/:uploadId - Delete attachment

#### Pending ⏳
- POST /api/messages - Enhanced with quotes and attachments
- GET /api/messages/:messageId/thread - Get reply thread
- POST /api/books/:bookId/comments - Enhanced with attachments
- POST /api/books/:bookId/reviews - Enhanced with attachments

## Next Steps

1. **Complete Backend Message API** (1-2 hours)
   - Find and update message creation routes
   - Add quote and attachment support
   - Test with API client (Postman/Insomnia)

2. **Create Frontend Components** (4-6 hours)
   - Build all required React components
   - Implement file upload manager service
   - Add emoji picker integration
   - Create visual components for quotes and attachments

3. **Integrate UI Components** (3-4 hours)
   - Update Messages.tsx with all features
   - Update CommentsSection.tsx
   - Update ReviewsSection.tsx
   - Add proper error handling and loading states

4. **Testing & Bug Fixes** (2-3 hours)
   - Manual testing of all features
   - Fix any discovered issues
   - Test edge cases
   - Verify access control

5. **Production Deployment** (1 hour)
   - Run migration on production database
   - Deploy updated backend code
   - Deploy updated frontend code
   - Monitor for errors

**Estimated Total Remaining Time**: 11-16 hours

## Dependencies Between Tasks

```
Backend Complete → Frontend Components → UI Integration → Testing
     ↓                     ↓                    ↓            ↓
File Upload API    Emoji Picker       Messages.tsx    Upload/Download
Message API        Attachments        Comments         Quoting
Storage Layer      Quotes             Reviews          Permissions
```

## Known Issues & Considerations

1. **File Cleanup**: Need to implement cleanup job for temp files older than 1 hour
2. **Storage Limits**: No per-user storage quota implemented yet
3. **Virus Scanning**: No virus scanning on uploaded files (future enhancement)
4. **CDN Integration**: Files served directly from server (consider CDN for scale)
5. **Resumable Uploads**: Not implemented for large files (future enhancement)
6. **Message Threading**: Only 1 level of quotes supported (no nested replies)

## Security Measures Implemented

- ✅ File type whitelist validation
- ✅ File size limits (20MB)
- ✅ Filename sanitization
- ✅ Authentication required for all operations
- ✅ Access control based on conversation/group membership
- ✅ Soft delete (preserves audit trail)
- ✅ Path traversal prevention

## Performance Optimizations

- ✅ Thumbnail generation for images
- ✅ Database indexes on file_uploads
- ✅ Lazy loading of attachments
- ⏳ Client-side image compression (pending frontend)
- ⏳ CDN for file serving (future)
- ⏳ Caching of attachment URLs (pending frontend)

## Contact & Support

For questions about this implementation:
- See design document: `.qoder/quests/citation-and-reply-feature.md`
- Migration file: `migrations/0010_add_message_replies_and_attachments.sql`
- Backend routes: `server/routes.ts` (lines 3333-3514)
- Storage layer: `server/storage.ts` (lines 3519-3638)
# Implementation Status: Message Citations, Replies, Emoji, and File Attachments

**Date**: January 8, 2026
**Status**: Phase 1-3 Backend Partially Complete, Frontend Pending

## Completed Work

### Phase 1: Database Migration ✅
- **Migration File Created**: `migrations/0010_add_message_replies_and_attachments.sql`
  - Added `file_uploads` table with all required fields
  - Added `quoted_message_id`, `quoted_text` to messages table
  - Added `attachment_urls`, `attachment_metadata` to messages, comments, reviews tables
  - Created indexes for performance optimization
  - Migration applied successfully to database

- **Schema Updated**: `shared/schema.ts`
  - Updated messages, comments, reviews tables with new fields
  - Added fileUploads table definition
  - All changes follow Drizzle ORM patterns

### Phase 2: Dependencies ✅
- **Packages Installed**:
  - `emoji-picker-react` - Emoji picker component for React
  - `sharp` - Server-side image processing and thumbnail generation
  - `file-type` - File type detection from magic numbers
  - `sanitize-filename` - Secure filename sanitization
  - `browser-image-compression` - Client-side image compression

### Phase 3: Backend Implementation ✅ (Partial)
#### File Upload API (`server/routes.ts`)
- **POST /api/uploads** ✅
  - Accepts single file upload (multipart/form-data)
  - Validates file type (images: JPEG, PNG, GIF, WEBP; documents: PDF, DOC, DOCX, TXT)
  - 20MB file size limit
  - Generates thumbnails for images (200x200px)
  - Returns upload ID, URL, filename, fileSize, mimeType, thumbnailUrl
  - Files stored in `/uploads/attachments/temp/` directory

- **GET /api/uploads/:uploadId** ✅
  - Authenticated access verification
  - Checks user permissions based on entity type
  - Serves file with appropriate Content-Type headers
  - Returns 403 for unauthorized access
  - Returns 410 for deleted files

- **DELETE /api/uploads/:uploadId** ✅
  - Soft delete implementation
  - Only uploader or admin/moderator can delete
  - Updates deletedAt timestamp

#### Storage Layer (`server/storage.ts`)
- **createFileUpload()** ✅
  - Inserts file record into file_uploads table
  - Returns complete upload record

- **getFileUpload()** ✅
  - Retrieves file upload by ID
  - Returns undefined if not found

- **updateFileUploadThumbnail()** ✅
  - Updates thumbnail URL for image uploads

- **updateFileUploadEntity()** ✅
  - Links uploaded file to message/comment/review
  - Updates entityType and entityId

- **verifyFileAccess()** ✅
  - Comprehensive access control logic
  - Checks conversation membership for message attachments
  - Checks group membership for channel messages
  - Public access for comment/review attachments
  - Uploader always has access

- **softDeleteFileUpload()** ✅
  - Marks file as deleted without physical removal

## Pending Work

### Phase 3: Backend Implementation (Remaining)
#### Message API Updates ⏳
Need to update message creation routes/handlers to:
- Accept `quotedMessageId` and `quotedText` parameters
- Accept `attachments` array with upload IDs
- Link uploaded files to created messages via `updateFileUploadEntity()`
- Return quoted message details in message responses
- Implement GET /api/messages/:messageId/thread endpoint

#### Comment & Review API Updates ⏳
- Update POST /api/books/:bookId/comments to accept attachments
- Update POST /api/books/:bookId/reviews to accept attachments  
- Link attachments to comments/reviews after creation
- Return attachment metadata in GET responses

### Phase 4: Frontend Components ⏳
#### Emoji Picker Component
**File**: `client/src/components/EmojiPicker.tsx`
- Integrate emoji-picker-react library
- Create reusable wrapper component
- Add recent emoji persistence (localStorage)
- Support for all text input contexts
- Mobile-responsive positioning

#### Attachment Components
**Files**:
- `client/src/components/AttachmentButton.tsx` - File picker trigger
- `client/src/components/AttachmentPreview.tsx` - Preview before sending
- `client/src/components/AttachmentDisplay.tsx` - Display in sent messages
- `client/src/lib/fileUploadManager.ts` - Upload service with progress tracking

**Features**:
- File validation (type, size)
- Upload progress indicators
- Image compression before upload
- Thumbnail display
- Multiple file support (max 5)
- Remove attachment before sending
- Lightbox viewer for images
- Download handler for documents

#### Quoted Message Components
**Files**:
- `client/src/components/QuotedMessagePreview.tsx` - Preview in input area
- `client/src/components/MessageWithQuote.tsx` - Display quoted message in chat

**Features**:
- Show sender name and avatar
- Truncate long messages (3 lines max)
- Click to scroll to original message
- "[Message Deleted]" placeholder for deleted messages
- Visual styling (border, background color)

### Phase 5: UI Integration ⏳
#### Messages.tsx Updates
- Add emoji picker button to input toolbar
- Add attachment button to input toolbar
- Add reply button to message hover menu
- Integrate QuotedMessagePreview in input area
- Integrate MessageWithQuote for displaying replies
- Handle text selection for quoting
- Update message submission to include attachments and quotes
- Add AttachmentDisplay for message attachments

#### CommentsSection.tsx Updates
- Add emoji picker to comment input
- Add attachment button to comment input
- Display attachments in comments
- Update comment submission API calls

#### ReviewsSection.tsx Updates
- Add emoji picker to review input
- Add attachment button to review input
- Display attachments in reviews
- Update review submission API calls

### Phase 6: Testing ⏳
#### Functional Testing
- Message reply with quote display
- Text selection quoting
- Emoji insertion in all contexts
- File upload (images and documents)
- Attachment display and download
- Access control verification
- Thumbnail generation

#### Edge Cases
- Reply to deleted message
- Very long messages with quotes
- Multiple attachments
- Large file uploads
- Unsupported file types
- Network interruptions during upload
- Concurrent uploads

## Technical Notes

### File Storage Structure
```
uploads/
├── attachments/
│   └── temp/
│       ├── {timestamp}-{filename}.ext
│       └── thumb_{timestamp}-{filename}.ext
├── messages/
│   └── {year}/{month}/
├── comments/
│   └── {year}/{month}/
└── reviews/
    └── {year}/{month}/
```

### Database Schema Changes
```sql
-- file_uploads table
CREATE TABLE file_uploads (
  id VARCHAR PRIMARY KEY,
  uploader_id VARCHAR NOT NULL REFERENCES users(id),
  file_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id VARCHAR,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- messages table additions
ALTER TABLE messages 
  ADD COLUMN quoted_message_id VARCHAR REFERENCES messages(id),
  ADD COLUMN quoted_text TEXT,
  ADD COLUMN attachment_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN attachment_metadata JSONB;

-- Similar for comments and reviews tables
```

### API Endpoints Summary

#### Implemented ✅
- POST /api/uploads - Upload file attachment
- GET /api/uploads/:uploadId - Download/view attachment
- DELETE /api/uploads/:uploadId - Delete attachment

#### Pending ⏳
- POST /api/messages - Enhanced with quotes and attachments
- GET /api/messages/:messageId/thread - Get reply thread
- POST /api/books/:bookId/comments - Enhanced with attachments
- POST /api/books/:bookId/reviews - Enhanced with attachments

## Next Steps

1. **Complete Backend Message API** (1-2 hours)
   - Find and update message creation routes
   - Add quote and attachment support
   - Test with API client (Postman/Insomnia)

2. **Create Frontend Components** (4-6 hours)
   - Build all required React components
   - Implement file upload manager service
   - Add emoji picker integration
   - Create visual components for quotes and attachments

3. **Integrate UI Components** (3-4 hours)
   - Update Messages.tsx with all features
   - Update CommentsSection.tsx
   - Update ReviewsSection.tsx
   - Add proper error handling and loading states

4. **Testing & Bug Fixes** (2-3 hours)
   - Manual testing of all features
   - Fix any discovered issues
   - Test edge cases
   - Verify access control

5. **Production Deployment** (1 hour)
   - Run migration on production database
   - Deploy updated backend code
   - Deploy updated frontend code
   - Monitor for errors

**Estimated Total Remaining Time**: 11-16 hours

## Dependencies Between Tasks

```
Backend Complete → Frontend Components → UI Integration → Testing
     ↓                     ↓                    ↓            ↓
File Upload API    Emoji Picker       Messages.tsx    Upload/Download
Message API        Attachments        Comments         Quoting
Storage Layer      Quotes             Reviews          Permissions
```

## Known Issues & Considerations

1. **File Cleanup**: Need to implement cleanup job for temp files older than 1 hour
2. **Storage Limits**: No per-user storage quota implemented yet
3. **Virus Scanning**: No virus scanning on uploaded files (future enhancement)
4. **CDN Integration**: Files served directly from server (consider CDN for scale)
5. **Resumable Uploads**: Not implemented for large files (future enhancement)
6. **Message Threading**: Only 1 level of quotes supported (no nested replies)

## Security Measures Implemented

- ✅ File type whitelist validation
- ✅ File size limits (20MB)
- ✅ Filename sanitization
- ✅ Authentication required for all operations
- ✅ Access control based on conversation/group membership
- ✅ Soft delete (preserves audit trail)
- ✅ Path traversal prevention

## Performance Optimizations

- ✅ Thumbnail generation for images
- ✅ Database indexes on file_uploads
- ✅ Lazy loading of attachments
- ⏳ Client-side image compression (pending frontend)
- ⏳ CDN for file serving (future)
- ⏳ Caching of attachment URLs (pending frontend)

## Contact & Support

For questions about this implementation:
- See design document: `.qoder/quests/citation-and-reply-feature.md`
- Migration file: `migrations/0010_add_message_replies_and_attachments.sql`
- Backend routes: `server/routes.ts` (lines 3333-3514)
- Storage layer: `server/storage.ts` (lines 3519-3638)
