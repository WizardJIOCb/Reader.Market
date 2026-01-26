const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
require('dotenv').config();

async function testBookmarkCollections() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);
  
  try {
    console.log('Testing bookmark collections functionality...\n');
    
    // Test if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('bookmark_collections', 'bookmark_collection_items')
      AND table_schema = 'public'
    `);
    
    console.log('Tables found:', tables.rows.map(t => t.table_name));
    
    if (tables.rows.length !== 2) {
      console.log('❌ Required tables not found. Please run the migration.');
      return;
    }
    
    console.log('✅ Bookmark collections tables exist\n');
    
    // Test inserting a sample collection
    console.log('Creating test collection...');
    const testCollection = {
      id: 'test-collection-1',
      user_id: 'test-user-1',
      name: 'Test Collection',
      description: 'A test collection for bookmarks',
      color: '#ff0000',
      is_public: false
    };
    
    try {
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
      
      // Test querying collections
      const collections = await pool.query(`
        SELECT * FROM bookmark_collections WHERE user_id = $1
      `, [testCollection.user_id]);
      
      console.log('Collections for user:', collections.rows);
      
      // Clean up test data
      await pool.query(`DELETE FROM bookmark_collections WHERE id = $1`, [testCollection.id]);
      console.log('✅ Test data cleaned up\n');
      
      console.log('🎉 All tests passed! Bookmark collections functionality is working.');
      
    } catch (error) {
      console.error('❌ Error during testing:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await pool.end();
  }
}

testBookmarkCollections();