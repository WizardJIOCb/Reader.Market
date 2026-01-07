// Test script for messaging API
// Run with: node test_messaging_api.cjs

const API_BASE = 'http://localhost:5001';
const TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token from localStorage

async function testAPI() {
  console.log('Testing Messaging API...\n');

  // Test 1: Get conversations
  try {
    console.log('1. Testing GET /api/conversations');
    const response = await fetch(`${API_BASE}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: Get unread count
  try {
    console.log('2. Testing GET /api/messages/unread-count');
    const response = await fetch(`${API_BASE}/api/messages/unread-count`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: Search users
  try {
    console.log('3. Testing GET /api/users/search?q=test');
    const response = await fetch(`${API_BASE}/api/users/search?q=test`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI().catch(console.error);
