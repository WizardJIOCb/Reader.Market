const { Client } = require('pg');

async function testApiEndpoint() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Testing API Endpoint Logic ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // WizardJIOCb
    const limit = 50;
    
    // Simulate the EXACT logic from getPersonalActivities method
    console.log('Simulating getPersonalActivities method...\n');
    
    const activities = [];
    
    // Get user info (same as in the method)
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatarUrl || null;
    
    console.log('User info retrieved:', user_name);
    
    // Get user's comments (existing logic)
    console.log('\n1. Getting user\'s own comments...');
    const userComments = await client.query(`
      SELECT * FROM comments 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [userId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${userComments.rows.length} user comments`);
    
    // Get parent comments user replied to (existing logic)
    const userReplies = await client.query(`
      SELECT parent_comment_id 
      FROM comments 
      WHERE user_id = $1 AND parent_comment_id IS NOT NULL
    `, [userId]);
    
    const parentCommentIds = userReplies.rows.map(reply => reply.parent_comment_id).filter(Boolean);
    console.log(`User replied to ${parentCommentIds.length} parent comments`);
    
    let repliedParentComments = [];
    if (parentCommentIds.length > 0) {
      repliedParentComments = await client.query(`
        SELECT * FROM comments 
        WHERE id = ANY($1) 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [parentCommentIds, Math.ceil(limit / 4)]);
      console.log(`Found ${repliedParentComments.rows.length} parent comments`);
    }
    
    // Combine user's comments and parent comments (existing logic)
    const allCommentsToShow = [...userComments.rows, ...repliedParentComments.rows];
    console.log(`Total comments to show: ${allCommentsToShow.length}`);
    
    // Add to activities array (existing logic)
    for (const comment of allCommentsToShow) {
      let book_title = 'Unknown';
      if (comment.book_id) {
        const bookData = await client.query('SELECT title FROM books WHERE id = $1 LIMIT 1', [comment.book_id]);
        book_title = bookData.rows[0] ? bookData.rows[0].title : 'Unknown';
      }
      
      activities.push({
        id: comment.id,
        type: 'comment',
        entityId: comment.id,
        userId: comment.user_id,
        bookId: comment.book_id,
        metadata: {
          content: comment.content,
          content_preview: comment.content.substring(0, 200),
          book_id: comment.book_id,
          book_title: book_title,
          author_name: user_name,
          author_avatar: user_avatar,
          replyCount: 0 // Simplified for test
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      });
    }
    
    // NEW: Get activities from subscribed threads (the enhanced logic)
    console.log('\n2. Getting subscribed thread activities...');
    const userSubscriptions = await client.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    console.log(`User has ${userSubscriptions.rows.length} subscriptions`);
    
    // Process each subscription
    for (const subscription of userSubscriptions.rows) {
      if (subscription.entity_type === 'book') {
        console.log(`Processing book subscription: ${subscription.entity_id}`);
        
        // Get recent comments on this subscribed book (excluding user's own comments)
        const recentComments = await client.query(`
          SELECT c.*, b.title as book_title, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
          FROM comments c
          JOIN books b ON c.book_id = b.id
          JOIN users u ON c.user_id = u.id
          WHERE c.book_id = $1
          AND c.user_id != $2  -- Exclude user's own comments
          AND c.created_at > $3  -- Only newer than last read
          ORDER BY c.created_at DESC
          LIMIT 5
        `, [subscription.entity_id, userId, subscription.last_read_at]);
        
        console.log(`Found ${recentComments.rows.length} recent comments from subscription`);
        
        for (const comment of recentComments.rows) {
          // Count comment replies
          const replyCountResult = await client.query('SELECT COUNT(*) as count FROM comments WHERE parent_comment_id = $1', [comment.id]);
          const replyCount = parseInt(replyCountResult.rows[0].count);
          
          activities.push({
            id: comment.id,
            type: 'subscribed_comment',
            entityId: comment.id,
            userId: comment.user_id,
            bookId: comment.book_id,
            subscriptionInfo: {
              subscribedEntityType: subscription.entity_type,
              subscribedEntityId: subscription.entity_id,
              subscriptionCreatedAt: subscription.created_at,
              lastReadAt: subscription.last_read_at
            },
            metadata: {
              content: comment.content,
              content_preview: comment.content.substring(0, 200),
              book_id: comment.book_id,
              book_title: comment.book_title,
              author_name: comment.author_full_name || comment.author_username,
              author_avatar: comment.author_avatar,
              replyCount: replyCount,
              is_subscribed_activity: true
            },
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          });
        }
      }
    }
    
    // Sort by creation date (same as in the method)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total activities found: ${activities.length}`);
    console.log('\nActivities breakdown:');
    
    const typeCounts = {};
    activities.forEach(activity => {
      const type = activity.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nRecent activities (last 5):');
    activities.slice(0, 5).forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.type} - ${activity.metadata.author_name}: "${activity.metadata.content_preview}"`);
      console.log(`   Created: ${activity.createdAt}`);
      if (activity.subscriptionInfo) {
        console.log(`   From subscription to: ${activity.subscriptionInfo.subscribedEntityId}`);
      }
      console.log('');
    });
    
    // Check if we found the expected subscribed comments
    const subscribedActivities = activities.filter(a => a.type === 'subscribed_comment');
    console.log(`\n✅ Found ${subscribedActivities.length} subscribed comment activities`);
    
    if (subscribedActivities.length > 0) {
      console.log('🎉 SUCCESS: The backend logic is working correctly!');
      console.log('The issue is likely in the frontend or API call');
    } else {
      console.log('❌ FAILURE: No subscribed activities found');
      console.log('The backend enhancement is not working properly');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testApiEndpoint();