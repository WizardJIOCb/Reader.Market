const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConversations() {
  console.log('\n=== Testing Conversations Backend ===\n');
  
  try {
    // Get all users
    const usersResult = await pool.query('SELECT id, username FROM users LIMIT 5');
    console.log('Available users:');
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.username} (${user.id})`);
    });
    
    // Get all conversations
    const conversationsResult = await pool.query(`
      SELECT 
        c.id, 
        c.user1_id, 
        c.user2_id,
        u1.username as user1_name,
        u2.username as user2_name,
        c.created_at,
        c.last_message_id
      FROM conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    console.log(`\nTotal conversations in database: ${conversationsResult.rows.length}`);
    if (conversationsResult.rows.length > 0) {
      console.log('\nConversations:');
      conversationsResult.rows.forEach(conv => {
        console.log(`  ${conv.user1_name} <-> ${conv.user2_name} (${conv.id})`);
        console.log(`    Created: ${conv.created_at}`);
        console.log(`    Last message: ${conv.last_message_id || 'None'}`);
      });
    } else {
      console.log('⚠️  No conversations found in database!');
    }
    
    // Count messages
    const messagesResult = await pool.query('SELECT COUNT(*) as count FROM messages');
    console.log(`\nTotal messages in database: ${messagesResult.rows[0].count}`);
    
    // If we have a user, test the getUserConversations query
    if (usersResult.rows.length > 0) {
      const testUserId = usersResult.rows[0].id;
      console.log(`\nTesting getUserConversations for user: ${usersResult.rows[0].username}`);
      
      const userConvsResult = await pool.query(
        `SELECT id, user1_id as "user1Id", user2_id as "user2Id", 
               last_message_id as "lastMessageId", created_at as "createdAt", 
               updated_at as "updatedAt"
        FROM conversations
        WHERE user1_id = $1 OR user2_id = $1
        ORDER BY updated_at DESC`,
        [testUserId]
      );
      
      console.log(`  Found ${userConvsResult.rows.length} conversations for this user`);
      if (userConvsResult.rows.length > 0) {
        console.log('  First conversation:', JSON.stringify(userConvsResult.rows[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testConversations();
