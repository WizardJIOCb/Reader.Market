const fetch = require('node-fetch');

// This script tests the admin delete endpoints for comments and reviews

async function testAdminDeleteEndpoints() {
  const baseUrl = 'http://localhost:5001';
  
  console.log('\n🔍 Testing Admin Delete Endpoints...\n');
  
  // First, we need to login as an admin user
  console.log('1. Logging in as admin user...');
  
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('❌ Failed to login:', await loginResponse.text());
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  const user = loginData.user;
  
  console.log('✅ Logged in successfully');
  console.log('   User:', user.username);
  console.log('   Access Level:', user.accessLevel);
  console.log('   Token:', token.substring(0, 20) + '...');
  
  // Test if admin endpoints exist
  console.log('\n2. Testing admin comment delete endpoint (OPTIONS)...');
  const commentOptionsResponse = await fetch(`${baseUrl}/api/admin/comments/test-id`, {
    method: 'OPTIONS',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('   Response status:', commentOptionsResponse.status);
  
  console.log('\n3. Testing admin review delete endpoint (OPTIONS)...');
  const reviewOptionsResponse = await fetch(`${baseUrl}/api/admin/reviews/test-id`, {
    method: 'OPTIONS',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('   Response status:', reviewOptionsResponse.status);
  
  // Try to get a list of comments to test with
  console.log('\n4. Getting list of books to find comments...');
  const booksResponse = await fetch(`${baseUrl}/api/books`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (booksResponse.ok) {
    const books = await booksResponse.json();
    console.log('✅ Found', books.length, 'books');
    
    if (books.length > 0) {
      const bookId = books[0].id;
      console.log('   Using book ID:', bookId);
      
      // Get comments for this book
      console.log('\n5. Getting comments for book...');
      const commentsResponse = await fetch(`${baseUrl}/api/books/${bookId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        console.log('✅ Found', comments.length, 'comments');
        
        if (comments.length > 0) {
          console.log('\n   Sample comment:');
          console.log('   - ID:', comments[0].id);
          console.log('   - Author:', comments[0].author);
          console.log('   - User ID:', comments[0].userId);
          console.log('   - Content:', comments[0].content.substring(0, 50) + '...');
        }
      }
      
      // Get reviews for this book
      console.log('\n6. Getting reviews for book...');
      const reviewsResponse = await fetch(`${baseUrl}/api/books/${bookId}/reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (reviewsResponse.ok) {
        const reviews = await reviewsResponse.json();
        console.log('✅ Found', reviews.length, 'reviews');
        
        if (reviews.length > 0) {
          console.log('\n   Sample review:');
          console.log('   - ID:', reviews[0].id);
          console.log('   - Author:', reviews[0].author);
          console.log('   - User ID:', reviews[0].userId);
          console.log('   - Rating:', reviews[0].rating);
        }
      }
    }
  }
  
  console.log('\n✅ Test complete!\n');
  console.log('📝 Summary:');
  console.log('   - Admin login: Working');
  console.log('   - User access level:', user.accessLevel);
  console.log('   - Admin endpoints should be accessible with this token');
  console.log('\n💡 To test deletion, use the comment or review IDs shown above');
  console.log('   Frontend should call: /api/admin/comments/:id or /api/admin/reviews/:id');
  console.log('   with Authorization header: Bearer ' + token.substring(0, 20) + '...\n');
}

testAdminDeleteEndpoints().catch(console.error);
