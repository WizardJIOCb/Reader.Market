const { Client } = require('pg');

async function checkOtherUserComments() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Checking Other User Comments ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // WizardJIOCb
    const bookId = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'; // The book
    
    // Get the subscription to check last_read timestamp
    const subscriptionResult = await client.query(`
      SELECT last_read_at FROM subscriptions 
      WHERE user_id = $1 AND entity_type = 'book' AND entity_id = $2
    `, [userId, bookId]);
    
    const lastRead = subscriptionResult.rows[0]?.last_read_at;
    console.log(`Subscription last_read_at: ${lastRead}`);
    console.log('');
    
    // Check all comments on this book (including others')
    console.log('All comments on this book:');
    const allComments = await client.query(`
      SELECT c.id, c.content, c.created_at, c.user_id, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.book_id = $1
      ORDER BY c.created_at DESC
    `, [bookId]);
    
    allComments.rows.forEach((comment, index) => {
      const isUserComment = comment.user_id === userId ? '(YOUR COMMENT)' : '';
      const isNewerThanRead = new Date(comment.created_at) > new Date(lastRead) ? 'NEW' : '';
      console.log(`   ${index + 1}. ${comment.username}: "${comment.content}" ${isUserComment} ${isNewerThanRead}(${comment.created_at})`);
    });
    console.log('');
    
    // Test the exact query that getPersonalActivities uses
    console.log('Testing subscribed comment query (what should appear in Last Activity):');
    const subscribedComments = await client.query(`
      SELECT 
        c.id, 
        c.content, 
        c.created_at, 
        c.user_id, 
        u.username as author_username,
        b.title as book_title
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
    
    console.log(`Found ${subscribedComments.rows.length} subscribed comments:`);
    if (subscribedComments.rows.length === 0) {
      console.log('❌ NO subscribed comments found');
      console.log('This explains why nothing appears in Last Activity');
    } else {
      subscribedComments.rows.forEach((comment, index) => {
        console.log(`   ${index + 1}. ${comment.author_username}: "${comment.content}" (${comment.created_at})`);
        console.log(`      Book: ${comment.book_title}`);
      });
    }
    
    console.log('\n=== Analysis ===');
    if (subscribedComments.rows.length === 0) {
      console.log('Possible issues:');
      console.log('1. No other users have commented on this book recently');
      console.log('2. Other comments are older than subscription.last_read_at');
      console.log('3. The last_read_at timestamp is too recent');
    } else {
      console.log('✅ Found subscribed comments - should appear in Last Activity');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkOtherUserComments();