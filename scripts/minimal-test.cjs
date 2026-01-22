const { Client } = require('pg');

async function minimalTest() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Minimal Test of Key Queries ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    // Test 1: Basic user info query
    console.log('1. Testing user info query...');
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    console.log(`User found: ${userInfo.rows.length > 0 ? 'YES' : 'NO'}`);
    if (userInfo.rows.length > 0) {
      console.log(`Username: ${userInfo.rows[0].username}`);
    }
    
    // Test 2: User comments query
    console.log('\n2. Testing user comments query...');
    const userComments = await client.query(`
      SELECT * FROM comments 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);
    console.log(`User comments found: ${userComments.rows.length}`);
    
    // Test 3: Subscriptions query
    console.log('\n3. Testing subscriptions query...');
    const subscriptions = await client.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    console.log(`Subscriptions found: ${subscriptions.rows.length}`);
    
    // Test 4: Recent comments from subscribed books
    if (subscriptions.rows.length > 0) {
      console.log('\n4. Testing subscribed comments query...');
      const subscription = subscriptions.rows[0];
      const recentComments = await client.query(`
        SELECT c.*, b.title as book_title, u.username as author_username
        FROM comments c
        JOIN books b ON c.book_id = b.id
        JOIN users u ON c.user_id = u.id
        WHERE c.book_id = $1
        AND c.user_id != $2
        AND c.created_at > $3
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [subscription.entity_id, userId, subscription.last_read_at]);
      
      console.log(`Recent comments from subscription: ${recentComments.rows.length}`);
      recentComments.rows.forEach((comment, index) => {
        console.log(`  ${index + 1}. ${comment.author_username}: "${comment.content}"`);
      });
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

minimalTest();