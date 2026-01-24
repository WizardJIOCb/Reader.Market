const fetch = require('node-fetch');

async function detailedActivityAnalysis() {
  try {
    console.log('=== Detailed Activity Analysis ===\n');
    
    const profileId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    
    // Test the profile activities endpoint
    const response = await fetch(`http://localhost:3001/api/profile/${profileId}/activities`);
    
    if (!response.ok) {
      console.error('Failed to fetch profile activities:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    console.log(`Total activities returned: ${data.activities.length}`);
    
    // Filter for activities related to "Взгляд таксы" 
    const vzglyadTaksyBookId = 'cba2883e-a92f-4245-ae04-6f16d0c2bb36';
    const vzglyadTaksyActivities = data.activities.filter(activity => 
      activity.bookId === vzglyadTaksyBookId || 
      activity.metadata?.book_id === vzglyadTaksyBookId
    );
    
    console.log(`\nActivities for "Взгляд таксы" (book ID: ${vzglyadTaksyBookId}): ${vzglyadTaksyActivities.length}`);
    
    vzglyadTaksyActivities.forEach((activity, index) => {
      console.log(`\n--- Activity ${index + 1} ---`);
      console.log('ID:', activity.id);
      console.log('Type:', activity.type);
      console.log('Book ID:', activity.bookId || activity.metadata?.book_id);
      console.log('Reading Progress:', activity.metadata?.readingProgress);
      console.log('Reading Progress Type:', typeof activity.metadata?.readingProgress);
      
      // Check if this should have reading progress
      if (activity.metadata?.readingProgress === null || activity.metadata?.readingProgress === undefined) {
        console.log('⚠️  This activity has null/undefined reading progress when it should have data');
      }
    });
    
    // Also check for activities that DO have reading progress to compare
    const activitiesWithReadingProgress = data.activities.filter(activity => 
      activity.metadata?.readingProgress !== null && 
      activity.metadata?.readingProgress !== undefined
    );
    
    console.log(`\nActivities with reading progress: ${activitiesWithReadingProgress.length}`);
    
    if (activitiesWithReadingProgress.length > 0) {
      console.log('\nFirst activity with reading progress:');
      const firstWithProgress = activitiesWithReadingProgress[0];
      console.log('ID:', firstWithProgress.id);
      console.log('Type:', firstWithProgress.type);
      console.log('Book ID:', firstWithProgress.bookId || firstWithProgress.metadata?.book_id);
      console.log('Reading Progress:', firstWithProgress.metadata?.readingProgress);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

detailedActivityAnalysis();