// Test script to check profile comment reply metadata storage and retrieval
const { Client } = require('pg');

async function testProfileCommentMetadata() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    // Check the latest user actions for profile comments
    const recentActions = await client.query(`
      SELECT ua.*, u.username as author_username, u.full_name as author_full_name
      FROM user_actions ua
      LEFT JOIN users u ON ua.user_id = u.id
      WHERE ua.action_type IN ('profile_comment', 'profile_comment_reply')
      ORDER BY ua.created_at DESC
      LIMIT 5
    `);
    
    console.log('=== Recent Profile Comment Actions ===');
    for (const action of recentActions.rows) {
      console.log(`Action ID: ${action.id}`);
      console.log(`Action Type: ${action.action_type}`);
      console.log(`User ID: ${action.user_id}`);
      console.log(`Target ID: ${action.target_id}`);
      console.log(`Author Name: ${action.author_full_name || action.author_username || 'Unknown'}`);
      console.log(`Created At: ${action.created_at}`);
      console.log(`Metadata Keys:`, Object.keys(action.metadata || {}));
      console.log(`Metadata Content:`, action.metadata?.content);
      console.log(`Metadata Comment Preview:`, action.metadata?.comment_preview);
      console.log(`Metadata Author Name:`, action.metadata?.author_name);
      console.log('---');
    }
    
    // Also check the actual profile comments table
    console.log('\n=== Recent Profile Comments ===');
    const recentComments = await client.query(`
      SELECT pc.*, u.username, u.full_name
      FROM profile_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      ORDER BY pc.created_at DESC
      LIMIT 5
    `);
    
    for (const comment of recentComments.rows) {
      console.log(`Comment ID: ${comment.id}`);
      console.log(`User: ${comment.full_name || comment.username}`);
      console.log(`Content: ${comment.content.substring(0, 50)}...`);
      console.log(`Parent Comment ID: ${comment.parent_comment_id}`);
      console.log(`Created At: ${comment.created_at}`);
      console.log('---');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await client.end();
  }
}

testProfileCommentMetadata();