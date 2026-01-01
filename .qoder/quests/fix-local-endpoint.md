# Design Document: Fix Localhost Endpoint References for Production

## 1. Problem Statement

The application currently contains hardcoded localhost references (`http://localhost:5001`) in multiple client-side components that need to be updated to work correctly in production. Specifically, when running on the production server, API calls to add books are still using `http://localhost:5001/api/books/upload` instead of the actual domain `https://reader.market`.

## 2. Current State Analysis

Multiple files contain hardcoded localhost references:

1. **AddBook.tsx** - Line 110: `fetch('http://localhost:5001/api/books/upload', ...)`
2. **Reader.tsx** - Line 94: `fetch(`http://localhost:5001/api/books/${bookId}`, ...)`
3. **Various test HTML files** - Multiple localhost references
4. **API utility files** - Some use relative paths but others have hardcoded URLs

The application has a proper API utility (`client/src/lib/api.ts`) that uses relative paths, but it's not being used consistently across all components.

## 3. Solution Strategy

### 3.1 Centralized API Configuration
- Maintain a single source of truth for API endpoints using relative paths
- Leverage the existing `client/src/lib/api.ts` file which already has the correct approach
- Ensure all components use the centralized API functions instead of direct fetch calls

### 3.2 Environment-Aware Configuration
- Use relative paths for all API calls to automatically adapt to the current domain
- Leverage the existing proxy configuration in the nginx setup and Vite configuration
- Ensure both development and production environments work seamlessly

## 4. Implementation Approach

### 4.1 Replace Hardcoded Endpoints
- Replace all hardcoded `http://localhost:5001` references with relative paths
- Update components to use the existing `booksApi` utility functions
- Ensure file upload functionality uses the correct API endpoints

### 4.2 File Upload Path Construction
- Update URL construction for uploaded books to use relative paths or server-configured base URLs
- Modify how book URLs are constructed in Reader components to work with the production domain

## 5. Affected Components

### 5.1 AddBook.tsx
- Replace hardcoded fetch call to `/api/books/upload` with `booksApi.uploadBook()` function

### 5.2 Reader.tsx
- Replace hardcoded fetch call to `/api/books/{id}` with `booksApi.getBookById()` function

### 5.3 Other Components
- Review and update any other components that may have hardcoded localhost references

## 6. Configuration Requirements

### 6.1 API Base URL Handling
- Set `API_BASE_URL` to empty string (relative paths) in production
- Maintain current Vite proxy configuration for development
- Ensure nginx proxy configuration correctly forwards API requests

### 6.2 Upload File Access
- Ensure uploaded files are accessible through the proxy configuration
- Update how uploaded file URLs are constructed to work with the production domain

## 7. Testing Strategy

### 7.1 Pre-Implementation Verification
- Document current behavior in both development and production environments
- Identify all hardcoded localhost references

### 7.2 Post-Implementation Verification
- Test API functionality in development environment with proxy
- Test API functionality in production environment with domain
- Verify file upload and access functionality works in both environments
- Ensure all book reading functionality continues to work correctly

## 8. Risk Mitigation

### 8.1 Backward Compatibility
- Maintain the same API endpoints, only changing how they're accessed from the client
- Ensure no breaking changes to backend API contracts

### 8.2 Environment-Specific Behavior
- Use relative paths to ensure consistent behavior across environments
- Maintain development proxy configuration for local development workflow

## 9. Success Criteria

- All API calls use relative paths instead of hardcoded localhost URLs
- File upload functionality works in both development and production environments
- Book reading functionality continues to work with uploaded files
- Application functions correctly when accessed via `https://reader.market`
- No hardcoded domain references remain in client-side code