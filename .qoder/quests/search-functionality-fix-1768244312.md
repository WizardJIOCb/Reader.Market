# Search Functionality Fix - Cyrillic URL Decoding Issue

## Problem Statement

The search functionality fails when Cyrillic text is passed via URL query parameters. When a user navigates to a search URL with encoded Cyrillic characters (e.g., `/search?q=%D0%93%D0%B8%D0%BF%D0%B5%D1%80%D0%B8%D0%BE%D0%BD` for "Гиперион"), the following issues occur:

1. **URL Navigation Search**: The search query from URL parameter is not properly decoded and passed to the backend, resulting in all books being displayed instead of search results
2. **Manual Search Field**: When manually typing Cyrillic text (e.g., "Гиперион") in the search field, the search returns empty results even though matching books exist in the database

The book "Гиперион" by "Дэн Симмонс" exists in the database but cannot be found through either search method.

## Root Cause Analysis

### Issue 1: Double Encoding in API Call

**Location**: `client/src/lib/api.ts` line 45-49

The `searchBooks` function performs unnecessary encoding of the query parameter:

```
searchBooks: (query: string, sortBy?: string, sortDirection?: 'asc' | 'desc') => {
  const params = new URLSearchParams({ query: encodeURIComponent(query) });
  ...
}
```

**Problem**: The query is already a plain string that may have been decoded from the URL. By calling `encodeURIComponent(query)` and then passing it to `URLSearchParams`, the query gets **double-encoded**. `URLSearchParams` automatically encodes values, so manual encoding causes:
- "Гиперион" → encodeURIComponent → "%D0%93%D0%B8%D0%BF%D0%B5%D1%80%D0%B8%D0%BE%D0%BD" → URLSearchParams encoding → "%25D0%2593%25D0%25B8..." (percent signs get encoded again)

### Issue 2: Initial URL Query Processing Flow

**Location**: `client/src/pages/Search.tsx` lines 66-74

The component has a race condition in initialization:

1. First `useEffect` (lines 66-74): Reads URL parameter and calls `performSearch(decodedQuery)`
2. Second `useEffect` (lines 77-99): Immediately calls `fetchAllBooks()` which overwrites the books state with all books

**Flow**: 
- URL has query → decode → call `performSearch` → start loading search results
- Simultaneously → `fetchAllBooks` executes → loads all books → overwrites search results
- Result: User sees all books instead of search results

### Issue 3: Backend Query Parameter Name Mismatch

**Location**: Various inconsistencies across the codebase

The backend endpoint expects parameter name `query`:
- `server/routes.ts` line 1577: `const query = req.query.query ? String(req.query.query) : '';`

But some client code uses different parameter names:
- `client/src/pages/Shelves.tsx` line 91: Uses `?query=` parameter name ✓ (correct)
- `client/src/components/GroupCreationDialog.tsx` line 60: Uses `?q=` parameter name ✗ (incorrect)
- `client/src/components/GroupSettingsPanel.tsx` line 194: Uses `?q=` parameter name ✗ (incorrect)
- `client/src/lib/api.ts` line 46: Uses `query` as key in URLSearchParams ✓ (correct)
- URL routing uses `?q=` convention while API expects `?query=`

## Solution Design

### 1. Fix Double Encoding in API Client

**Target**: `client/src/lib/api.ts` - `booksApi.searchBooks` function

**Change Strategy**: Remove manual `encodeURIComponent` call since `URLSearchParams` handles encoding automatically.

**Before**:
```
const params = new URLSearchParams({ query: encodeURIComponent(query) });
```

**After**:
```
const params = new URLSearchParams({ query: query });
```

**Rationale**: `URLSearchParams` constructor automatically encodes parameter values according to URL encoding standards. Manual pre-encoding causes double encoding which corrupts Cyrillic characters.

### 2. Fix Initialization Race Condition

**Target**: `client/src/pages/Search.tsx` - Component initialization logic

**Change Strategy**: Consolidate initialization logic and add conditional execution to prevent state overwrites.

**Modify Second useEffect** (lines 77-99):
- Add dependency on `searchQuery` state
- Add condition to skip `fetchAllBooks()` if `searchQuery` is not empty (i.e., loaded from URL)
- This ensures that when URL has a query parameter, we don't immediately overwrite search results with all books

**Flow After Fix**:
1. Component mounts
2. First useEffect reads URL query → sets `searchQuery` state → calls `performSearch`
3. Second useEffect sees `searchQuery` is not empty → skips `fetchAllBooks()`
4. Search results display correctly

### 3. Standardize Query Parameter Naming

**Target**: Multiple files with inconsistent parameter naming

**Change Strategy**: Align all client-side code to use `query` parameter name consistently with backend expectations.

**Files to Update**:
- `client/src/components/GroupCreationDialog.tsx` line 60: Change `?q=` to `?query=`
- `client/src/components/GroupSettingsPanel.tsx` line 194: Change `?q=` to `?query=`

**Note**: The URL routing convention (`/search?q=...`) is for user-facing URLs and is handled separately in Search.tsx which correctly reads `q` from URL and passes it as `query` to the API. The internal API calls should use `query` consistently.

### 4. Add URL Query Synchronization

**Target**: `client/src/pages/Search.tsx` - `handleSearch` function

**Enhancement**: Ensure the URL parameter (`q`) is properly synchronized when manual searches are performed.

**Current Behavior**: Already correct (lines 194-205) - updates URL with `?q=` parameter

**Verification Needed**: Confirm that `SearchBar` component properly receives and updates `searchQuery` prop from parent.

## Implementation Sequence

1. **Fix API Client Encoding** (Highest Priority)
   - Modify `client/src/lib/api.ts`
   - Remove double encoding from `searchBooks` function
   - Test with Cyrillic characters

2. **Fix Initialization Race Condition** (High Priority)
   - Modify `client/src/pages/Search.tsx`
   - Update second useEffect to check if query exists before loading all books
   - Test URL navigation with query parameter

3. **Standardize Parameter Names** (Medium Priority)
   - Update `GroupCreationDialog.tsx` and `GroupSettingsPanel.tsx`
   - Change `?q=` to `?query=` in direct API calls
   - Test group book search functionality

4. **Integration Testing** (Required)
   - Test URL navigation: `/search?q=Гиперион`
   - Test manual search input: Type "Гиперион" and submit
   - Test Latin text searches to ensure no regression
   - Test mixed Cyrillic and Latin searches
   - Test special characters in search

## Expected Behavior After Fix

### URL Navigation Search
1. User navigates to: `http://localhost:3001/search?q=%D0%93%D0%B8%D0%BF%D0%B5%D1%80%D0%B8%D0%BE%D0%BD`
2. Frontend decodes URL parameter: "Гиперион"
3. Frontend calls API: `/api/books/search?query=%D0%93%D0%B8%D0%BF%D0%B5%D1%80%D0%B8%D0%BE%D0%BD` (single encoding by URLSearchParams)
4. Backend receives: "Гиперион" (Express automatically decodes)
5. Database search executes with Cyrillic text
6. Results returned: Book "Гиперион" by "Дэн Симмонс" displayed

### Manual Search Field
1. User types: "Гиперион" in search field
2. User submits search
3. Frontend calls API with properly encoded Cyrillic
4. Backend searches database
5. Results returned: Book "Гиперион" found and displayed

### All Books Display
1. User navigates to `/search` without query parameter
2. Page loads and displays all books (current behavior maintained)
3. User can browse or use filters

## Risk Assessment

**Risk Level**: Low

**Potential Issues**:
- **Backward Compatibility**: Changes to URL encoding should not affect existing functionality since we're fixing broken behavior
- **Other Search Locations**: Group creation and settings dialogs may need separate testing after parameter name changes
- **Browser Compatibility**: URL encoding/decoding is standard across browsers

**Mitigation**:
- Test thoroughly with multiple character sets (Cyrillic, Latin, Chinese, etc.)
- Verify all search entry points after changes
- Monitor console for any new encoding-related errors

## Testing Checklist

- [ ] URL navigation with Cyrillic query finds correct books
- [ ] Manual search field with Cyrillic text returns results
- [ ] Latin text searches work correctly (regression test)
- [ ] Mixed Cyrillic and Latin searches work
- [ ] Empty search displays all books
- [ ] Special characters (quotes, brackets, etc.) are handled
- [ ] Search from group creation dialog works
- [ ] Search from group settings panel works
- [ ] Search from shelves page works
- [ ] URL updates correctly when searching manually
- [ ] Browser back/forward navigation preserves search state

## Technical Notes

### Character Encoding Flow
- **Browser URL**: Percent-encoded UTF-8 (`%D0%93...`)
- **JavaScript String**: Unicode characters ("Гиперион")
- **URLSearchParams**: Automatically encodes to percent-encoded UTF-8
- **HTTP Request**: Sends percent-encoded UTF-8
- **Express Backend**: Automatically decodes to Unicode string
- **PostgreSQL**: Stores and searches UTF-8 text (with ILIKE for case-insensitive)

### Database Collation
The backend already uses `ILIKE` with `LOWER()` functions for case-insensitive search across Cyrillic characters. This is correct and requires no changes. The collation settings in PostgreSQL support UTF-8 and Cyrillic properly.
