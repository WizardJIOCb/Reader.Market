const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function createTestUser() {
  let client;
  try {
    client = await pool.connect();
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create test user
    console.log('Creating test user...');
    const result = await client.query(
      'INSERT INTO users (username, password, email, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username',
      ['user1', hashedPassword, 'user1@example.com', 'Test User']
    );
    
    console.log('Test user created successfully:');
    console.log('User ID:', result.rows[0].id);
    console.log('Username:', result.rows[0].username);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

createTestUser();