# Design Document: Change Site Logo in Header

## Objective
Replace the current site logo/icon in the top-left corner of the navigation bar with a new image file named `favicon.png` located in the public directory. The logo appears in the header of the website as the main brand identifier.

## Current State
- The application currently displays a `BookOpen` icon from lucide-react followed by the text "Reader.Market" in the top-left corner of the navbar
- The navbar component is located in `client/src/components/Navbar.tsx`
- Multiple favicon-related files exist in `client/public/` directory:
  - `favicon reader market.png` (195.4KB)
  - `favicon-old (2).png` (275.9KB)
  - `favicon-old-2.png` (199.5KB)
  - `favicon-old-3.png` (275.9KB)
  - `favicon-old.png` (1.1KB)
  - `favicon.png` (51.1KB) - This is the file to be used as the new logo

## Target State
- The site will display the new `favicon.png` file as its main logo in the top-left corner of the navigation bar
- The new logo will be consistently displayed across all pages and devices
- The logo will represent the brand identity of Reader.market
- The text "Reader.Market" may be optionally preserved or replaced based on design requirements

## Implementation Strategy

### 1. Logo File Preparation
- The new logo file is named `favicon.png` and located in `client/public/`
- Ensure the image meets standard logo requirements:
  - Format: PNG
  - Recommended size: 40x40 pixels for navbar display
  - File size optimized for web delivery
  - Appropriate transparency if needed

### 2. Component Configuration
- Modify the `client/src/components/Navbar.tsx` component
- Replace the current `BookOpen` icon with an `<img>` element referencing the new logo
- Maintain proper styling and spacing within the navbar

### 3. Verification Requirements
- The logo should appear in the top-left corner of the navigation bar on all pages
- The logo should be clickable and navigate to the home page
- The logo should be responsive and display correctly on different screen sizes
- The logo should load consistently across different browsers and devices

## Technical Considerations

### Image Sizing
- The logo should be appropriately sized for the navbar (typically 24-40px height)
- CSS classes may need to be adjusted to maintain proper alignment

### Accessibility
- Add appropriate `alt` attribute for screen readers
- Ensure sufficient contrast with the background

### Responsive Design
- The logo should scale appropriately on mobile devices
- Consider how the logo appears in the mobile menu if applicable

## Success Criteria
1. The new logo appears in the top-left corner of the navigation bar
2. The logo is clickable and navigates to the home page
3. The logo displays correctly across different browsers (Chrome, Firefox, Safari, Edge)
4. The logo displays properly on both desktop and mobile devices
5. The logo maintains proper alignment and spacing within the navbar
6. The logo loads quickly without impacting page performance

## Deployment Impact
- Minimal deployment impact as the logo is served statically
- No backend changes required
- No database modifications needed
- No API changes required

## Rollback Plan
- If the new logo causes issues, revert the changes in `client/src/components/Navbar.tsx`
- Restore the original `BookOpen` icon implementation
- Clear browser caches to ensure consistent experience