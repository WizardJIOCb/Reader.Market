const fetch = require('node-fetch');

async function testShelvesWithBooksEndpoint() {
  try {
    console.log('=== Testing Shelves With Books Endpoint ===\n');
    
    // Test with user who has shelves
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    
    console.log('Testing /api/shelves/with-books endpoint:');
    
    // First, let's get a valid token by logging in
    console.log('Getting auth token...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'wizardjiocb',
        password: 'your_password_here' // You'll need to replace this with actual password
      })
    });
    
    if (!loginResponse.ok) {
      console.log('Login failed, trying with dummy token for testing...');
      // Proceed with testing the endpoint structure anyway
    }
    
    // Test the endpoint structure
    const response = await fetch('http://localhost:5001/api/shelves/with-books', {
      headers: {
        'Authorization': `Bearer dummy-token-for-testing`
      }
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Shelves returned: ${data.length}`);
      
      if (data.length > 0) {
        console.log('\nSample shelves with books:');
        data.slice(0, 2).forEach((shelf, index) => {
          console.log(`${index + 1}. Shelf: ${shelf.name}`);
          console.log(`   ID: ${shelf.id}`);
          console.log(`   Books count: ${shelf.books ? shelf.books.length : 0}`);
          if (shelf.books && shelf.books.length > 0) {
            console.log(`   Sample book: ${shelf.books[0].title}`);
            console.log(`   Has readingProgress: ${!!shelf.books[0].readingProgress}`);
          }
          console.log('');
        });
      }
      
      console.log('✅ Shelves with books endpoint is working!');
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      
      if (response.status === 401) {
        console.log('⚠️  Authentication required - endpoint exists but needs valid token');
      } else {
        console.log('❌ Endpoint returned error');
      }
    }
    
    // Also test the user-specific endpoint
    console.log('\nTesting /api/users/:userId/shelves/with-books endpoint:');
    const userShelvesResponse = await fetch(`http://localhost:5001/api/users/${userId}/shelves/with-books`);
    
    console.log('Status:', userShelvesResponse.status);
    
    if (userShelvesResponse.ok) {
      const userData = await userShelvesResponse.json();
      console.log(`User shelves returned: ${userData.length}`);
      console.log('✅ User shelves with books endpoint is working!');
    } else {
      const errorText = await userShelvesResponse.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testShelvesWithBooksEndpoint();