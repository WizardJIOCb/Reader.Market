const fetch = require('node-fetch');

// This script tests the language preference API
// You need to provide a valid auth token from your browser

const testLanguageAPI = async () => {
  const token = process.argv[2];
  
  if (!token) {
    console.log('Usage: node test_language_api.cjs <auth_token>');
    console.log('\nTo get your auth token:');
    console.log('1. Open browser dev tools (F12)');
    console.log('2. Go to Application > Local Storage > http://localhost:3001');
    console.log('3. Copy the value of "authToken"');
    return;
  }
  
  try {
    console.log('Testing PUT /api/profile/language with token:', token.substring(0, 20) + '...');
    
    const response = await fetch('http://localhost:5001/api/profile/language', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ language: 'ru' })
    });
    
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Response (JSON):', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Response (Text, first 200 chars):', text.substring(0, 200));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testLanguageAPI();
