# Image Loading Issue in Production - Design Document

## Problem Statement

Images uploaded through the messaging system and comments functionality fail to load on the production server. The HTML contains blob URLs that are only valid in the client's browser memory, not accessible across page loads or different sessions.

### Observed Symptoms

1. Images in messages and comments display as broken with blob URLs in HTML:
   ```
   <img src="blob:https://reader.market/b41bc340-306d-4034-9d5b-64793985ba4d">
   ```

2. Direct navigation to blob URLs returns "Page Not Found" (404 error)

3. Issue only occurs in production environment, not in local development

## Root Cause Analysis

### The Blob URL Problem

The application creates temporary blob URLs using `URL.createObjectURL()` during the upload preview phase (AttachmentPreview.tsx, line 129). These blob URLs:

- Exist only in browser memory for the current page session
- Are not transferable between users or page reloads
- Are meant for temporary preview, not permanent storage
- Have format `blob:https://domain/uuid` which is never accessible from the server

### Where Blob URLs Are Created

**AttachmentPreview Component** (client/src/components/AttachmentPreview.tsx):
- Line 129: Creates blob URL for image preview before upload
- Line 132: Properly revokes blob URL after image loads in preview
- This is correct behavior for preview functionality

### Why This Breaks in Production

The issue occurs because the uploaded file metadata stored in the database or passed to the display component contains blob URLs instead of actual server file paths. When AttachmentDisplay component attempts to load images, it receives these invalid blob URLs.

**Current Flow in AttachmentDisplay** (client/src/components/AttachmentDisplay.tsx):
- Line 41-43: Checks if URL starts with 'blob:' or 'http' and uses it directly
- Line 46: Hardcoded localhost URL for non-blob/http URLs
- Line 46: `const fullUrl = 'http://localhost:5001${imageUrl}'` - This won't work in production

### The Localhost Problem

Even when the application tries to fetch images from the server, it uses a hardcoded localhost URL (AttachmentDisplay.tsx, line 46), which fails in production where the backend is not at `localhost:5001`.

## Technical Context

### File Upload Architecture

**Upload Flow:**
1. User selects file → AttachmentButton component
2. File passed to AttachmentPreview → Creates blob URL for preview
3. File uploaded via fileUploadManager → POST /api/uploads
4. Server stores file in `/uploads/attachments/temp/` directory
5. Server returns metadata with proper file path (`/uploads/attachments/temp/{filename}`)
6. File metadata should be attached to message/comment with server path

**Storage Structure:**
| Directory | Purpose |
|-----------|---------|
| `/uploads/attachments/temp/` | Temporary uploaded files before entity association |
| `/uploads/avatars/` | User avatar images |
| `/uploads/coverImage-*.{ext}` | Book cover images |

**File Upload Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| uploadId | string | Unique identifier for the upload |
| url | string | Server path to access the file (e.g., `/uploads/attachments/temp/file.jpg`) |
| filename | string | Original filename |
| fileSize | number | Size in bytes |
| mimeType | string | MIME type of the file |
| thumbnailUrl | string | Path to thumbnail for images (optional) |

### Static File Serving

**Development Environment:**
- Backend serves on port 5001
- Frontend dev server on port 3001
- Static files served via Express: `app.use('/uploads', express.static(uploadsPath))`
- Cross-origin requests handled via CORS

**Production Environment:**
- Single port deployment (typically port 5001)
- Nginx reverse proxy handles SSL and routing
- Static files should be served through the same domain
- No CORS issues as everything is same-origin

### Current Implementation Issues

1. **Blob URL Persistence**: Blob URLs from preview are somehow being stored instead of server paths

2. **Hardcoded Localhost**: AttachmentDisplay uses `localhost:5001` which doesn't exist in production

3. **Base URL Missing**: No environment-aware API base URL configuration

4. **Path Resolution**: The application doesn't distinguish between relative server paths and absolute URLs properly

## Solution Design

### Strategy Overview

Fix the image loading by ensuring:
1. Only server file paths (not blob URLs) are stored in attachment metadata
2. Base URL is environment-aware (relative in production, absolute in development)
3. Proper authentication headers are included for protected file access

### Solution Components

#### 1. Base URL Configuration

**Rationale**: The application needs to construct correct URLs for API calls and file access that work in both development and production environments.

**Approach**: Create a centralized configuration that provides the base URL based on the environment.

**Location**: Create new file `client/src/lib/config.ts`

**Configuration Logic**:
| Environment | API Base URL | File Base URL | Reason |
|-------------|--------------|---------------|--------|
| Development | `http://localhost:5001` | `http://localhost:5001` | Backend runs on separate port |
| Production | Empty string (same origin) | Empty string (same origin) | Nginx proxies all requests |

**Implementation Concept**:
- Detect environment using `import.meta.env.MODE` or similar
- Export constant for base URL
- Use throughout application for all API calls and file access

#### 2. AttachmentDisplay Component Updates

**Problem**: Component uses hardcoded localhost URL and doesn't handle relative paths correctly in production.

**Changes Required**:

**Import Configuration**:
- Add import for base URL configuration

**URL Construction Logic**:
Update the image loading logic (around line 36-46) to:

| Current URL Format | Detection | Action |
|-------------------|-----------|--------|
| Starts with `blob:` | Browser blob URL | Use directly (temporary preview) |
| Starts with `http://` or `https://` | Absolute URL | Use directly |
| Starts with `/uploads/` | Relative server path | Prepend base URL |
| Other | Invalid | Log error |

**Fetch Request Update**:
- Remove hardcoded `localhost:5001`
- Construct URL: `${baseUrl}${imageUrl}` where baseUrl is from config
- Keep authentication headers unchanged

**Error Handling**:
- Log URLs being fetched for debugging
- Provide clear error messages for failed loads
- Show placeholder image on failure

#### 3. Verify Upload Flow Integrity

**Ensure Correct Metadata Storage**:

The file upload flow must preserve server paths through the entire chain:

**Upload Endpoint** (POST /api/uploads):
- Already returns correct structure with `url` field containing server path
- Already generates thumbnails and returns `thumbnailUrl`
- No changes needed

**Message/Comment Creation**:
- When creating message/comment with attachments
- The `attachmentMetadata` should contain the upload response data
- Verify the `url` field contains server path (e.g., `/uploads/attachments/temp/file.jpg`)
- NOT blob URLs (e.g., `blob:https://...`)

**Verification Points**:
| Stage | Check | Expected Value |
|-------|-------|----------------|
| Upload complete | Response `url` field | `/uploads/attachments/temp/{filename}` |
| Before message send | Attachment data `url` | Same server path, not blob URL |
| Database storage | `attachment_metadata` JSON | Contains server paths |
| Message fetch | Attachment array `url` | Server paths preserved |

#### 4. AttachmentPreview Component Review

**Current Behavior**: Creates blob URLs for preview (line 129), which is correct.

**Verification Needed**: Ensure blob URLs are NOT passed to parent components or stored in message data.

**Expected Flow**:
1. File selected → Blob URL created for preview only
2. File uploaded → Server returns real path
3. UploadedFile returned to parent → Contains server path
4. Parent uses UploadedFile.url (server path) for message attachment
5. Blob URL revoked after preview (line 132)

**No Changes Required If**: The parent component (Messages.tsx, Reviews page, Comments section) uses `uploadedFile.url` from the upload response, not the original File object's blob URL.

#### 5. Messages Component Verification

**Check Message Sending** (client/src/pages/Messages.tsx):

The component should:
- Store uploadedFiles from AttachmentPreview's `onUploadComplete` callback
- When sending message, include `uploadedFiles.map(f => f.uploadId)` in API payload
- NOT include or reference the original File objects with blob URLs

**API Payload Structure**:
| Field | Type | Value Source | Should NOT Contain |
|-------|------|--------------|-------------------|
| content | string | Message text | N/A |
| conversationId | string | Conversation ID | N/A |
| attachments | string[] | `uploadedFiles.map(f => f.uploadId)` | Blob URLs |

#### 6. Download Functionality Update

**Current Issue**: Download handler (AttachmentDisplay.tsx, line 149) also uses attachment.url directly without base URL.

**Solution**: Apply same base URL logic:
- Construct full URL: `${baseUrl}${attachment.url}`
- Fetch with authentication
- Create temporary blob URL for download only
- Revoke blob URL after download

### Environment-Specific Behavior

#### Development Environment
- Base URL: `http://localhost:5001`
- Backend serves files via Express static middleware
- CORS enabled for cross-origin requests
- Blob URLs work for local preview

#### Production Environment
- Base URL: Empty string (same origin)
- All requests go to `https://reader.market`
- Nginx configuration handles routing
- Static files served through proxy to Node.js backend
- No CORS needed (same origin)

### Nginx Configuration Verification

**Current Nginx Setup** (reader.market.nginx):
- Serves static homepage via PHP
- Has basic proxy configuration for application

**Required Verification**:
Ensure Nginx properly proxies requests to the Node.js backend:

| Path Pattern | Should Route To | Purpose |
|--------------|-----------------|---------|
| `/api/*` | Node.js backend (port 5001) | API endpoints |
| `/uploads/*` | Node.js backend (port 5001) | Static file serving via Express |
| `/` | Static build or Node.js SSR | Frontend application |

**Note**: Based on current configuration, the application may need Nginx rules to proxy to the Node.js backend. The current config shows PHP handling, but the application is a Node.js/Express app.

## Implementation Checklist

### Phase 1: Configuration Setup
- [ ] Create `client/src/lib/config.ts` with environment-aware base URL
- [ ] Export API_BASE_URL constant
- [ ] Test in both development and production modes

### Phase 2: Component Updates
- [ ] Update AttachmentDisplay component to use config base URL
- [ ] Fix URL construction logic for image loading
- [ ] Update download handler to use base URL
- [ ] Add comprehensive logging for debugging
- [ ] Test image display in messages

### Phase 3: Flow Verification
- [ ] Verify fileUploadManager returns server paths in upload response
- [ ] Verify Messages component uses uploadedFile.url (not blob URLs)
- [ ] Verify comment submission uses correct attachment paths
- [ ] Verify review submission uses correct attachment paths
- [ ] Check database records for attachment_metadata format

### Phase 4: Production Deployment
- [ ] Verify Nginx configuration proxies /uploads/* to backend
- [ ] Verify Nginx configuration proxies /api/* to backend
- [ ] Ensure Node.js backend is serving static files correctly
- [ ] Test file uploads in production
- [ ] Test image display in production
- [ ] Test image download in production

### Phase 5: Testing
- [ ] Upload image in message (development)
- [ ] View uploaded image in message (development)
- [ ] Upload image in message (production)
- [ ] View uploaded image in message (production)
- [ ] Upload image in comment (production)
- [ ] Upload image in review (production)
- [ ] Test image download functionality
- [ ] Test across different browsers
- [ ] Test with authentication tokens

## Risk Assessment

### Low Risk Items
- Base URL configuration change (isolated, easy to test)
- AttachmentDisplay component updates (well-defined scope)

### Medium Risk Items
- Potential multiple places storing blob URLs instead of server paths
- May need to update review and comment components similarly

### High Risk Items
- Nginx configuration changes (could affect entire site)
- Any issues with existing stored data containing blob URLs

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: Revert AttachmentDisplay component to previous version
2. **Short-term**: Roll back base URL configuration
3. **If persistent**: Check PM2 logs for backend errors
4. **Data issue**: If database contains blob URLs, may need data migration

## Success Criteria

✅ Images uploaded through messages display correctly in production
✅ Images uploaded through comments display correctly in production  
✅ Images uploaded through reviews display correctly in production
✅ Blob URLs only used temporarily for preview, never stored
✅ Download functionality works in production
✅ No hardcoded localhost URLs in production code
✅ Proper authentication maintained for protected files
✅ Lightbox viewer works with production images

## Related Files

| File Path | Relevance | Changes Needed |
|-----------|-----------|----------------|
| `client/src/lib/config.ts` | New file | Create with base URL config |
| `client/src/components/AttachmentDisplay.tsx` | High | Update URL construction and fetch logic |
| `client/src/components/AttachmentPreview.tsx` | Review | Verify blob URLs not leaked to parent |
| `client/src/pages/Messages.tsx` | Review | Verify correct upload data usage |
| `client/src/lib/fileUploadManager.ts` | Review | Verify upload response handling |
| `server/routes.ts` | Review | Verify upload endpoint returns correct paths |
| `server/index.ts` | Review | Verify static file serving configuration |
| `reader.market.nginx` | High | May need proxy configuration updates |

## Additional Considerations

### Security
- Ensure authentication headers are preserved when fetching images
- Verify access control for protected attachments
- File access permissions should be checked by backend

### Performance
- Thumbnail generation reduces initial load size
- Blob URLs for preview avoid unnecessary server requests
- Consider caching strategy for frequently accessed images

### Browser Compatibility
- Blob URLs supported in all modern browsers
- Fetch API with authentication headers widely supported
- URL.createObjectURL/revokeObjectURL standard across browsers
| `reader.market.nginx` | High | May need proxy configuration updates |

## Additional Considerations

### Security
- Ensure authentication headers are preserved when fetching images
- Verify access control for protected attachments
- File access permissions should be checked by backend

### Performance
- Thumbnail generation reduces initial load size
- Blob URLs for preview avoid unnecessary server requests
- Consider caching strategy for frequently accessed images

### Browser Compatibility
- Blob URLs supported in all modern browsers
- Fetch API with authentication headers widely supported
- URL.createObjectURL/revokeObjectURL standard across browsers
| `server/index.ts` | Review | Verify static file serving configuration |
| `reader.market.nginx` | High | May need proxy configuration updates |

## Additional Considerations

### Security
- Ensure authentication headers are preserved when fetching images
- Verify access control for protected attachments
- File access permissions should be checked by backend

### Performance
- Thumbnail generation reduces initial load size
- Blob URLs for preview avoid unnecessary server requests
- Consider caching strategy for frequently accessed images

### Browser Compatibility
- Blob URLs supported in all modern browsers
- Fetch API with authentication headers widely supported
- URL.createObjectURL/revokeObjectURL standard across browsers
