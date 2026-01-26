const fetch = require('node-fetch');

async function testBookmarkCollectionsAPI() {
  const baseURL = 'http://localhost:5001';
  
  try {
    console.log('Testing Bookmark Collections API...\n');
    
    // First, login to get auth token
    console.log('Logging in test user...');
    const loginResponse = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'testuser_collections',
        password: 'testpass123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful\n');
    
    // Test creating a new collection
    console.log('Creating new collection...');
    const createResponse = await fetch(`${baseURL}/api/bookmark-collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Favorite Quotes',
        description: 'My favorite quotes from various books',
        color: '#00ff00',
        isPublic: false
      })
    });
    
    if (!createResponse.ok) {
      console.error('❌ Failed to create collection:', await createResponse.text());
      return;
    }
    
    const createdCollection = await createResponse.json();
    console.log('✅ Collection created:', createdCollection.name);
    console.log('Collection ID:', createdCollection.id, '\n');
    
    // Test getting all collections
    console.log('Getting all collections...');
    const getAllResponse = await fetch(`${baseURL}/api/bookmark-collections`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!getAllResponse.ok) {
      console.error('❌ Failed to get collections:', await getAllResponse.text());
      return;
    }
    
    const collections = await getAllResponse.json();
    console.log(`✅ Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`  - ${col.name} (${col.bookmarkCount || 0} bookmarks)`);
    });
    console.log();
    
    // Test getting specific collection
    console.log('Getting specific collection...');
    const getResponse = await fetch(`${baseURL}/api/bookmark-collections/${createdCollection.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!getResponse.ok) {
      console.error('❌ Failed to get collection:', await getResponse.text());
      return;
    }
    
    const collectionDetails = await getResponse.json();
    console.log('✅ Collection details retrieved');
    console.log('Name:', collectionDetails.name);
    console.log('Description:', collectionDetails.description);
    console.log('Bookmarks count:', collectionDetails.bookmarks?.length || 0);
    console.log();
    
    // Test updating collection
    console.log('Updating collection...');
    const updateResponse = await fetch(`${baseURL}/api/bookmark-collections/${createdCollection.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Favorite Literary Quotes',
        description: 'My favorite quotes from literature'
      })
    });
    
    if (!updateResponse.ok) {
      console.error('❌ Failed to update collection:', await updateResponse.text());
      return;
    }
    
    const updatedCollection = await updateResponse.json();
    console.log('✅ Collection updated');
    console.log('New name:', updatedCollection.name);
    console.log();
    
    // Test deleting collection
    console.log('Deleting collection...');
    const deleteResponse = await fetch(`${baseURL}/api/bookmark-collections/${createdCollection.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!deleteResponse.ok) {
      console.error('❌ Failed to delete collection:', await deleteResponse.text());
      return;
    }
    
    console.log('✅ Collection deleted successfully\n');
    
    console.log('🎉 All API tests passed! Bookmark collections API is working correctly.');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testBookmarkCollectionsAPI();