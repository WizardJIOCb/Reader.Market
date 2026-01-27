// Test script to verify bookmark collections functionality in reader
import fetch from 'node-fetch';

async function testReaderCollections() {
  try {
    console.log('Testing bookmark collections in reader...');
    
    // Get auth token (you'll need to replace this with a valid token)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4OGQ1OTk3NC02YjNmLTQ4YzctYjM2YS0zYzE3NDdjMTIzMzMiLCJhY2Nlc3NMZXZlbCI6ImFkbWluIiwiaWF0IjoxNzM3OTQyNTU0LCJleHAiOjE3Mzg1NDczNTR9.YhB2XzGzVQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ';
    
    // Test getting collections for a specific book
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
      console.log('Collections:', JSON.stringify(collections, null, 2));
    } else {
      console.log('Error response:', response.status, await response.text());
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testReaderCollections();