const { Client } = require('pg');

// Direct PostgreSQL implementation of getPersonalActivities
async function getPersonalActivitiesDirect(userId, limit = 50, offset = 0) {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    const activities = [];
    
    // Get user info
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatarUrl || null;
    
    // Get user's comments
    const userComments = await client.query(`
      SELECT c.*, b.title as book_title
      FROM comments c
      LEFT JOIN books b ON c.book_id = b.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [userId, Math.ceil(limit / 4)]);
    
    for (const comment of userComments.rows) {
      // Count replies
      const replyCountResult = await client.query('SELECT COUNT(*) as count FROM comments WHERE parent_comment_id = $1', [comment.id]);
      const replyCount = parseInt(replyCountResult.rows[0].count);
      
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
          book_title: comment.book_title || 'Unknown',
          author_name: user_name,
          author_avatar: user_avatar,
          replyCount: replyCount
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      });
    }
    
    // Get subscribed thread activities
    const subscriptions = await client.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    
    for (const subscription of subscriptions.rows) {
      if (subscription.entity_type === 'book') {
        // Get recent comments on subscribed books (excluding user's own)
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
        `, [subscription.entity_id, userId, subscription.last_read_at]);
        
        for (const comment of recentComments.rows) {
          // Count replies
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
    
    // Sort by creation date (newest first)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Apply pagination
    return activities.slice(offset, offset + limit);
    
  } catch (error) {
    console.error('Error in getPersonalActivitiesDirect:', error);
    return [];
  } finally {
    await client.end();
  }
}

module.exports = { getPersonalActivitiesDirect };