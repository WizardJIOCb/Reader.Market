import axios from 'axios';

async function testAuth() {
  try {
    // Test registration
    console.log('Testing user registration...');
    const registerResponse = await axios.post('http://localhost:3000/api/auth/register', {
      username: 'testuser',
      password: 'testpass123',
      email: 'test@example.com',
      fullName: 'Test User'
    });
    
    console.log('Registration response:', registerResponse.data);
    
    // Test login
    console.log('\nTesting user login...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'testuser',
      password: 'testpass123'
    });
    
    console.log('Login response:', loginResponse.data);
    
    // Test profile access
    console.log('\nTesting profile access...');
    const profileResponse = await axios.get('http://localhost:3000/api/profile', {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    
    console.log('Profile response:', profileResponse.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testAuth();