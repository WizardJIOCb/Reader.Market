# Design: Allow Unregistered Users to View News and Book Pages

## Overview

Enable unregistered (non-authenticated) users to access news detail pages and book detail pages with read-only access. Users will be able to view content, comments, reviews, and reactions, but any attempt to interact (post comments, reviews, or reactions) will prompt them to register or log in.

## Current State Analysis

### News Detail Page
- **URL Pattern**: `/news/:id`
- **Backend Route**: `GET /api/news/:id` - Currently protected by `authenticateToken` middleware
- **Related Endpoints**:
  - `GET /api/news/:id/comments` - Protected (requires auth)
  - `GET /api/news/:id/reactions` - Protected (requires auth)
  - `POST /api/news/:id/comments` - Protected (requires auth for posting)
  - `POST /api/news/:id/reactions` - Protected (requires auth for posting)

**Current Behavior**: Unauthenticated users cannot access the news detail page at all. The API returns 401 Unauthorized.

### Book Detail Page
- **URL Pattern**: `/book/:bookId`
- **Backend Route**: `GET /api/books/:id` - Currently protected by `authenticateToken` middleware
- **Related Endpoints**:
  - `GET /api/books/:id/comments` - Protected (requires auth)
  - `GET /api/books/:id/reviews` - Protected (requires auth)
  - `GET /api/books/:id/reactions` - Not protected (already accessible)
  - `POST /api/books/:id/comments` - Protected (requires auth for posting)
  - `POST /api/books/:id/reviews` - Protected (requires auth for posting)
  - `POST /api/books/:id/reactions` - Protected (requires auth for posting)
  - `POST /api/books/:id/track-view` - Protected (requires auth for tracking)

**Current Behavior**: Unauthenticated users cannot access the book detail page at all. The API returns 401 Unauthorized.

## Strategic Goals

1. **Public Content Accessibility**: Make news articles and book details publicly accessible to improve content discoverability and SEO
2. **User Acquisition**: Use the registration prompt as a conversion funnel to encourage user registration
3. **Data Integrity**: Ensure view counts and statistics remain accurate when allowing unauthenticated access
4. **Security**: Maintain protection on all write operations (comments, reviews, reactions)

## Design Solution

### Backend API Changes

#### Authentication Middleware Strategy

Create an optional authentication middleware that allows requests to proceed whether authenticated or not, but attaches user information when available.

**New Middleware**: `optionalAuthenticateToken`
- Extract token from Authorization header if present
- If valid token exists: attach user data to request object
- If no token or invalid token: set user to null/undefined and continue
- Never returns 401 or 403 error responses

#### Modified Endpoints

##### News Endpoints

| Endpoint | Current Auth | New Auth | Behavior Change |
|----------|-------------|----------|-----------------|
| `GET /api/news/:id` | Required | Optional | Return news data to all users. Track views even for unauthenticated users. |
| `GET /api/news/:id/comments` | Required | Optional | Return comments to all users. Do not include `userReacted` flag in reactions if user is unauthenticated. |
| `GET /api/news/:id/reactions` | Required | Optional | Return aggregated reactions to all users. Set `userReacted: false` for all reactions if user is unauthenticated. |
| `POST /api/news/:id/comments` | Required | Required | No change. Posting requires authentication. |
| `POST /api/news/:id/reactions` | Required | Required | No change. Posting requires authentication. |

##### Book Endpoints

| Endpoint | Current Auth | New Auth | Behavior Change |
|----------|-------------|----------|-----------------|
| `GET /api/books/:id` | Required | Optional | Return book data to all users. Include reactions with `userReacted: false` for unauthenticated users. |
| `GET /api/books/:id/comments` | Required | Optional | Return comments to all users. Set `userReacted: false` in all reactions if user is unauthenticated. |
| `GET /api/books/:id/reviews` | Required | Optional | Return reviews to all users. Set `userReacted: false` in all reactions if user is unauthenticated. |
| `POST /api/books/:id/track-view` | Required | Optional | Allow view tracking for unauthenticated users but skip user action logging. |
| `POST /api/books/:id/comments` | Required | Required | No change. Posting requires authentication. |
| `POST /api/books/:id/reviews` | Required | Required | No change. Posting requires authentication. |
| `POST /api/books/:id/reactions` | Required | Required | No change. Posting requires authentication. |

#### View Count Tracking Logic

**News View Count**:
- Increment view count regardless of authentication status
- Accept views from all users (authenticated and unauthenticated)

**Book View Count**:
- Accept `card_view` tracking from all users
- Skip user action logging (`logUserAction`) when user is unauthenticated
- Continue to track the view count in the book statistics table

### Frontend Changes

#### News Detail Page Component

**Location**: `client/src/pages/NewsDetailPage.tsx`

**Conditional Rendering Strategy**:

| UI Element | Authenticated User | Unauthenticated User |
|------------|-------------------|---------------------|
| News title and content | Display normally | Display normally |
| Author information | Display normally | Display normally |
| View count, comment count | Display normally | Display normally |
| Reaction display | Show with interaction | Show as read-only (no interaction) |
| Comment list | Display normally | Display normally |
| Comment form | Show textarea and submit button | Replace with registration prompt |
| Add reaction button | Interactive | Replace with registration prompt |

**Registration Prompt Component for Comment Section**:
- **Location**: Where comment form would normally appear
- **Visual Design**: Card or banner matching the comment form styling
- **Message**: Bilingual support (English/Russian)
  - English: "Join the discussion! Register or log in to leave comments and reactions."
  - Russian: "Присоединяйтесь к обсуждению! Зарегистрируйтесь или войдите, чтобы оставлять комментарии и реакции."
- **Primary Action**: "Register" button (prominent, primary color)
- **Secondary Action**: "Log In" link or button (subtle, secondary styling)
- **Icons**: Consider using person/user icon to indicate account-related action
- **Layout**: Horizontal layout on desktop, stacked on mobile

#### Book Detail Page Component

**Location**: `client/src/pages/BookDetail.tsx`

**Conditional Rendering Strategy**:

| UI Element | Authenticated User | Unauthenticated User |
|------------|-------------------|---------------------|
| Book title, author, description | Display normally | Display normally |
| Book cover image | Display normally | Display normally |
| Book statistics (views, comments, reviews) | Display normally | Display normally |
| Reaction display | Show with interaction | Show as read-only (no interaction) |
| "Add to Shelf" button | Interactive | Replace with registration prompt |
| "Start Reading" button | Interactive | Replace with registration prompt |
| "Download" button | Interactive | Replace with registration prompt |
| Comments tab | Display list | Display list |
| Comment form | Show textarea and submit button | Replace with registration prompt |
| Reviews tab | Display list | Display list |
| Review form | Show rating and textarea | Replace with registration prompt |

**Registration Prompt Components** (Multiple Contexts):

1. **Action Buttons Section** (Add to Shelf, Start Reading, Download):
   - **Approach**: Show disabled buttons with tooltip or replace with prompt banner
   - **Message**: Bilingual
     - English: "Register to read books and manage your library"
     - Russian: "Зарегистрируйтесь, чтобы читать книги и управлять библиотекой"
   - **Style**: Inline prompt or tooltip on hover
   - **Actions**: "Register" and "Log In" buttons

2. **Comment Form Section**:
   - **Location**: Comments tab, where comment textarea would appear
   - **Message**: Bilingual
     - English: "Want to join the conversation? Register or log in to comment."
     - Russian: "Хотите присоединиться к обсуждению? Зарегистрируйтесь или войдите."
   - **Style**: Card matching comment form design
   - **Actions**: "Register" (primary) and "Log In" (secondary)

3. **Review Form Section**:
   - **Location**: Reviews tab, where review form would appear
   - **Message**: Bilingual
     - English: "Share your thoughts! Register or log in to write a review."
     - Russian: "Поделитесь своим мнением! Зарегистрируйтесь или войдите, чтобы написать рецензию."
   - **Style**: Card matching review form design
   - **Actions**: "Register" (primary) and "Log In" (secondary)

**Reusable Registration Prompt Component**:
- Component name: `AuthPrompt` or `RegistrationPrompt`
- Props:
  - `message`: Custom message text (supports i18n keys)
  - `variant`: "inline" | "card" | "banner"
  - `primaryAction`: "register" (default) | "login"
  - `size`: "small" | "medium" | "large"
- Automatically detects current language from i18n context
- Handles navigation to `/register` or `/login` pages
- Optionally stores return URL for post-authentication redirect

#### Authentication State Handling

**API Call Error Handling**:
- Frontend components should not redirect to login on 401 errors for GET requests to these pages
- Only show registration prompts in place of interactive elements
- Maintain current redirect behavior for authenticated-only pages (profile, messages, admin, etc.)
- For POST requests that return 401 (comment/review attempts), show inline error message with authentication prompt

**React Auth Context**:
- `useAuth()` hook will return `user: null` for unauthenticated sessions
- Components will check `if (user)` to conditionally render interactive vs. registration prompt
- `isLoading` state should be checked before showing prompts to avoid flash of registration prompt during auth check

**Conditional Rendering Pattern**:
```
if (isLoading) {
  // Show loading skeleton
} else if (user) {
  // Show interactive elements (forms, buttons)
} else {
  // Show registration prompt
}
```

### Data Model Considerations

#### User Identification for Views

**Current State**: View tracking assumes authenticated user

**Updated Behavior**:
- News views: Increment counter without associating to specific user
- Book views: Accept anonymous view tracking
- User action logging: Skip when `userId` is null/undefined

No database schema changes required. The view count fields already exist and are independent of user identity.

### API Response Schema Changes

#### Reactions Array Format

**For Authenticated Users**:
```
{
  "emoji": "👍",
  "count": 5,
  "userReacted": true
}
```

**For Unauthenticated Users**:
```
{
  "emoji": "👍",
  "count": 5,
  "userReacted": false
}
```

All reaction arrays must include the `userReacted` field. When user is unauthenticated, always set to `false`.

### Error Handling and Edge Cases

| Scenario | Backend Behavior | Frontend Behavior |
|----------|------------------|-------------------|
| Unauthenticated user views news | Return news data with HTTP 200 | Display content normally |
| Unauthenticated user views book | Return book data with HTTP 200 | Display content normally |
| Unauthenticated user tries to comment | Return HTTP 401 | Show registration prompt instead of form |
| Unauthenticated user tries to react | Return HTTP 401 | Show registration prompt on click |
| Unauthenticated user clicks "Add to Shelf" | No API call made | Show registration prompt modal |
| News/book not found | Return HTTP 404 | Show "not found" message |
| News is unpublished | Return HTTP 404 | Show "not found" message |

### Security Considerations

**What Remains Protected**:
- All POST, PUT, DELETE operations require authentication
- User profile data
- Admin operations
- Message sending
- Shelf management
- Reading progress tracking

**What Becomes Public**:
- News article content and metadata
- Book details and metadata
- Comments and reviews (read-only)
- Aggregated reaction counts (read-only)

**Rate Limiting Considerations**:
- Public endpoints may need rate limiting to prevent abuse
- Consider implementing IP-based rate limiting for unauthenticated requests
- Not required for initial implementation but should be considered for future enhancement

### SEO and Analytics Impact

**Benefits**:
- News pages become indexable by search engines
- Book detail pages become indexable by search engines
- View counts will more accurately reflect public interest
- Potential for social media sharing increases

**Analytics Tracking**:
- Distinguish between authenticated and unauthenticated page views in analytics
- Track conversion rate from unauthenticated view to registration

### User Experience Flow

#### Unauthenticated User Journey

**Step 1: Discovery**
- User finds link to news article or book page (search engine, social media, direct link)
- Clicks link and lands on page

**Step 2: Content Viewing**
- Page loads without requiring login
- User can read full news article or view complete book details
- User can browse existing comments and reviews
- **Visual indicators**: User sees registration prompts in place of interactive elements (subtle, non-intrusive)

**Step 3: Engagement Attempt**
- User scrolls to comment/review section
- Sees registration prompt instead of form
- **OR** User tries to click action button (Add to Shelf, Start Reading)
- Sees disabled state or registration prompt

**Step 4: Authentication Decision**
- User clicks "Register" button → redirected to `/register` with return URL
- **OR** User clicks "Log In" link → redirected to `/login` with return URL
- Return URL stored in query parameter or session storage

**Step 5: Conversion**
- After successful registration or login
- User automatically redirected back to the content page (news or book)
- Interactive elements now fully functional
- User can immediately perform intended action (comment, review, add to shelf)

#### Post-Authentication Return Flow

**URL Preservation**:
- Registration page: `/register?returnTo=/news/:id` or `/register?returnTo=/book/:bookId`
- Login page: `/login?returnTo=/news/:id` or `/login?returnTo=/book/:bookId`

**Implementation**:
- Store return URL in query parameter when navigating to auth pages
- After successful authentication, check for `returnTo` parameter
- Redirect to stored URL if present, otherwise redirect to default (home/library)

**Alternative Storage**:
- Use `sessionStorage` to store intended action (e.g., "comment on news:123")
- After authentication, check for stored intent and guide user back

### Implementation Priority

**Phase 1: Core Functionality**
1. Create `optionalAuthenticateToken` middleware
2. Update news endpoints (GET only)
3. Update book endpoints (GET only)
4. Update frontend News Detail page with conditional rendering
5. Update frontend Book Detail page with conditional rendering

**Phase 2: Polish**
1. Create reusable RegistrationPrompt component
2. Add proper styling for registration prompts
3. Implement "return to this page after registration" flow

**Phase 3: Future Enhancements**
1. Add rate limiting for public endpoints
2. Implement analytics tracking for conversion rates
3. A/B test different registration prompt messages and designs

### Success Metrics

**Quantitative Metrics**:
- Increase in page views for news and book pages
- Conversion rate from unauthenticated view to registration
- Percentage of users who register after viewing content
- SEO ranking improvements for news and book pages

**Qualitative Metrics**:
- User feedback on accessibility
- Reduction in bounce rate for these pages
- Increase in social media shares

### Testing Requirements

**Backend Testing**:
- Verify optional auth middleware allows unauthenticated requests
- Verify POST endpoints still require authentication and return appropriate 401 errors
- Verify `userReacted` flag is correctly set based on authentication state
- Verify view counts increment for both authenticated and unauthenticated users

**Frontend Testing**:
- Verify pages load for unauthenticated users without redirect to login
- Verify registration prompts appear in correct locations (comment forms, review forms, action buttons)
- Verify registration prompt text displays in correct language (English/Russian)
- Verify interactive elements are hidden for unauthenticated users
- Verify authenticated users still see interactive elements
- Test "Register" and "Log In" button navigation
- Test redirect flow after registration with return URL
- Test redirect flow after login with return URL
- Verify no flash of registration prompt during auth check (loading state)

**Integration Testing**:
- Complete user journey: unauthenticated view → register → return to page → interact
- Complete user journey: unauthenticated view → login → return to page → interact
- Verify return URL works for both news and book pages
- Verify no data leakage or security vulnerabilities
- Test error handling for edge cases (invalid return URLs, expired sessions)

**Visual Regression Testing**:
- Compare authenticated vs unauthenticated page layouts
- Verify registration prompts match design system styling
- Test responsive behavior on mobile, tablet, desktop
- Verify bilingual text displays correctly without layout breaks

## Summary

This design enables a public-facing reading platform where content discovery is friction-free, while maintaining security and data integrity for all interactive features. The registration prompt strategy converts passive viewers into active community members by demonstrating the value of the content before requiring account creation.
