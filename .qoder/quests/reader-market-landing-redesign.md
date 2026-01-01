# Reader.market Landing Page Redesign

## 1. Feature Overview

### 1.1 Purpose
The Reader.market landing page redesign aims to create a new main landing page that clearly explains the AI-powered reading service, focusing on helping users understand and remember their own books. The existing landing page will be preserved at https://reader.market/landing for continued access.

### 1.2 Goals
- Clearly communicate that users upload their own books (not a bookstore)
- Highlight AI-powered features (summaries, insights, recommendations)
- Drive signups/conversions to "Get started" action
- Maintain SEO effectiveness through SSR/static HTML
- Ensure accessibility without JavaScript

### 1.3 Success Criteria
- First-time visitors can answer: What is this? Is it for my own books? What does AI do here? Why should I sign up?
- Achieve clear value proposition within 10-15 seconds
- Maintain high conversion rate to signups

## 2. Page Structure and Content

### 2.1 Hero Block
**Headline**: "Read smarter with AI-powered insights from your books"

**Subheadline**: "Upload your own books and turn them into structured knowledge with summaries, key ideas, and personalized recommendations."

**CTAs**:
- Primary: "Get started — free"
- Secondary: "See how it works"

### 2.2 How It Works Block
**Three-step process**:
1. Upload your book - "Add your own books to your personal library (FB2 supported)"
2. Read with AI assistance - "Get summaries, key ideas, and explanations as you read"
3. Remember more & discover next reads - "Save insights and get recommendations based on what you actually read"

### 2.3 AI Capabilities Block
**Features list**:
- Get concise chapter summaries
- Extract key ideas and insights
- Understand complex books faster
- Receive personalized reading recommendations

### 2.4 Value Proposition Block
**Key points**:
- Built for understanding, not just reading pages
- Your personal library — not a bookstore
- Privacy-first, fast AI processing
- Ideal for non-fiction and deep reading

### 2.5 Target Audience Block
**Primary users**:
- Non-fiction readers
- Students and lifelong learners
- Professionals who read to grow
- People who want to remember what they read

### 2.6 Format Support Block
**Currently supported**: FB2
**Coming soon**: EPUB, PDF

### 2.7 Transparency Block
**Early-stage messaging**: "Reader.market is an early-stage product. We actively develop it and shape new features based on user feedback."

### 2.8 Final CTA Block
**Text**: "Start reading smarter. Turn books into knowledge with AI."
**CTA**: "Get started — free"

### 2.9 Early Adopter Version
Alternative version available at /early or with ?early=1 parameter:
- Hero: "An AI reading tool for people who care about understanding books"
- Subheadline: "Early-stage AI-powered reader. Upload your books, explore summaries and insights, and help shape the future of smart reading."
- CTA: "Join early access"

## 3. Technical Requirements

### 3.1 Rendering Strategy
- Static HTML or Server-Side Rendering (SSR) for optimal SEO
- Progressive enhancement with JavaScript hydration after initial render
- Page must be fully functional and readable without JavaScript enabled

### 3.2 SEO Requirements
- Proper meta tags (title, description, OpenGraph)
- Title: "Reader.market — AI-powered book reading and insights"
- Meta description: "AI-powered reading service to analyze your books with summaries, key ideas, and personalized recommendations"
- OpenGraph title and description tags
- Simple FAQ schema (2-3 questions) for structured data

### 3.3 Accessibility
- Semantic HTML structure
- Proper heading hierarchy (H1, H2, H3, etc.)
- Adequate color contrast ratios
- Keyboard navigation support
- Screen reader compatibility

### 3.4 Performance
- Fast initial load times
- Optimized asset delivery
- Minimal critical rendering path

## 4. Navigation and Routing

### 4.1 URL Structure
- New main landing: Root path "/" 
- Old landing preserved at: "/landing"
- Early adopter version: "/early" or with query parameter

### 4.2 Internal Navigation
- Links to sign up/login pages
- Links to product features
- Footer navigation with site map

## 5. Implementation Strategy

### 5.1 Approach
- Create new landing page component based on specification
- Preserve existing landing page at /landing route
- Implement SSR for new landing page
- Ensure all content is available without JavaScript

### 5.2 Dependencies
- Frontend framework components for layout
- SEO meta tag management system
- Routing configuration
- Static asset optimization

## 6. Non-Goals

### 6.1 Excluded Features
- Pricing information (unless already implemented)
- Promises of currently unsupported features
- Marketplace language or bookstore terminology
- E-commerce functionality
- Book purchasing options

### 6.2 Scope Limitations
- No complex animations for initial release
- No dynamic content personalization
- No user-specific recommendations on landing
- No pricing plans display

## 7. Risk Assessment

### 7.1 Technical Risks
- SSR implementation complexity
- SEO impact of routing changes
- Performance impact of static generation

### 7.2 Business Risks
- Potential confusion with two landing pages
- Conversion rate changes from new design
- Message clarity for target audience

## 8. Success Metrics

### 8.1 Key Performance Indicators
- Conversion rate to signups from landing page
- Time to first meaningful paint
- SEO ranking for target keywords
- Bounce rate from landing page
- User comprehension of value proposition (A/B testing)

### 8.2 Monitoring Requirements
- Landing page analytics tracking
- Conversion funnel analysis
- SEO performance monitoring
- Performance metrics monitoring