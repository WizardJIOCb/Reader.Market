const fetch = require('node-fetch');

async function testCurrentlyReadingEndpoint() {
  try {
    console.log('=== Testing Currently Reading Endpoint ===\n');
    
    // Test with user who has reading progress
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDVkYjkwZi00NjkxLTQyODEtOTkxZS1iMmUyNDhlMzM5MTUiLCJ1c2VybmFtZSI6IndpemFyZHRlc3QxIiwiaWF0IjoxNzczNzQ4NTY2LCJleHAiOjE3NzM4MzQ5NjZ9.XYZ'; // Dummy token for testing
    
    console.log('Testing /api/books/currently-reading endpoint:');
    const response = await fetch('http://localhost:3001/api/books/currently-reading', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Books returned: ${data.length}`);
      
      if (data.length > 0) {
        console.log('\nSample books with reading progress:');
        data.slice(0, 3).forEach((book, index) => {
          console.log(`${index + 1}. Title: ${book.title}`);
          console.log(`   ID: ${book.id}`);
          console.log(`   Has readingProgress: ${!!book.readingProgress}`);
          if (book.readingProgress) {
            console.log(`   Reading Progress:`, book.readingProgress);
          }
          console.log('');
        });
      }
    } else {
      console.log('Error:', response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCurrentlyReadingEndpoint();