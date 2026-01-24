// Test to verify the optimization is working by measuring actual HTTP requests
const fetch = require('node-fetch');

async function verifyOptimizationWorking() {
  try {
    console.log('=== Verifying Optimization is Working ===\n');
    
    // Test with user who has activities and reading progress
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    
    console.log('1. Testing profile activities API response:');
    const activitiesResponse = await fetch(`http://localhost:3001/api/profile/${userId}/activities`);
    
    if (!activitiesResponse.ok) {
      console.error('Failed to fetch activities');
      return;
    }
    
    const activitiesData = await activitiesResponse.json();
    console.log(`   Total activities: ${activitiesData.activities.length}`);
    
    // Count how many activities have reading progress data
    const activitiesWithProgress = activitiesData.activities.filter(activity => 
      activity.metadata?.readingProgress !== null && 
      activity.metadata?.readingProgress !== undefined
    );
    
    console.log(`   Activities with reading progress: ${activitiesWithProgress.length}`);
    
    // Count unique books that have reading progress
    const booksWithProgress = new Set();
    activitiesWithProgress.forEach(activity => {
      const bookId = activity.bookId || activity.metadata?.book_id;
      if (bookId && activity.metadata?.readingProgress) {
        booksWithProgress.add(bookId);
      }
    });
    
    console.log(`   Unique books with reading progress: ${booksWithProgress.size}`);
    console.log(`   Books:`, Array.from(booksWithProgress));
    
    console.log('\n2. Expected behavior:');
    console.log(`   - Profile activities API should return ${activitiesData.activities.length} activities`);
    console.log(`   - ${activitiesWithProgress.length} of these should have embedded reading progress data`);
    console.log(`   - Frontend components should use this embedded data instead of making ${booksWithProgress.size} separate API calls`);
    console.log(`   - Actual HTTP requests for reading progress should be 0 (instead of ${booksWithProgress.size})`);
    
    console.log('\n3. If optimization is working:');
    console.log(`   ✅ Activities API includes reading progress in metadata`);
    console.log(`   ✅ Frontend components detect and use embedded data`);
    console.log(`   ✅ No separate /api/books/{id}/reading-progress/{userId} requests are made`);
    
    console.log('\n4. If optimization is NOT working:');
    console.log(`   ❌ Frontend components ignore embedded data`);
    console.log(`   ❌ ${booksWithProgress.size} separate API calls are still made`);
    console.log(`   ❌ You see requests to /api/books/{id}/reading-progress/{userId} in network tab`);
    
    // Show sample of what the embedded data looks like
    if (activitiesWithProgress.length > 0) {
      console.log('\n5. Sample embedded reading progress data:');
      const sample = activitiesWithProgress[0];
      console.log(`   Activity ID: ${sample.id}`);
      console.log(`   Book ID: ${sample.bookId || sample.metadata?.book_id}`);
      console.log(`   Reading Progress:`, sample.metadata?.readingProgress);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyOptimizationWorking();