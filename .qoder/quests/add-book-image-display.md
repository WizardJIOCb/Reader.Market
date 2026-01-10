# Fix Book Cover Image Display After Upload

## Problem Statement

After uploading a new book via the `/add-book` page, the book cover image does not display in book lists (Library, Shelves, Search results). The issue occurs on both:
- Local development environment (Windows)
- Production server (Linux Ubuntu)

## Root Cause Analysis (CONFIRMED)

**Database verification confirmed:** The `cover_image_url` field is **NOT being populated** for newly uploaded books.

| Finding | Details |
|---------|--------|
| Existing books | Have correct values: `uploads/coverImage-xxx.jpg` |
| New books | Field is **empty/null** |
| Cover image files | ARE being uploaded to `uploads/` directory |
| Root cause | Backend fails to capture/store the coverImage file path |

### Issue Location

The problem is in the backend book upload endpoint (`server/routes.ts`, lines 1157-1162).

**Current Code Logic:**
1. Multer processes upload with `upload.fields([{ name: 'bookFile' }, { name: 'coverImage' }])`
2. Condition checks: `if (req.files && (req.files as any).coverImage)`
3. If condition passes, extracts path and stores in `bookData.coverImageUrl`

**Possible Failure Points:**

| Point | Potential Issue |
|-------|----------------|
| Frontend FormData | coverImage field might not be appended correctly |
| Vite Proxy | Multipart form data might be corrupted during proxy |
| Multer middleware | Might not capture the coverImage field |
| Condition check | `req.files.coverImage` might be undefined |

### Code Flow Analysis

**Frontend** (`client/src/pages/AddBook.tsx`):
- User selects cover image
- State stored in `coverImage` variable
- On submit: `requestData.append('coverImage', coverImage)`

**API Call** (`client/src/lib/api.ts`):
- Uses `fetch()` with FormData body
- Content-Type header correctly omitted for FormData

**Backend** (`server/routes.ts`):
- Multer middleware: `upload.fields([{ name: 'bookFile' }, { name: 'coverImage' }])`
- Condition: `if (req.files && (req.files as any).coverImage)`
- Path extraction: `coverImage.path.replace(/^.*[\\\/](uploads[\\\/].*)$/, '$1')`

## Solution Design

### Fix: Backend Upload Endpoint

**File:** `server/routes.ts` (around line 1124-1190)

**Changes Required:**

1. Add debug logging to identify where the cover image is lost
2. Fix the condition check to properly detect uploaded cover image
3. Add fallback path construction using filename if regex fails
4. Normalize path separators to forward slashes

### Implementation Details

| Step | Action |
|------|--------|
| 1 | Log `req.files` to see what multer receives |
| 2 | Log whether `coverImage` field exists in `req.files` |
| 3 | If coverImage exists, log the file object details |
| 4 | Construct path using `'uploads/' + coverImage.filename` as fallback |
| 5 | Ensure all backslashes are replaced with forward slashes |

### Path Construction Logic

| Scenario | Current | New |
|----------|---------|-----|
| Regex matches | Use captured group | Use captured group |
| Regex fails | Store original (broken) | Use fallback: `'uploads/' + filename` |
| Backslashes present | Stored as-is | Replace with forward slashes |

### Expected Stored Value Format

- Format: `uploads/coverImage-{timestamp}-{random}.{ext}`
- Example: `uploads/coverImage-1766325531510-519921131.png`
- No leading slash
- Always forward slashes
