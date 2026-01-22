const { Client } = require('pg');

async function testSubscriptions() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Test user ID (WizardJIOCb)
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    // Test subscription to a book
    const bookId = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'; // The book from your example
    
    console.log('Testing subscription functionality...');
    
    // Insert test subscription
    const result = await client.query(`
      INSERT INTO subscriptions (user_id, entity_type, entity_id, created_at, last_read_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING
      RETURNING *
    `, [userId, 'book', bookId]);
    
    console.log('Subscription created:', result.rows[0]);
    
    // Query subscriptions for this user
    const subscriptions = await client.query(`
      SELECT * FROM subscriptions WHERE user_id = $1
    `, [userId]);
    
    console.log('User subscriptions:');
    console.log(subscriptions.rows);
    
    // Test counting unread comments on this book
    const lastReadTime = subscriptions.rows[0]?.last_read_at || new Date(0);
    
    const unreadComments = await client.query(`
      SELECT COUNT(*) as count 
      FROM comments 
      WHERE book_id = $1 AND created_at > $2
    `, [bookId, lastReadTime]);
    
    console.log('Unread comments count:', unreadComments.rows[0].count);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

testSubscriptions();