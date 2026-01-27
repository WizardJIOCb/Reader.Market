// Test script to verify the collection search fix
import fetch from 'node-fetch';

async function testCollectionSearch() {
  try {
    console.log('Testing collection search fix...');
    
    // You'll need to get a valid auth token from your browser's localStorage
    // After logging in, run this in browser console:
    // localStorage.getItem('authToken')
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4OGQ1OTk3NC02YjNmLTQ4YzctYjM2YS0zYzE3NDdjMTIzMzMiLCJhY2Nlc3NMZXZlbCI6ImFkbWluIiwiaWF0IjoxNzM3OTQyNTU0LCJleHAiOjE3Mzg1NDczNTR9.YhB2XzGzVQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ'; // Replace with your actual token
    
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log(`Fetching collections for book: ${bookId}`);
    
    const response = await fetch(`http://localhost:5001/api/bookmark-collections/book/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const collections = await response.json();
      console.log('Collections found:', collections.length);
      
      console.log('\n=== Collections List ===');
      collections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name}`);
        console.log(`   ID: ${collection.id}`);
        console.log(`   Owner: ${collection.ownerUsername || 'Unknown'} (${collection.isOwn ? 'Own' : 'Other'})`);
        console.log(`   Public: ${collection.isPublic ? 'Yes' : 'No'}`);
        console.log(`   Bookmark Count: ${collection.bookmarkCount}`);
        console.log(`   Description: ${collection.description || 'No description'}`);
        console.log('');
      });
      
      // Check if the specific collection e42ea31c-9484-425d-8f45-3a07f3d79f36 is present
      const targetCollection = collections.find(c => c.id === 'e42ea31c-9484-425d-8f45-3a07f3d79f36');
      if (targetCollection) {
        console.log('✅ Target collection found!');
        console.log('Collection details:');
        console.log('- Name:', targetCollection.name);
        console.log('- Owner:', targetCollection.ownerUsername);
        console.log('- Is Public:', targetCollection.isPublic);
        console.log('- Bookmark Count:', targetCollection.bookmarkCount);
        console.log('- Is Own:', targetCollection.isOwn);
      } else {
        console.log('❌ Target collection NOT found in results');
        console.log('This means either:');
        console.log('1. The collection is not associated with this book');
        console.log('2. The collection is not public');
        console.log('3. There might be a data issue');
      }
    } else {
      console.log('Error response:', response.status, await response.text());
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCollectionSearch();