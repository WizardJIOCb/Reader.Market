const fetch = require('node-fetch');

async function debugProfileActivities() {
  try {
    console.log('=== Debugging Profile Activities API ===');
    
    // Test the profile activities endpoint
    const response = await fetch('http://localhost:3001/api/profile/605db90f-4691-4281-991e-b2e248e33915/activities');
    
    if (!response.ok) {
      console.error('Failed to fetch profile activities:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Activities response:', JSON.stringify(data, null, 2));
    
    // Check if reading progress data is included
    if (data.activities && Array.isArray(data.activities)) {
      console.log(`\n=== Found ${data.activities.length} activities ===`);
      
      data.activities.forEach((activity, index) => {
        console.log(`\n--- Activity ${index + 1} ---`);
        console.log('Type:', activity.type);
        console.log('ID:', activity.id);
        
        if (activity.metadata) {
          console.log('Has metadata:', true);
          console.log('Metadata keys:', Object.keys(activity.metadata));
          
          // Check for reading progress specifically
          if (activity.metadata.readingProgress) {
            console.log('✅ Has readingProgress in metadata:', activity.metadata.readingProgress);
          } else {
            console.log('❌ No readingProgress in metadata');
          }
          
          // Check for book_id
          if (activity.metadata.book_id) {
            console.log('Book ID:', activity.metadata.book_id);
          }
          
          // Check for user_id
          if (activity.metadata.user_id) {
            console.log('User ID:', activity.metadata.user_id);
          }
        } else {
          console.log('Has metadata:', false);
        }
        
        // Check if it's a comment or review with user info
        if ((activity.type === 'comment' || activity.type === 'review') && activity.metadata) {
          console.log('User ID from metadata:', activity.metadata.user_id);
          console.log('Book ID from metadata:', activity.metadata.book_id);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugProfileActivities();