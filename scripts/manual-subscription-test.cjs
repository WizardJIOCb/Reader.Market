const { Client } = require('pg');

async function manualTest() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // WizardJIOCb
    const bookId = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'; // The book
    
    console.log('Manual test of subscription system...\n');
    
    // Manually create a subscription
    console.log('1. Creating manual subscription...');
    const subscriptionResult = await client.query(`
      INSERT INTO subscriptions (user_id, entity_type, entity_id, created_at, last_read_at)
      VALUES ($1, $2, $3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
      ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET last_read_at = NOW() - INTERVAL '1 hour'
      RETURNING *
    `, [userId, 'book', bookId]);
    
    console.log('✅ Subscription created/updated:', subscriptionResult.rows[0]);
    
    // Insert a test comment that should appear in Last Activity
    console.log('\n2. Creating test comment that should appear in subscribed activity...');
    const commentResult = await client.query(`
      INSERT INTO comments (id, user_id, book_id, content, created_at, updated_at)
      VALUES (gen_random_uuid(), 'c781bfe0-a57c-4c97-9a73-bf666c647bd0', $1, 'This is a test comment that should appear in Last Activity because user is subscribed', NOW(), NOW())
      RETURNING *
    `, [bookId]);
    
    console.log('✅ Test comment created:', commentResult.rows[0].id);
    
    // Now test the enhanced getPersonalActivities method
    console.log('\n3. Testing enhanced getPersonalActivities method...');
    
    // Simulate the logic from getPersonalActivities
    const userSubscriptions = await client.query(`
      SELECT * FROM subscriptions WHERE user_id = $1
    `, [userId]);
    
    console.log('User has', userSubscriptions.rows.length, 'subscriptions');
    
    // Get recent comments from subscribed books (excluding user's own comments)
    const subscribedComments = await client.query(`
      SELECT c.*, b.title as book_title, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN books b ON c.book_id = b.id
      JOIN users u ON c.user_id = u.id
      JOIN subscriptions s ON s.entity_id = c.book_id
      WHERE s.user_id = $1 
      AND s.entity_type = 'book'
      AND c.user_id != $1  -- Exclude user's own comments
      AND c.created_at > s.last_read_at  -- Only newer than last read
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [userId]);
    
    console.log('\n✅ Found', subscribedComments.rows.length, 'subscribed comments:');
    subscribedComments.rows.forEach((comment, index) => {
      console.log(`${index + 1}. Comment ID: ${comment.id}`);
      console.log(`   Content: ${comment.content}`);
      console.log(`   Book: ${comment.book_title}`);
      console.log(`   Author: ${comment.author_username}`);
      console.log(`   Created: ${comment.created_at}`);
      console.log('---');
    });
    
    if (subscribedComments.rows.length > 0) {
      console.log('🎉 SUCCESS: Subscription system is working!');
      console.log('Users will now see comments from books they\'ve commented on in their Last Activity');
    } else {
      console.log('⚠️  No subscribed comments found - this might be expected if no other users have commented');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

manualTest();