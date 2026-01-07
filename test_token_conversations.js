// Test script to verify token and conversations
const token = localStorage.getItem('authToken');

console.log('\n=== Token and Conversations Test ===\n');

if (!token) {
  console.error('❌ No auth token found in localStorage!');
} else {
  console.log('✓ Token found');
  
  // Decode token to see user info
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload);
    console.log('  User ID:', payload.userId);
    console.log('  Username:', payload.username);
    
    // Test direct backend call
    console.log('\nTesting direct backend API call...');
    fetch('http://localhost:5001/api/conversations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('X-API-Version'));
      return response.json();
    })
    .then(data => {
      console.log('\nConversations received:', data.length);
      if (data.length > 0) {
        console.log('First conversation:', data[0]);
      } else {
        console.log('⚠️ No conversations found for this user');
      }
    })
    .catch(err => {
      console.error('API call failed:', err);
    });
    
  } catch (e) {
    console.error('Failed to decode token:', e);
  }
}

console.log('\n=========================\n');
