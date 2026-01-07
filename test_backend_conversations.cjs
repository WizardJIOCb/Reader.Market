const fetch = require('node-fetch');

async function testBackendConversations() {
  try {
    // This is the JWT token from the browser console logs
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDVkYjkwZi00NjkxLTQyODEtOTkxZS1iMmUyNDhlMzM5MTUiLCJ1c2VybmFtZSI6Im1pY2hhZWwiLCJpYXQiOjE3MzYyMTU5Mzh9.8pCv8pJJk8bq1z_qV4U5xN8oQ8fZGQ_K5pCJxB8xA';
    
    console.log('Testing backend API: GET /api/conversations');
    console.log('');
    
    const response = await fetch('http://localhost:5001/api/conversations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    console.log('');
    
    const data = await response.json();
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    console.log('Number of conversations:', data.length || 0);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testBackendConversations();
