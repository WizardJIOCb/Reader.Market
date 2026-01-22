const { Client } = require('pg');

async function debugBookCommentSubscription() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Debugging Book Comment Subscription ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // WizardJIOCb
    const bookId = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'; // The book
    
    // 1. Check if user has subscription to this book
    console.log('1. Checking user subscriptions...');
    const subscriptions = await client.query(`
      SELECT * FROM subscriptions 
      WHERE user_id = $1 AND entity_type = 'book' AND entity_id = $2
    `, [userId, bookId]);
    
    if (subscriptions.rows.length === 0) {
      console.log('❌ NO SUBSCRIPTION FOUND');
      console.log('This means automatic subscription failed when commenting');
    } else {
      const subscription = subscriptions.rows[0];
      console.log('✅ Subscription found:');
      console.log(`   Created: ${subscription.created_at}`);
      console.log(`   Last read: ${subscription.last_read_at}`);
    }
    console.log('');
    
    // 2. Check user's comments on this book
    console.log('2. Checking user\'s comments on this book...');
    const userComments = await client.query(`
      SELECT id, content, created_at 
      FROM comments 
      WHERE user_id = $1 AND book_id = $2 
      ORDER BY created_at DESC
    `, [userId, bookId]);
    
    console.log(`Found ${userComments.rows.length} comments:`);
    userComments.rows.forEach((comment, index) => {
      console.log(`   ${index + 1}. "${comment.content}" (${comment.created_at})`);
    });
    console.log('');
    
    // 3. Check if subscription creation logic is working
    console.log('3. Testing subscription creation logic...');
    
    // Simulate what should happen when user comments
    if (userComments.rows.length > 0 && subscriptions.rows.length === 0) {
      console.log('❌ ISSUE DETECTED: User has comments but no subscription');
      console.log('The automatic subscription creation is not working');
      
      // Let's manually create the subscription to test
      console.log('\n4. Creating subscription manually...');
      const manualSubscription = await client.query(`
        INSERT INTO subscriptions (user_id, entity_type, entity_id, last_read_at, created_at)
        VALUES ($1, 'book', $2, NOW(), NOW())
        ON CONFLICT (user_id, entity_type, entity_id) 
        DO UPDATE SET last_read_at = NOW()
        RETURNING *
      `, [userId, bookId]);
      
      console.log('✅ Manual subscription created:');
      console.log(`   Created: ${manualSubscription.rows[0].created_at}`);
      console.log(`   Last read: ${manualSubscription.rows[0].last_read_at}`);
    } else if (userComments.rows.length > 0) {
      console.log('✅ User has both comments and subscription - should work');
    } else {
      console.log('ℹ️  User has no comments on this book yet');
    }
    
    console.log('\n=== Debug Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

debugBookCommentSubscription();