// Test the actual API endpoint to see what's being returned
import fetch from 'node-fetch';

async function testActualApiEndpoint() {
  try {
    console.log('Testing actual API endpoint...\n');
    
    // You'll need to get a valid auth token from your browser's localStorage
    // After logging in, run this in browser console:
    // localStorage.getItem('authToken')
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4OGQ1OTk3NC02YjNmLTQ4YzctYjM2YS0zYzE3NDdjMTIzMzMiLCJhY2Nlc3NMZXZlbCI6ImFkbWluIiwiaWF0IjoxNzM3OTQyNTU0LCJleHAiOjE3Mzg1NDczNTR9.YhB2XzGzVQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ'; // Replace with your actual token
    
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log('Making API call to:', `http://localhost:5001/api/bookmark-collections/book/${bookId}`);
    console.log('With auth token:', token.substring(0, 20) + '...');
    
    const response = await fetch(`http://localhost:5001/api/bookmark-collections/book/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.ok) {
      const collections = await response.json();
      console.log('\n=== API Response ===');
      console.log('Total collections found:', collections.length);
      
      if (collections.length > 0) {
        console.log('\nCollections:');
        collections.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name} (ID: ${collection.id})`);
          console.log(`   Owner: ${collection.ownerUsername} (${collection.isOwn ? 'Own' : 'Other'})`);
          console.log(`   Public: ${collection.isPublic ? 'Yes' : 'No'}`);
          console.log(`   Bookmark Count: ${collection.bookmarkCount}`);
          console.log(`   Owner ID: ${collection.ownerId}`);
          console.log('');
        });
      } else {
        console.log('No collections returned by API');
      }
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testActualApiEndpoint();