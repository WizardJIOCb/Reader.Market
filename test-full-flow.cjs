// Тестовый скрипт для проверки shelves endpoint
// Запуск: node test-full-flow.cjs

const axios = require('axios');

async function testFullFlow() {
  try {
    console.log('🚀 Starting full test flow...\n');
    
    // 1. Login to get valid token
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'rodion89@list.ru',
      password: 'YOUR_PASSWORD'  // Замените на ваш пароль
    }, {
      timeout: 5000
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...\n');
    
    // 2. Call shelves endpoint
    console.log('2. Calling /api/shelves/with-books...');
    const shelvesResponse = await axios.get('http://localhost:5001/api/shelves/with-books', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    
    console.log('✅ Shelves endpoint responded successfully\n');
    console.log('Response data:');
    console.log(JSON.stringify(shelvesResponse.data, null, 2));
    
    // 3. Analyze results
    console.log('\n📊 Analysis:');
    console.log(`Total shelves: ${shelvesResponse.data.length}`);
    
    shelvesResponse.data.forEach((shelf, index) => {
      console.log(`${index + 1}. ${shelf.name}: ${shelf.books.length} books`);
      if (shelf.books.length > 0) {
        console.log('   Books:');
        shelf.books.forEach(book => {
          console.log(`     - ${book.title} by ${book.author}`);
        });
      } else {
        console.log('   (empty)');
      }
    });
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testFullFlow();