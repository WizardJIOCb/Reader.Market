const { Client } = require('pg');

async function debugActualApiEndpoint() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('=== Debugging Actual API Endpoint ===\n');
    
    // Test the exact scenario - WizardJIOCb profile
    const profileUsername = 'WizardJIOCb';
    console.log(`Testing API endpoint for profile: ${profileUsername}`);
    
    // Step 1: Resolve username to user ID (exactly as API does)
    console.log('\n1. Resolving username to user ID...');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(profileUsername);
    
    let profileId;
    if (isUuid) {
      profileId = profileUsername;
      console.log('Username is UUID');
    } else {
      const userResult = await client.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [profileUsername]);
      if (userResult.rows.length === 0) {
        console.log('❌ User not found!');
        return;
      }
      profileId = userResult.rows[0].id;
      console.log(`✅ Resolved "${profileUsername}" to user ID: ${profileId}`);
    }
    
    // Step 2: Test getPersonalActivities directly (this is what the API calls)
    console.log('\n2. Calling getPersonalActivities...');
    const limit = 50;
    const offset = 0;
    
    // This is the EXACT logic from storage.getPersonalActivities
    const activities = [];
    
    // Get user info
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [profileId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatarUrl || null;
    
    console.log(`User name: ${user_name}`);
    
    // Get user's own news articles (this might be the issue - maybe this query returns nothing?)
    console.log('\n3. Getting user news articles...');
    const userNews = await client.query(`
      SELECT * FROM news 
      WHERE author_id = $1 AND published = true
      ORDER BY published_at DESC 
      LIMIT $2
    `, [profileId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${userNews.rows.length} news articles`);
    
    // Get user's comments
    console.log('\n4. Getting user comments...');
    const userComments = await client.query(`
      SELECT * FROM comments 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [profileId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${userComments.rows.length} comments`);
    
    // Get user's reviews
    console.log('\n5. Getting user reviews...');
    const userReviews = await client.query(`
      SELECT * FROM reviews 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [profileId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${userReviews.rows.length} reviews`);
    
    // Get parent comments user replied to
    console.log('\n6. Getting parent comments user replied to...');
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
    
    // Get profile comment actions
    console.log('\n7. Getting profile comment actions...');
    const profileCommentActions = await client.query(`
      SELECT * FROM user_actions 
      WHERE user_id = $1 AND action_type = 'profile_comment' AND deleted_at IS NULL
      ORDER BY created_at DESC 
      LIMIT $2
    `, [profileId, Math.ceil(limit / 4)]);
    
    console.log(`Found ${profileCommentActions.rows.length} profile comment actions`);
    
    // NEW: Get subscribed thread activities
    console.log('\n8. Getting subscribed thread activities...');
    const userSubscriptions = await client.query('SELECT * FROM subscriptions WHERE user_id = $1', [profileId]);
    console.log(`User has ${userSubscriptions.rows.length} subscriptions`);
    
    let subscribedActivities = [];
    for (const subscription of userSubscriptions.rows) {
      if (subscription.entity_type === 'book') {
        console.log(`Processing book subscription: ${subscription.entity_id}`);
        
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
        subscribedActivities = subscribedActivities.concat(recentComments.rows);
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`User news: ${userNews.rows.length}`);
    console.log(`User comments: ${userComments.rows.length}`);
    console.log(`User reviews: ${userReviews.rows.length}`);
    console.log(`Parent comments: ${repliedParentComments.rows.length}`);
    console.log(`Profile comments: ${profileCommentActions.rows.length}`);
    console.log(`Subscribed comments: ${subscribedActivities.length}`);
    
    const totalActivities = userNews.rows.length + userComments.rows.length + userReviews.rows.length + 
                          repliedParentComments.rows.length + profileCommentActions.rows.length + subscribedActivities.length;
    
    console.log(`\nTotal activities that should be returned: ${totalActivities}`);
    
    if (totalActivities === 0) {
      console.log('❌ NO ACTIVITIES FOUND - This explains the "No recent activity" message');
      console.log('\nPossible causes:');
      console.log('1. User has no content at all');
      console.log('2. Query limits are too restrictive');
      console.log('3. Data filtering is removing all results');
      console.log('4. Database connection or permissions issue');
    } else {
      console.log('✅ Activities found - API should work');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

debugActualApiEndpoint();