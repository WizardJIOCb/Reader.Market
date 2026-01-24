import { Client } from 'pg';

// Direct PostgreSQL implementation of getProfileActivities
export async function getProfileActivitiesDirect(profileId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    const activities: any[] = [];
    
    // Get user info
    const userInfo = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [profileId]);
    const userData = userInfo.rows[0];
    const user_name = userData ? (userData.fullName || userData.username) : 'Unknown';
    const user_avatar = userData?.avatar_url || null;
    
    // Get user's comments (not profile comments made ON their profile)
    const userComments = await client.query(`
      SELECT c.*, b.title as book_title
      FROM comments c
      LEFT JOIN books b ON c.book_id = b.id
      WHERE c.user_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [profileId, Math.ceil(limit / 2)]);
    
    for (const comment of userComments.rows) {
      // Get nested replies recursively
      const replies = await getCommentRepliesRecursive(client, comment.id, profileId);
      const replyCount = await countAllReplies(client, comment.id);
      
      // Get reading progress for this user and book
      let readingProgress = null;
      if (comment.book_id) {
        try {
          const progressResult = await client.query(
            'SELECT current_page, total_pages, percentage, chapter_index, last_read_at FROM reading_progress WHERE user_id = $1 AND book_id = $2 LIMIT 1',
            [profileId, comment.book_id]
          );
          
          if (progressResult.rows[0]) {
            const progress = progressResult.rows[0];
            // Only include progress if user has actually read something (percentage > 0)
            if (progress.percentage > 0) {
              readingProgress = {
                currentPage: progress.current_page,
                totalPages: progress.total_pages,
                percentage: parseFloat(progress.percentage),
                chapterIndex: progress.chapter_index,
                lastReadAt: progress.last_read_at
              };
            }
          }
        } catch (error) {
          console.error('Error fetching reading progress for comment:', error);
        }
      }
      
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
          replies: replies,
          readingProgress: readingProgress
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      });
    }
    
    // Get user's reviews
    const userReviews = await client.query(`
      SELECT r.*, b.title as book_title, b.cover_image_url
      FROM reviews r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2
    `, [profileId, Math.ceil(limit / 2)]);
    
    for (const review of userReviews.rows) {
      // Get reading progress for this user and book
      let readingProgress = null;
      if (review.book_id) {
        try {
          const progressResult = await client.query(
            'SELECT current_page, total_pages, percentage, chapter_index, last_read_at FROM reading_progress WHERE user_id = $1 AND book_id = $2 LIMIT 1',
            [profileId, review.book_id]
          );
          
          if (progressResult.rows[0]) {
            const progress = progressResult.rows[0];
            // Only include progress if user has actually read something (percentage > 0)
            if (progress.percentage > 0) {
              readingProgress = {
                currentPage: progress.current_page,
                totalPages: progress.total_pages,
                percentage: parseFloat(progress.percentage),
                chapterIndex: progress.chapter_index,
                lastReadAt: progress.last_read_at
              };
            }
          }
        } catch (error) {
          console.error('Error fetching reading progress for review:', error);
        }
      }
      
      activities.push({
        id: review.id,
        type: 'review',
        entityId: review.id,
        userId: review.user_id,
        bookId: review.book_id,
        metadata: {
          content: review.content || '',
          content_preview: (review.content || '').substring(0, 200),
          rating: review.rating,
          book_id: review.book_id,
          book_title: review.book_title || 'Unknown',
          book_cover: review.cover_image_url || null,
          author_name: user_name,
          author_avatar: user_avatar,
          readingProgress: readingProgress
        },
        createdAt: review.created_at,
        updatedAt: review.updated_at
      });
    }
    
    // Sort by creation date (newest first)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Apply pagination
    return activities.slice(offset, offset + limit);
    
  } catch (error) {
    console.error('Error in getProfileActivitiesDirect:', error);
    return [];
  } finally {
    await client.end();
  }
}

// Direct PostgreSQL implementation of getProfileComments
export async function getProfileCommentsDirect(profileId: string, options: {limit: number, offset: number, currentUserId?: string}): Promise<{comments: any[], total: number}> {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    // Get total count of root comments only (no parent)
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM profile_comments WHERE profile_id = $1 AND parent_comment_id IS NULL',
      [profileId]
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get root comments with user info and ratings
    const rootComments = await client.query(`
      SELECT 
        pc.id,
        pc.user_id,
        pc.profile_id,
        pc.content,
        pc.attachment_metadata,
        pc.linked_rating_id,
        pc.parent_comment_id,
        pc.quoted_text,
        pc.created_at,
        pc.updated_at,
        u.username,
        u.full_name,
        u.avatar_url,
        pr.rating
      FROM profile_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      LEFT JOIN profile_ratings pr ON pc.linked_rating_id = pr.id
      WHERE pc.profile_id = $1 AND pc.parent_comment_id IS NULL
      ORDER BY pc.created_at DESC
      LIMIT $2 OFFSET $3
    `, [profileId, options.limit, options.offset]);
    
    // Process comments and add reactions, reply counts, and reading progress
    const commentsWithReactions = await Promise.all(rootComments.rows.map(async (comment) => {
      // Get reactions for this comment
      const reactions = await getProfileCommentReactions(client, comment.id, options.currentUserId);
      
      // Count all descendants (replies to this comment and their replies)
      const replyCount = await countProfileCommentReplies(client, comment.id);
      
      // For profile comments, reading progress is not applicable since they're not tied to specific books
      // Reading progress is only relevant for book comments/reviews
      const readingProgress = null;
      
      return {
        id: comment.id,
        userId: comment.user_id,
        profileId: comment.profile_id,
        content: comment.content,
        attachmentMetadata: comment.attachment_metadata,
        linkedRatingId: comment.linked_rating_id,
        parentCommentId: comment.parent_comment_id,
        quotedText: comment.quoted_text,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        username: comment.username,
        fullName: comment.full_name,
        avatarUrl: comment.avatar_url,
        rating: comment.rating,
        isOwnComment: options.currentUserId ? comment.user_id === options.currentUserId : false,
        reactions,
        replyCount,
        metadata: {
          readingProgress: readingProgress
        }
      };
    }));
    
    return {
      comments: commentsWithReactions,
      total
    };
    
  } catch (error) {
    console.error('Error in getProfileCommentsDirect:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Helper function to count profile comment replies recursively
async function countProfileCommentReplies(client: any, commentId: string): Promise<number> {
  const directReplies = await client.query(
    'SELECT id FROM profile_comments WHERE parent_comment_id = $1',
    [commentId]
  );
  
  let total = directReplies.rows.length;
  
  for (const reply of directReplies.rows) {
    total += await countProfileCommentReplies(client, reply.id);
  }
  
  return total;
}

// Helper function to get profile comment reactions
async function getProfileCommentReactions(client: any, commentId: string, currentUserId?: string): Promise<any[]> {
  const reactionsResult = await client.query(
    `SELECT 
      r.emoji,
      COUNT(*) as count,
      MAX(CASE WHEN r.user_id = $2 THEN 1 ELSE 0 END) as user_reacted
    FROM reactions r
    WHERE r.profile_comment_id = $1
    GROUP BY r.emoji
    ORDER BY COUNT(*) DESC`,
    [commentId, currentUserId || '']
  );
  
  return reactionsResult.rows.map((row: any) => ({
    emoji: row.emoji,
    count: parseInt(row.count),
    userReacted: row.user_reacted === 1
  }));
}

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
      
      // Get reactions for this reply
      const reactions = await getCommentReactions(client, reply.id, currentUserId);
      
      return {
        id: reply.id,
        userId: reply.user_id,
        content: reply.content,
        createdAt: reply.created_at,
        username: reply.username,
        fullName: reply.full_name,
        avatarUrl: reply.avatar_url,
        parentCommentId: reply.parent_comment_id,
        quotedText: reply.quoted_text,
        parentCommentAuthor: parentCommentAuthor,
        reactions: reactions,
        replyCount: replyCount,
        replies: nestedReplies
      };
    }));
    
    return repliesWithData;
  } catch (error) {
    console.error('Error getting comment replies:', error);
    return [];
  }
}

// Helper function to count all replies recursively
async function countAllReplies(client: any, commentId: string): Promise<number> {
  try {
    const directReplies = await client.query(
      'SELECT id FROM comments WHERE parent_comment_id = $1',
      [commentId]
    );
    
    let total = directReplies.rows.length;
    
    for (const reply of directReplies.rows) {
      total += await countAllReplies(client, reply.id);
    }
    
    return total;
  } catch (error) {
    console.error('Error counting replies:', error);
    return 0;
  }
}

// Helper function to get comment reactions
async function getCommentReactions(client: any, commentId: string, currentUserId?: string): Promise<any[]> {
  try {
    const reactionsResult = await client.query(
      `SELECT 
        r.emoji,
        COUNT(*) as count,
        MAX(CASE WHEN r.user_id = $2 THEN 1 ELSE 0 END) as user_reacted
      FROM reactions r
      WHERE r.comment_id = $1
      GROUP BY r.emoji
      ORDER BY COUNT(*) DESC`,
      [commentId, currentUserId || '']
    );
    
    return reactionsResult.rows.map((row: any) => ({
      emoji: row.emoji,
      count: parseInt(row.count),
      userReacted: row.user_reacted === 1
    }));
  } catch (error) {
    console.error('Error getting comment reactions:', error);
    return [];
  }
}
