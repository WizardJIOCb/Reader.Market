const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUserConversations() {
  const userId = '605db90f-4691-4281-991e-b2e248e33915';
  
  console.log('\n=== Checking conversations for user:', userId, '===\n');
  
  try {
    // Check conversations
    const result = await pool.query(
      `SELECT id, user1_id, user2_id, created_at 
       FROM conversations 
       WHERE user1_id = $1 OR user2_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    console.log('Found', result.rows.length, 'conversations');
    result.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Conversation ${row.id}`);
      console.log('   user1_id:', row.user1_id);
      console.log('   user2_id:', row.user2_id);
      console.log('   created:', row.created_at);
    });
    
    // Check user exists
    const userCheck = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    
    console.log('\nUser check:');
    if (userCheck.rows.length > 0) {
      console.log('  User exists:', userCheck.rows[0].username);
    } else {
      console.log('  ❌ USER NOT FOUND!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUserConversations();
