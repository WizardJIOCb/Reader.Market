const { Client } = require('pg');

async function simulateFrontendApiCall() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Simulating Frontend API Call ===\n');
    
    // This simulates exactly what happens in the API endpoint when frontend calls /api/profile/WizardJIOCb/activities
    const targetUserId = 'WizardJIOCb'; // Username from URL
    const limit = 50;
    const offset = 0;
    
    console.log(`Testing with targetUserId: ${targetUserId}`);
    
    // Step 1: Resolve username to user ID (same as in API endpoint)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(targetUserId);
    
    let profileId;
    if (isUuid) {
      profileId = targetUserId;
      console.log('Target is UUID, using directly');
    } else {
      // Try to find by username
      const userResult = await client.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [targetUserId]);
      if (userResult.rows.length === 0) {
        console.log('❌ User not found by username');
        return;
      }
      profileId = userResult.rows[0].id;
      console.log(`Resolved username "${targetUserId}" to user ID: ${profileId}`);
    }
    
    // Step 2: Call getPersonalActivities (same as in API endpoint)
    console.log('\nCalling getPersonalActivities...');
    
    // Simulate the storage.getPersonalActivities method call
    const activities = [];
    
    // Get user info
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [profileId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatarUrl || null;
    
    console.log(`User resolved: ${user_name} (${profileId})`);
    
    // Get user's comments (existing logic)
    const userComments = await client.query(`
      SELECT * FROM comments 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [profileId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${userComments.rows.length} user comments`);
    
    // Get parent comments user replied to
    const userReplies = await client.query(`
      SELECT parent_comment_id 
      FROM comments 
      WHERE user_id = $1 AND parent_comment_id IS NOT NULL
    `, [profileId]);
    
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
    
    // Combine user's comments and parent comments
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
          replyCount: 0
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      });
    }
    
    // NEW: Get activities from subscribed threads (enhanced logic)
    console.log('\nGetting subscribed thread activities...');
    const userSubscriptions = await client.query('SELECT * FROM subscriptions WHERE user_id = $1', [profileId]);
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
          AND c.user_id != $2
          AND c.created_at > $3
          ORDER BY c.created_at DESC
          LIMIT 5
        `, [subscription.entity_id, profileId, subscription.last_read_at]);
        
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
    
    console.log(`\n=== FINAL API RESPONSE ===`);
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
    
    console.log('\nAll activities:');
    activities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.type} - ${activity.metadata.author_name}: "${activity.metadata.content_preview}"`);
      console.log(`   Created: ${activity.createdAt}`);
      if (activity.type === 'subscribed_comment') {
        console.log(`   ✅ SUBSCRIBED COMMENT - should appear in Last Activity`);
        console.log(`   From book: ${activity.metadata.book_title}`);
      }
      console.log('');
    });
    
    // Check if we found the expected subscribed comments
    const subscribedActivities = activities.filter(a => a.type === 'subscribed_comment');
    console.log(`\n✅ Found ${subscribedActivities.length} subscribed comment activities`);
    
    if (subscribedActivities.length > 0) {
      console.log('🎉 SUCCESS: API should be returning subscribed comments!');
      console.log('If they are not appearing in frontend, possible issues:');
      console.log('  1. Frontend rendering logic not handling subscribed_comment type');
      console.log('  2. Browser caching issue');
      console.log('  3. Component not re-rendering properly');
    } else {
      console.log('❌ FAILURE: No subscribed activities found in API response');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

simulateFrontendApiCall();