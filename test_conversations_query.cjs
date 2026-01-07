const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  ssl: false
});

async function testQuery() {
  try {
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    console.log('Testing conversations query for userId:', userId);
    console.log('');
    
    // Test the raw SQL query
    const result = await pool.query(`
      SELECT id, user1_id as "user1Id", user2_id as "user2Id", 
             last_message_id as "lastMessageId", created_at as "createdAt", 
             updated_at as "updatedAt"
      FROM conversations
      WHERE user1_id = $1 OR user2_id = $1
      ORDER BY updated_at DESC
    `, [userId]);
    
    console.log('Query result:');
    console.log('Row count:', result.rows.length);
    console.log('');
    
    if (result.rows.length > 0) {
      console.log('First conversation:');
      console.log(JSON.stringify(result.rows[0], null, 2));
      console.log('');
      console.log('All conversations:');
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.id} - user1: ${row.user1Id}, user2: ${row.user2Id}`);
      });
    } else {
      console.log('⚠️ NO CONVERSATIONS FOUND!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testQuery();
