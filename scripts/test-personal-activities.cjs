const { Client } = require('pg');

async function testPersonalActivities() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find user WizardJIOCb
    const userResult = await client.query('SELECT id, username FROM users WHERE username = $1', ['WizardJIOCb']);
    console.log('User found:', userResult.rows[0]);

    if (userResult.rows[0]) {
      const userId = userResult.rows[0].id;
      console.log('User ID:', userId);
      
      // Test the getPersonalActivities query manually
      console.log('\n=== Testing getPersonalActivities query ===');
      
      // Get user's comments (this is what should appear in Last Activity)
      const commentsResult = await client.query(`
        SELECT 
          c.id,
          c.user_id,
          c.book_id,
          c.content,
          c.created_at,
          c.updated_at,
          b.title as book_title
        FROM comments c
        LEFT JOIN books b ON c.book_id = b.id
        WHERE c.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT 10
      `, [userId]);
      
      console.log('User comments query result:');
      console.log(commentsResult.rows);
      
      // Check if the book comment is there
      const bookComment = commentsResult.rows.find(c => c.book_id === 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8');
      console.log('\nSpecific book comment found:', bookComment);
      
      // Also check parent comments that user replied to
      const parentCommentsResult = await client.query(`
        SELECT DISTINCT pc.id, pc.book_id, pc.content, pc.created_at, b.title as book_title
        FROM comments c
        JOIN comments pc ON c.parent_comment_id = pc.id
        LEFT JOIN books b ON pc.book_id = b.id
        WHERE c.user_id = $1 AND c.parent_comment_id IS NOT NULL
        ORDER BY pc.created_at DESC
        LIMIT 10
      `, [userId]);
      
      console.log('\nParent comments user replied to:');
      console.log(parentCommentsResult.rows);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

testPersonalActivities();