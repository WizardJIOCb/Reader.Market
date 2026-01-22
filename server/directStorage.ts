import { Client } from 'pg';

// Direct PostgreSQL implementation of getPersonalActivities
export async function getPersonalActivitiesDirect(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    const activities: any[] = [];
    
    // Get user info
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatarUrl || null;
    
    // Get user's comments with nested replies
    const userComments = await client.query(`
      SELECT c.*, b.title as book_title
      FROM comments c
      LEFT JOIN books b ON c.book_id = b.id
      WHERE c.user_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [userId, Math.ceil(limit / 4)]);
    
    for (const comment of userComments.rows) {
      // Get nested replies recursively
      const replies = await getCommentRepliesRecursive(client, comment.id, userId);
      const replyCount = await countAllReplies(client, comment.id);
      
      activities.push({
        id: comment.id,
        type: 'comment',
        entityId: comment.id,
        userId: comment.user_id,
        bookId: comment.book_id,
        metadata: {
          content: comment.content || '',
          content_preview: (comment.content || '').substring(0, 200),
          book_id: comment.book_id,
          book_title: comment.book_title || 'Unknown',
          author_name: user_name,
          author_avatar: user_avatar,
          replyCount: replyCount,
          replies: replies
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
          AND c.parent_comment_id IS NULL
          ORDER BY c.created_at DESC
          LIMIT 10
        `, [subscription.entity_id, userId]);
        
        for (const comment of recentComments.rows) {
          // Get nested replies recursively
          const replies = await getCommentRepliesRecursive(client, comment.id, userId);
          const replyCount = await countAllReplies(client, comment.id);
          
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
              content: comment.content || '',
              content_preview: (comment.content || '').substring(0, 200),
              book_id: comment.book_id,
              book_title: comment.book_title,
              author_name: comment.author_full_name || comment.author_username,
              author_avatar: comment.author_avatar,
              replyCount: replyCount,
              replies: replies,
              is_subscribed_activity: true
            },
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          });
        }
      }
    }
    
    // Get user's profile comment actions (both comments and replies)
    const profileCommentActions = await client.query(`
      SELECT ua.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar,
             target.username as target_username
      FROM user_actions ua
      LEFT JOIN users u ON ua.user_id = u.id
      LEFT JOIN users target ON ua.target_id = target.id
      WHERE ua.user_id = $1 
        AND (ua.action_type = 'profile_comment' OR ua.action_type = 'profile_comment_reply')
        AND ua.deleted_at IS NULL
      ORDER BY ua.created_at DESC
      LIMIT $2
    `, [userId, Math.ceil(limit / 4)]);
    
    for (const action of profileCommentActions.rows) {
      const authorName = action.author_full_name || action.author_username || 'Unknown';
      const authorAvatar = action.author_avatar || null;
      
      activities.push({
        id: action.id,
        type: 'user_action',
        action_type: action.action_type,
        entityId: action.id,
        userId: action.user_id,
        user: {
          id: userId,
          username: authorName,
          avatar_url: authorAvatar
        },
        target: {
          type: 'user',
          id: action.target_id,
          username: action.target_username || 'Unknown'
        },
        metadata: {
          ...action.metadata,
          author_name: authorName,
          author_avatar: authorAvatar,
          // Handle missing content by using comment_preview or creating from available data
          content: action.metadata?.content || action.metadata?.comment_preview || 'Content unavailable',
          content_preview: action.metadata?.content?.substring(0, 100) || 
                          action.metadata?.comment_preview || 
                          (action.metadata?.content ? action.metadata.content.substring(0, 100) : 'Content unavailable'),
          comment_preview: action.metadata?.comment_preview || 
                          (action.metadata?.content ? action.metadata.content.substring(0, 100) : 'Content unavailable'),
          is_reply: action.action_type === 'profile_comment_reply'
        },
        createdAt: action.created_at,
        timestamp: action.created_at
      });
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

// Helper function to recursively get comment replies
async function getCommentRepliesRecursive(client: any, commentId: string, currentUserId?: string): Promise<any[]> {
  try {
    // Get direct replies to this comment
    const replies = await client.query(`
      SELECT c.*, u.username, u.full_name, u.avatar_url
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      ORDER BY c.created_at ASC
    `, [commentId]);
    
    const repliesWithData = await Promise.all(replies.rows.map(async (reply: any) => {
      // Get nested replies recursively
      const nestedReplies = await getCommentRepliesRecursive(client, reply.id, currentUserId);
      const replyCount = await countAllReplies(client, reply.id);
      
      // Get parent comment author name
      let parentCommentAuthor = null;
      if (reply.parent_comment_id) {
        const parentComment = await client.query(`
          SELECT u.username, u.full_name
          FROM comments c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.id = $1
          LIMIT 1
        `, [reply.parent_comment_id]);
        
        if (parentComment.rows[0]) {
          parentCommentAuthor = parentComment.rows[0].full_name || parentComment.rows[0].username;
        }
      }
      
      // Structure reply with proper metadata for frontend consumption
      return {
        id: reply.id,
        userId: reply.user_id,
        bookId: reply.book_id,
        parentCommentId: reply.parent_comment_id,
        createdAt: reply.created_at,
        updatedAt: reply.updated_at,
        metadata: {
          content: reply.content || '',
          content_preview: (reply.content || '').substring(0, 200),
          author_name: reply.full_name || reply.username || 'Anonymous',
          username: reply.username,
          author_avatar: reply.avatar_url || null,
          quotedText: reply.quoted_text,
          parentCommentAuthor: parentCommentAuthor,
          replyCount: replyCount,
          replies: nestedReplies,
          reactions: []
        }
      };
    }));
    
    return repliesWithData;
  } catch (error) {
    console.error("Error getting comment replies:", error);
    return [];
  }
}

// Helper function to count all replies (including nested ones)
async function countAllReplies(client: any, commentId: string): Promise<number> {
  try {
    // Get direct replies
    const directReplies = await client.query(
      'SELECT id FROM comments WHERE parent_comment_id = $1', 
      [commentId]
    );
    
    let total = directReplies.rows.length;
    
    // Recursively count nested replies
    for (const reply of directReplies.rows) {
      total += await countAllReplies(client, reply.id);
    }
    
    return total;
  } catch (error) {
    console.error("Error counting replies:", error);
    return 0;
  }
}