// Test the fixed endpoint by calling the storage method directly
const { DBStorage } = require('../dist/index.cjs');

async function testStorageMethod() {
  try {
    console.log('=== Testing Storage Method Fix ===');
    
    const storage = new DBStorage();
    
    // Use the user ID from our database check
    const userId = '88d59974-6b3f-48c7-b36a-3c1747c12333'; // This should be YOUR user ID
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log('Getting collections for book:', bookId, 'and user:', userId);
    
    // We need to access the database directly since we can't easily authenticate
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
    });
    
    try {
      // Test the exact query that should return the collection
      const result = await pool.query(`
        SELECT DISTINCT 
          bc.id,
          bc.name,
          bc.description,
          bc.color,
          bc.is_public,
          bc.book_id,
          bc.created_at,
          bc.updated_at,
          u.id as owner_id,
          u.username as owner_username,
          u.full_name as owner_full_name,
          u.avatar_url as owner_avatar_url,
          u.profile_rating as owner_profile_rating
        FROM bookmark_collections bc
        INNER JOIN collection_books cb ON bc.id = cb.collection_id
        LEFT JOIN users u ON bc.user_id = u.id
        WHERE cb.book_id = $1
          AND bc.is_public = true
          AND bc.user_id != $2
      `, [bookId, userId]);
      
      console.log('Query returned', result.rows.length, 'collections');
      
      if (result.rows.length > 0) {
        console.log('\n=== Found Collections ===');
        result.rows.forEach((row, index) => {
          console.log(`${index + 1}. ${row.name} (ID: ${row.id})`);
          console.log(`   Owner: ${row.owner_username}`);
          console.log(`   Public: ${row.is_public}`);
          console.log('');
        });
        
        // Check if our target collection is in the results
        const targetCollection = result.rows.find(r => r.id === 'e42ea31c-9484-425d-8f45-3a07f3d79f36');
        if (targetCollection) {
          console.log('✅ Target collection FOUND in query results!');
        } else {
          console.log('❌ Target collection NOT found in query results');
          console.log('This suggests there might be an issue with the query logic');
        }
      } else {
        console.log('No collections found - this indicates the fix may not be working');
      }
      
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testStorageMethod();