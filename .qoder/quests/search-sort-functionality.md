# Search Sort Functionality Design Document

## Problem Statement

The search functionality at http://localhost:3001/search?q=... has a broken sort mechanism where:
1. The sort direction toggle button (ascending/descending) doesn't trigger a re-sort of the search results
2. The search results list doesn't update when sort direction changes
3. The backend API endpoint doesn't accept sort direction parameters

## Current Architecture Analysis

### Frontend Components
- `SearchPage` component handles search functionality
- `BookListSortSelector` component provides sort option selection and direction toggle
- Client-side sorting occurs through `useMemo` hook in Search.tsx

### Backend Components
- `/api/books/search` endpoint handles search queries
- `searchBooks` function in storage.ts performs the actual search
- `sortBooksByOption` helper function handles sorting logic

### Root Cause Analysis

#### Issue 1: Missing Dependency in useMemo Hook
In `Search.tsx`, the `filteredBooks` useMemo hook has an incomplete dependency array:
```javascript
}, [books, selectedGenres, selectedStyles, yearRange, sortBy]); // Missing sortDir
```
The `sortDir` dependency is missing, causing the sort not to recompute when direction changes.

#### Issue 2: Backend API Doesn't Support Sort Direction
The `/api/books/search` endpoint accepts only `sortBy` but not `sortDirection`, limiting sorting to default behavior.

## Solution Design

### Frontend Changes

#### 1. Fix useMemo Dependency Array
**Component**: `Search.tsx`
**Location**: Line ~185 in the `filteredBooks` useMemo hook
**Change**: Add `sortDir` to the dependency array
```javascript
}, [books, selectedGenres, selectedStyles, yearRange, sortBy, sortDir]);
```

#### 2. Enhance API Call with Sort Direction Parameter
**Component**: `Search.tsx`
**Location**: Lines ~135 in the `performSearch` function
**Change**: Include sort direction in backend API calls
```javascript
const response = await fetch(`/api/books/search?query=${encodeURIComponent(query)}&sortBy=${sortBy}&sortDirection=${sortDir}`, {
```

### Backend Changes

#### 1. Update API Endpoint to Accept Sort Direction
**Component**: `server/routes.ts`
**Location**: Lines ~1023-1047 in the `/api/books/search` endpoint
**Change**: Extract sort direction from query parameters and pass to search function
```javascript
const query = req.query.query ? String(req.query.query) : '';
const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
const sortDirection = req.query.sortDirection === 'asc' ? 'asc' : 'desc'; // Default to 'desc'
let books = await storage.searchBooks(query, sortBy, sortDirection);
```

#### 2. Update Storage Interface and Implementation
**Component**: `server/storage.ts`
**Location**: Interface definition and implementation of `searchBooks`
**Change**: Add sortDirection parameter to the function signature and pass it to the sort helper
```typescript
async searchBooks(query: string, sortBy?: string, sortDirection: 'asc' | 'desc' = 'desc'): Promise<any[]>
```

#### 3. Modify sortBooksByOption to Accept Sort Direction
**Component**: `server/storage.ts`
**Location**: Lines ~37-112 in the `sortBooksByOption` function
**Change**: Ensure the function properly handles the sort direction parameter

## Implementation Strategy

### Phase 1: Frontend Fix
1. Update the useMemo dependency array in Search.tsx
2. Test that sort direction changes now trigger re-computation

### Phase 2: Full Stack Integration
1. Update backend API to accept sortDirection parameter
2. Update storage layer to handle sort direction
3. Update frontend to send sortDirection parameter
4. Test end-to-end functionality

## Expected Outcomes

After implementing these changes:
1. Clicking the sort direction toggle button will immediately update the search results
2. Both client-side and server-side sorting will respect the selected sort direction
3. Search results will refresh properly when sort parameters change
4. The URL will reflect sort parameters for better UX

## Risk Assessment

### Low Risk Items
- Adding dependency to useMemo hook - minimal impact, follows React best practices
- Adding query parameters to API call - standard enhancement

### Medium Risk Items
- Backend API changes - requires careful testing to ensure backward compatibility
- Storage layer modifications - could affect other parts of the system

## Testing Approach

### Unit Tests
- Verify useMemo hook recomputes when sort direction changes
- Test API endpoint handles sortDirection parameter correctly

### Integration Tests
- End-to-end test of search functionality with various sort combinations
- Verify URL parameter passing works correctly

### User Acceptance Tests
- Manual testing of sort direction toggle functionality
- Verify search results update correctly after sort changes- Manual testing of sort direction toggle functionality
- Verify search results update correctly after sort changes