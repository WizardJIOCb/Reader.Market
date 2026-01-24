// Test pagination utility functions
import { paginateContent, getPagePositionIdentifier, findPageByPosition } from './paginationUtils';

// Simple test content
const testContent = `
<h1>Test Book</h1>
<p>This is a test paragraph with some content to paginate.</p>
<p>This is another paragraph with more content to test pagination.</p>
<p>This is a third paragraph with even more content to test pagination.</p>
`;

// Test the pagination function

try {
  const pages = paginateContent(testContent, 300); // Small height for testing
  
  
  pages.forEach((page, index) => {
    
     + '...');
    
  });
  
  // Test position tracking
  if (pages.length > 0) {
    const positionId = getPagePositionIdentifier(pages[0]);
    
    
    const foundIndex = findPageByPosition(pages, positionId);
    
  }
} catch (error) {
  console.error('Error testing pagination:', error);
}