const fetch = require('node-fetch');

async function debugShelves() {
  try {
    console.log('=== Debugging Shelves Issue ===\n');
    
    // Try to login first to get a token
    console.log('1. Attempting to login...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'WizardJIOCb',
        password: 'your_password_here' // Replace with actual password
      })
    });
    
    let token = null;
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      token = loginData.token;
      console.log('✅ Login successful');
    } else {
      console.log('❌ Login failed, proceeding with dummy token');
      token = 'dummy-token';
    }
    
    // Test the shelves endpoint
    console.log('\n2. Testing /api/shelves/with-books endpoint...');
    const shelvesResponse = await fetch('http://localhost:5001/api/shelves/with-books', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Status:', shelvesResponse.status);
    
    if (shelvesResponse.ok) {
      const shelvesData = await shelvesResponse.json();
      console.log('\nShelves data:');
      console.log(JSON.stringify(shelvesData, null, 2));
      
      console.log(`\nFound ${shelvesData.length} shelves`);
      
      // Check each shelf
      shelvesData.forEach((shelf, index) => {
        console.log(`\nShelf ${index + 1}:`);
        console.log(`  ID: ${shelf.id}`);
        console.log(`  Name: ${shelf.name}`);
        console.log(`  Book IDs: ${shelf.bookIds ? shelf.bookIds.join(', ') : 'None'}`);
        console.log(`  Books array: ${shelf.books ? shelf.books.length : 0} items`);
        
        if (shelf.books && shelf.books.length > 0) {
          console.log('  Books:');
          shelf.books.forEach((book, bookIndex) => {
            console.log(`    ${bookIndex + 1}. ${book.title || 'Unknown title'} (ID: ${book.id})`);
          });
        }
      });
    } else {
      console.log('❌ Failed to fetch shelves');
      const errorText = await shelvesResponse.text();
      console.log('Error:', errorText);
    }
    
    // Also test the storage method directly
    console.log('\n3. Testing storage method directly...');
    // This would require importing the storage module, but let's focus on the API response
    
  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

debugShelves();