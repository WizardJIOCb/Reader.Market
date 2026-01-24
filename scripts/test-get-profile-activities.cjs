// This script will test the getProfileActivitiesDirect function directly
// We need to import and call it to see what it actually returns

const { getProfileActivitiesDirect } = require('../server/directStorage.ts');

async function testGetProfileActivitiesDirect() {
  try {
    console.log('=== Testing getProfileActivitiesDirect ===\n');
    
    const profileId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    const limit = 50;
    const offset = 0;
    
    console.log(`Calling getProfileActivitiesDirect for user ${profileId}`);
    
    const activities = await getProfileActivitiesDirect(profileId, limit, offset);
    
    console.log(`\nReturned ${activities.length} activities`);
    
    // Look specifically for activities related to "Взгляд таксы" (book ID: cba2883e-a92f-4245-ae04-6f16d0c2bb36)
    const vzglyadTaksyActivities = activities.filter(activity => 
      activity.bookId === 'cba2883e-a92f-4245-ae04-6f16d0c2bb36' ||
      activity.metadata?.book_id === 'cba2883e-a92f-4245-ae04-6f16d0c2bb36'
    );
    
    console.log(`\nFound ${vzglyadTaksyActivities.length} activities for "Взгляд таксы":`);
    
    vzglyadTaksyActivities.forEach((activity, index) => {
      console.log(`\n--- Activity ${index + 1} ---`);
      console.log('ID:', activity.id);
      console.log('Type:', activity.type);
      console.log('Book ID:', activity.bookId || activity.metadata?.book_id);
      console.log('Reading Progress:', activity.metadata?.readingProgress);
      console.log('Reading Progress Type:', typeof activity.metadata?.readingProgress);
    });
    
  } catch (error) {
    console.error('Error testing getProfileActivitiesDirect:', error);
  }
}

testGetProfileActivitiesDirect();