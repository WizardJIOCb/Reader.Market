const axios = require('axios');

async function testShelvesEndpoint() {
  try {
    // Сначала попробуем залогиниться, чтобы получить токен
    console.log('Attempting to login...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    const token = loginResponse.data.token;
    console.log('Got token:', token.substring(0, 20) + '...');
    
    // Теперь попробуем вызвать endpoint полок
    console.log('Calling shelves endpoint...');
    const shelvesResponse = await axios.get('http://localhost:5001/api/shelves/with-books', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Shelves response:', JSON.stringify(shelvesResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testShelvesEndpoint();