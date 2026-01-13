/**
 * Test script to verify book added to shelf event tracking
 * Tests:
 * 1. User adds a book to a shelf
 * 2. Action has correct type and target
 * 3. Event appears in Last Actions feed
 * 
 * IMPORTANT: Server must be running on port 3000 before running this test
 * You must have a valid user account to test
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';

// Test configuration - update with your credentials
const TEST_USERNAME = 'testuser'; // Change to your test user
const TEST_PASSWORD = 'testpassword'; // Change to your test password

async function testBookAddedToShelfEvent() {
  console.log('='.repeat(60));
  console.log('Testing Book Added to Shelf Event Tracking');
  console.log('='.repeat(60));

  try {
    // 1. Login
    console.log('\n1. Logging in...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', errorText);
      console.log('\n⚠️  Please update TEST_USERNAME and TEST_PASSWORD in the script');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in successfully');
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: ${loginData.user.username}`);
    
    // 2. Get user's shelves
    console.log('\n2. Getting user shelves...');
    const shelvesResponse = await fetch(`${API_BASE}/api/shelves`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!shelvesResponse.ok) {
      const errorText = await shelvesResponse.text();
      console.error('❌ Failed to get shelves:', errorText);
      return;
    }

    const shelves = await shelvesResponse.json();
    if (!shelves || shelves.length === 0) {
      console.error('❌ No shelves found for user');
      console.log('\n⚠️  Please create a shelf first');
      return;
    }

    const testShelf = shelves[0];
    console.log('✅ Found shelf');
    console.log(`   Shelf ID: ${testShelf.id}`);
    console.log(`   Shelf Name: ${testShelf.name}`);
    
    // 3. Get available books
    console.log('\n3. Getting available books...');
    const booksResponse = await fetch(`${API_BASE}/api/books`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!booksResponse.ok) {
      const errorText = await booksResponse.text();
      console.error('❌ Failed to get books:', errorText);
      return;
    }

    const books = await booksResponse.json();
    if (!books || books.length === 0) {
      console.error('❌ No books found');
      console.log('\n⚠️  Please upload a book first');
      return;
    }

    const testBook = books[0];
    console.log('✅ Found book');
    console.log(`   Book ID: ${testBook.id}`);
    console.log(`   Book Title: ${testBook.title}`);
    
    // 4. Add book to shelf
    console.log('\n4. Adding book to shelf...');
    const addBookResponse = await fetch(`${API_BASE}/api/shelves/${testShelf.id}/books/${testBook.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!addBookResponse.ok) {
      const errorText = await addBookResponse.text();
      console.error('❌ Failed to add book to shelf:', errorText);
      console.log('\n💡 Note: Book might already be on the shelf');
      return;
    }

    console.log('✅ Book added to shelf successfully');
    
    // 5. Wait for action creation and broadcast
    console.log('\n5. Waiting for action creation (2 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Fetch Last Actions to verify the event appears
    console.log('\n6. Checking Last Actions feed...');
    const lastActionsResponse = await fetch(`${API_BASE}/api/stream/last-actions?limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!lastActionsResponse.ok) {
      const errorText = await lastActionsResponse.text();
      console.error('❌ Failed to fetch Last Actions:', errorText);
      return;
    }

    const lastActionsData = await lastActionsResponse.json();
    console.log(`   Total actions retrieved: ${lastActionsData.activities.length}`);
    
    // Find the book added to shelf event
    const bookAddedEvent = lastActionsData.activities.find(
      activity => activity.action_type === 'book_added_to_shelf' && 
                  activity.target?.id === testBook.id &&
                  activity.userId === userId
    );
    
    if (bookAddedEvent) {
      console.log('\n✅ Book added to shelf event found in Last Actions!');
      console.log('   Event Details:');
      console.log(`   - ID: ${bookAddedEvent.id}`);
      console.log(`   - Action Type: ${bookAddedEvent.action_type}`);
      console.log(`   - User ID: ${bookAddedEvent.userId}`);
      console.log(`   - Username: ${bookAddedEvent.user?.username || 'N/A'}`);
      console.log(`   - Target Type: ${bookAddedEvent.target?.type || 'N/A'}`);
      console.log(`   - Book ID: ${bookAddedEvent.target?.id || 'N/A'}`);
      console.log(`   - Book Title: ${bookAddedEvent.target?.title || 'N/A'}`);
      console.log(`   - Shelf ID: ${bookAddedEvent.target?.shelf_id || 'N/A'}`);
      console.log(`   - Shelf Name: ${bookAddedEvent.target?.shelf_name || 'N/A'}`);
      console.log(`   - Created At: ${bookAddedEvent.createdAt}`);
      
      // Verify structure
      console.log('\n7. Verifying event structure...');
      const checks = [
        { name: 'Has correct action_type', pass: bookAddedEvent.action_type === 'book_added_to_shelf' },
        { name: 'Has user object', pass: !!bookAddedEvent.user },
        { name: 'Has username', pass: !!bookAddedEvent.user?.username },
        { name: 'Has target object', pass: !!bookAddedEvent.target },
        { name: 'Target is book type', pass: bookAddedEvent.target?.type === 'book' },
        { name: 'Has book title', pass: !!bookAddedEvent.target?.title },
        { name: 'Has shelf_id', pass: !!bookAddedEvent.target?.shelf_id },
        { name: 'Has shelf_name', pass: !!bookAddedEvent.target?.shelf_name },
        { name: 'Has metadata', pass: !!bookAddedEvent.metadata },
        { name: 'Metadata has book_title', pass: !!bookAddedEvent.metadata?.book_title },
        { name: 'Metadata has shelf_name', pass: !!bookAddedEvent.metadata?.shelf_name },
        { name: 'Has timestamp', pass: !!bookAddedEvent.createdAt }
      ];

      checks.forEach(check => {
        const status = check.pass ? '✅' : '❌';
        console.log(`   ${status} ${check.name}`);
      });

      const allPassed = checks.every(check => check.pass);
      
      if (allPassed) {
        console.log('\n🎉 All checks passed! Event structure is correct.');
      } else {
        console.log('\n⚠️  Some checks failed. Please review the event structure.');
      }
    } else {
      console.log('\n❌ Book added to shelf event NOT found in Last Actions');
      console.log('\n   Showing all recent actions:');
      lastActionsData.activities.slice(0, 5).forEach((activity, i) => {
        console.log(`   ${i + 1}. ${activity.action_type} by ${activity.user?.username || 'Unknown'}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test completed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
  }
}

// Run the test
testBookAddedToShelfEvent();
