const { Client } = require('pg');

async function checkUserData() {
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
      
      // Check user's comments
      const commentsResult = await client.query('SELECT id, book_id, content, created_at FROM comments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);
      console.log('\nUser comments:');
      console.log(commentsResult.rows);

      // Check user's profile comments
      const profileCommentsResult = await client.query('SELECT id, profile_id, content, created_at FROM profile_comments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);
      console.log('\nUser profile comments:');
      console.log(profileCommentsResult.rows);

      // Check user actions
      const actionsResult = await client.query('SELECT id, action_type, target_type, target_id, created_at FROM user_actions WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10', [userId]);
      console.log('\nUser actions:');
      console.log(actionsResult.rows);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

checkUserData();