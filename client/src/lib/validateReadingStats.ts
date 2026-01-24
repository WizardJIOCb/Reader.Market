import { mockUser, mockOtherUser } from './mockData';

// Simple validation function to check reading statistics
export function validateReadingStats() {
  
  
  // Check user reading progress
  if (mockUser.readingProgress && mockUser.readingProgress.length > 0) {
    
    
    // Check structure of reading progress
    const progress = mockUser.readingProgress[0];
    if ('bookId' in progress && 'percentage' in progress && 'wordsRead' in progress && 'lettersRead' in progress) {
      
    } else {
      
    }
  } else {
    
  }
  
  // Check other user reading progress
  if (mockOtherUser.readingProgress && mockOtherUser.readingProgress.length > 0) {
    
  } else {
    
  }
  
  
}

// Run validation if this file is executed directly
if (typeof window === 'undefined') {
  validateReadingStats();
}