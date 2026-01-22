const { Client } = require('pg');

async function diagnoseSubscriptionIssue() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Diagnosing Last Activity Subscription Issue ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // WizardJIOCb
    const bookId = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'; // The book "Aga"
    
    // 1. Check if user has subscription to this book
    console.log('1. Checking user subscriptions...');
    const subscriptions = await client.query(`
      SELECT * FROM subscriptions 
      WHERE user_id = $1 AND entity_type = 'book' AND entity_id = $2
    `, [userId, bookId]);
    
    if (subscriptions.rows.length === 0) {
      console.log('❌ NO SUBSCRIPTION FOUND for this book');
      console.log('This means the automatic subscription didn\'t work when you commented');
      return;
    }
    
    const subscription = subscriptions.rows[0];
    console.log('✅ Subscription found:');
    console.log(`   Created: ${subscription.created_at}`);
    console.log(`   Last read: ${subscription.last_read_at}`);
    console.log('');
    
    // 2. Check user's comments on this book (should trigger subscription)
    console.log('2. Checking user\'s comments on this book...');
    const userComments = await client.query(`
      SELECT id, content, created_at 
      FROM comments 
      WHERE user_id = $1 AND book_id = $2 
      ORDER BY created_at DESC
    `, [userId, bookId]);
    
    console.log(`✅ Found ${userComments.rows.length} comments by user:`);
    userComments.rows.forEach((comment, index) => {
      console.log(`   ${index + 1}. "${comment.content}" (${comment.created_at})`);
    });
    console.log('');
    
    // 3. Check all comments on this book (including others')
    console.log('3. Checking ALL comments on this book...');
    const allComments = await client.query(`
      SELECT c.id, c.content, c.created_at, c.user_id, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.book_id = $1
      ORDER BY c.created_at DESC
    `, [bookId]);
    
    console.log(`✅ Found ${allComments.rows.length} total comments:`);
    allComments.rows.forEach((comment, index) => {
      const isUserComment = comment.user_id === userId ? '(YOUR COMMENT)' : '';
      console.log(`   ${index + 1}. ${comment.username}: "${comment.content}" ${isUserComment}(${comment.created_at})`);
    });
    console.log('');
    
    // 4. Test the subscription query logic (what getPersonalActivities would run)
    console.log('4. Testing subscription-based comment query...');
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
    
    console.log(`✅ Found ${subscribedComments.rows.length} subscribed comments (others\' comments newer than last read):`);
    if (subscribedComments.rows.length === 0) {
      console.log('❌ NO subscribed comments found - this explains why nothing appears in Last Activity');
      console.log('Possible reasons:');
      console.log('  - No other users have commented on this book');
      console.log('  - Other comments are older than subscription.last_read_at');
      console.log('  - The last_read_at timestamp is too recent');
    } else {
      subscribedComments.rows.forEach((comment, index) => {
        console.log(`   ${index + 1}. ${comment.author_username}: "${comment.content}" (${comment.created_at})`);
        console.log(`      Book: ${comment.book_title}`);
      });
    }
    console.log('');
    
    // 5. Check the subscription's last_read_at timestamp
    console.log('5. Analyzing timestamps...');
    const lastRead = new Date(subscription.last_read_at);
    console.log(`Subscription last_read_at: ${lastRead.toISOString()}`);
    
    // Find the newest comment that's NOT from the user
    const newestOtherComment = await client.query(`
      SELECT created_at 
      FROM comments 
      WHERE book_id = $1 AND user_id != $2 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [bookId, userId]);
    
    if (newestOtherComment.rows.length > 0) {
      const newestCommentTime = new Date(newestOtherComment.rows[0].created_at);
      console.log(`Newest other user comment: ${newestCommentTime.toISOString()}`);
      
      if (newestCommentTime > lastRead) {
        console.log('✅ Newest comment is newer than last_read - SHOULD appear in Last Activity');
      } else {
        console.log('❌ Newest comment is older than last_read - will NOT appear in Last Activity');
        console.log('This suggests the subscription.last_read_at was updated too recently');
      }
    } else {
      console.log('ℹ️  No other users have commented on this book yet');
    }
    
    console.log('\n=== Diagnosis Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

diagnoseSubscriptionIssue();