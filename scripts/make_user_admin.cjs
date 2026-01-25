const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function makeUserAdmin() {
  try {
    console.log('Connecting to database...');
    
    // First, let's see what users exist
    const usersResult = await pool.query('SELECT id, username, access_level FROM users ORDER BY created_at');
    console.log('Existing users:');
    usersResult.rows.forEach(user => {
      console.log(`- ${user.username} (${user.id}): ${user.access_level}`);
    });
    
    // Update the first user to admin (or a specific user if you know the username)
    const updateResult = await pool.query(
      "UPDATE users SET access_level = 'admin' WHERE username = 'user1' RETURNING id, username, access_level"
    );
    
    if (updateResult.rows.length > 0) {
      console.log('Successfully updated user to admin:');
      console.log(updateResult.rows[0]);
    } else {
      console.log('No user found with username "user1". Trying to make first user admin...');
      
      // Make the first user admin
      const firstUserResult = await pool.query(
        "UPDATE users SET access_level = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1) RETURNING id, username, access_level"
      );
      
      if (firstUserResult.rows.length > 0) {
        console.log('Successfully updated first user to admin:');
        console.log(firstUserResult.rows[0]);
      } else {
        console.log('No users found in database!');
      }
    }
    
  } catch (error) {
    console.error('Error updating user access level:', error);
  } finally {
    await pool.end();
  }
}

makeUserAdmin();