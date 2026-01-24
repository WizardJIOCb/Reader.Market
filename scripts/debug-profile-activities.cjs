const fetch = require('node-fetch');

async function debugProfileActivities() {
  try {
    console.log('Debugging profile activities reading progress...\n');
    
    // Try to login, if that fails, register a new test user
    let token, userId;
    
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_debug_user',
        password: 'password123'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      token = loginData.token;
      userId = loginData.user.id;
      console.log(`Logged in as existing user ID: ${userId}`);
    } else {
      // Register new user
      const registerResponse = await fetch('http://localhost:5001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'test_debug_user',
          email: `test_debug_${Date.now()}@example.com`,
          password: 'password123',
          fullName: 'Test Debug User'
        })
      });
      
      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        token = registerData.token;
        userId = registerData.user.id;
        console.log(`Registered and logged in as user ID: ${userId}`);
      } else {
        console.log('Failed to login or register');
        return;
      }
    }
    console.log(`Logged in as user ID: ${userId}\n`);
    
    // Fetch profile activities
    console.log('=== Fetching Profile Activities ===');
    const activitiesResponse = await fetch(`http://localhost:5001/api/profile/${userId}/activities`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!activitiesResponse.ok) {
      console.log('Failed to fetch activities');
      return;
    }
    
    const activitiesData = await activitiesResponse.json();
    console.log(`Found ${activitiesData.activities?.length || 0} activities\n`);
    
    // Examine each activity's metadata
    if (activitiesData.activities) {
      activitiesData.activities.forEach((activity, index) => {
        console.log(`--- Activity ${index + 1} ---`);
        console.log(`Type: ${activity.type}`);
        console.log(`ID: ${activity.id}`);
        console.log(`Book ID: ${activity.bookId}`);
        console.log(`User ID: ${activity.userId}`);
        console.log(`Metadata keys:`, Object.keys(activity.metadata || {}));
        console.log(`Metadata readingProgress:`, activity.metadata?.readingProgress);
        console.log(`Full metadata:`, JSON.stringify(activity.metadata, null, 2));
        console.log('');
      });
    }
    
    console.log('=== Debug Complete ===');
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  }
}

debugProfileActivities();