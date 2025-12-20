import { mockUser, mockOtherUser } from './mockData';

// Simple validation function to check reading statistics
export function validateReadingStats() {
  console.log('Validating reading statistics...');
  
  // Check user reading progress
  if (mockUser.readingProgress && mockUser.readingProgress.length > 0) {
    console.log('✓ User has reading progress data');
    
    // Check structure of reading progress
    const progress = mockUser.readingProgress[0];
    if ('bookId' in progress && 'percentage' in progress && 'wordsRead' in progress && 'lettersRead' in progress) {
      console.log('✓ Reading progress has correct structure');
    } else {
      console.log('✗ Reading progress structure is incorrect');
    }
  } else {
    console.log('✗ User does not have reading progress data');
  }
  
  // Check other user reading progress
  if (mockOtherUser.readingProgress && mockOtherUser.readingProgress.length > 0) {
    console.log('✓ Other user has reading progress data');
  } else {
    console.log('✗ Other user does not have reading progress data');
  }
  
  console.log('Validation complete.');
}

// Run validation if this file is executed directly
if (typeof window === 'undefined') {
  validateReadingStats();
}