const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function setupTestUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Setting up test user for bookmark collections...\n');
    
    // Create test user
    const testUser = {
      id: 'test-user-1',
      username: 'testuser_collections',
      password: await bcrypt.hash('testpass123', 10),
      email: 'test@example.com',
      fullName: 'Test User Collections'
    };
    
    await pool.query(`
      INSERT INTO users (id, username, password, email, full_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [
      testUser.id,
      testUser.username,
      testUser.password,
      testUser.email,
      testUser.fullName
    ]);
    
    console.log('✅ Test user created\n');
    
    // Create test collection
    const testCollection = {
      id: 'test-collection-1',
      user_id: testUser.id,
      name: 'Test Collection',
      description: 'A test collection for bookmarks',
      color: '#ff0000',
      is_public: false
    };
    
    await pool.query(`
      INSERT INTO bookmark_collections (id, user_id, name, description, color, is_public)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [
      testCollection.id,
      testCollection.user_id,
      testCollection.name,
      testCollection.description,
      testCollection.color,
      testCollection.is_public
    ]);
    
    console.log('✅ Test collection created\n');
    
    // Verify data
    const collections = await pool.query(`
      SELECT bc.*, u.username 
      FROM bookmark_collections bc
      JOIN users u ON bc.user_id = u.id
      WHERE bc.user_id = $1
    `, [testUser.id]);
    
    console.log('Collections found:');
    console.table(collections.rows);
    
    console.log('\n🎉 Test setup completed successfully!');
    console.log('Test user credentials:');
    console.log('- Username: testuser_collections');
    console.log('- Password: testpass123');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
  } finally {
    await pool.end();
  }
}

setupTestUser();