/**
 * Test script for Cyrillic search functionality fix
 * Tests the search endpoint with Cyrillic characters
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:5001';

async function login() {
  console.log('🔐 Logging in...');
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user1',
        password: 'password123'
      })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Login successful');
    return data.token;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    throw error;
  }
}

async function testSearch(token, query, testName) {
  console.log(`\n📚 Test: ${testName}`);
  console.log(`   Query: "${query}"`);
  
  try {
    const params = new URLSearchParams({ query: query });
    const url = `${API_URL}/api/books/search?${params.toString()}`;
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const books = await response.json();
    console.log(`   ✅ Results: ${books.length} books found`);
    
    if (books.length > 0) {
      console.log(`   📖 First result: "${books[0].title}" by ${books[0].author}`);
      
      // Check if we found the expected book
      if (query === 'Гиперион' || query.toLowerCase().includes('гиперион')) {
        const found = books.some(book => 
          book.title.toLowerCase().includes('гиперион') || 
          book.author.toLowerCase().includes('симмонс')
        );
        if (found) {
          console.log('   ✅ Expected book "Гиперион" found!');
        } else {
          console.log('   ⚠️  Expected book "Гиперион" NOT found');
        }
      }
    } else {
      console.log('   ⚠️  No results found');
    }

    return books;
  } catch (error) {
    console.error(`   ❌ Search error: ${error.message}`);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting Cyrillic Search Tests\n');
  console.log('=' .repeat(60));

  try {
    const token = await login();

    // Test 1: Cyrillic search - exact title
    await testSearch(token, 'Гиперион', 'Cyrillic - Exact Title');

    // Test 2: Cyrillic search - partial title
    await testSearch(token, 'Гипер', 'Cyrillic - Partial Title');

    // Test 3: Cyrillic search - author name
    await testSearch(token, 'Симмонс', 'Cyrillic - Author Name');

    // Test 4: Latin search (regression test)
    await testSearch(token, 'Hyperion', 'Latin - Title (if exists)');

    // Test 5: Empty search (should return all books)
    await testSearch(token, '', 'Empty Query - All Books');

    // Test 6: Mixed case
    await testSearch(token, 'гиперион', 'Cyrillic - Lowercase');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
