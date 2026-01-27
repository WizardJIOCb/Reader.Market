// Test script to verify collection search functionality
import fetch from 'node-fetch';

async function testCollectionSearchFunctionality() {
  try {
    console.log('Testing collection search functionality...\n');
    
    // Get auth token from localStorage (you'll need to copy this from your browser)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4OGQ1OTk3NC02YjNmLTQ4YzctYjM2YS0zYzE3NDdjMTIzMzMiLCJhY2Nlc3NMZXZlbCI6ImFkbWluIiwiaWF0IjoxNzM3OTQyNTU0LCJleHAiOjE3Mzg1NDczNTR9.YhB2XzGzVQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ'; // Replace with your actual token
    
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    // Test 1: Get all collections for the book (should include the "Тест" collection)
    console.log('=== Test 1: Getting all collections for book ===');
    const allCollectionsResponse = await fetch(`http://localhost:5001/api/bookmark-collections/book/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (allCollectionsResponse.ok) {
      const allCollections = await allCollectionsResponse.json();
      console.log(`Found ${allCollections.length} collections:`);
      allCollections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name} (${collection.id})`);
        console.log(`   Owner: ${collection.ownerUsername} (${collection.isOwn ? 'Own' : 'Other'})`);
        console.log(`   Public: ${collection.isPublic ? 'Yes' : 'No'}`);
        console.log(`   Bookmark Count: ${collection.bookmarkCount}`);
        console.log('');
      });
      
      // Check if "Тест" collection is present
      const testCollection = allCollections.find(c => c.name === 'Тест');
      if (testCollection) {
        console.log('✅ "Тест" collection found in API response');
      } else {
        console.log('❌ "Тест" collection NOT found in API response');
      }
    } else {
      console.log('Error getting collections:', allCollectionsResponse.status, await allCollectionsResponse.text());
      return;
    }
    
    // Test 2: Simulate search filtering (what the frontend should be doing)
    console.log('\n=== Test 2: Simulating frontend search filtering ===');
    const collections = await allCollectionsResponse.json(); // Reuse the data
    
    // Test search for "Тест"
    const searchQuery = 'Тест';
    const filtered = collections.filter(collection => 
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (collection.description && collection.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    console.log(`Searching for "${searchQuery}": Found ${filtered.length} results`);
    filtered.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
    
    // Test search for "Wizard" (should find collections by WizardJIOCb)
    const searchQuery2 = 'Wizard';
    const filtered2 = collections.filter(collection => 
      collection.name.toLowerCase().includes(searchQuery2.toLowerCase()) ||
      (collection.description && collection.description.toLowerCase().includes(searchQuery2.toLowerCase())) ||
      (collection.ownerUsername && collection.ownerUsername.toLowerCase().includes(searchQuery2.toLowerCase()))
    );
    
    console.log(`\nSearching for "${searchQuery2}": Found ${filtered2.length} results`);
    filtered2.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name} (by ${collection.ownerUsername})`);
    });
    
    console.log('\n=== Test Results ===');
    console.log('If the API returns collections correctly but search still doesn\'t work in frontend,');
    console.log('the issue is likely in the React component filtering logic.');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCollectionSearchFunctionality();