const { Pool } = require('pg');

async function testQuery() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    const userId = '88d59974-6b3f-48c7-b36a-3c1747c12333'; // Your user ID
    
    console.log('Testing the query that should return public collections from other users...');
    
    // Test the exact query from our fix
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
        console.log(`   Owner ID: ${row.owner_id}`);
        console.log(`   Current User ID: ${userId}`);
        console.log(`   Different owners: ${row.owner_id !== userId ? 'YES' : 'NO'}`);
        console.log('');
      });
      
      // Check if our target collection is in the results
      const targetCollection = result.rows.find(r => r.id === 'e42ea31c-9484-425d-8f45-3a07f3d79f36');
      if (targetCollection) {
        console.log('✅ Target collection FOUND in query results!');
        console.log('Target collection details:');
        console.log('- Name:', targetCollection.name);
        console.log('- Owner:', targetCollection.owner_username);
        console.log('- Owner ID:', targetCollection.owner_id);
      } else {
        console.log('❌ Target collection NOT found in query results');
        console.log('Debug info:');
        console.log('- Target collection ID: e42ea31c-9484-425d-8f45-3a07f3d79f36');
        console.log('- Query conditions:');
        console.log('  * book_id =', bookId);
        console.log('  * is_public = true');
        console.log('  * user_id !=', userId);
      }
    } else {
      console.log('No collections found');
      
      // Let's debug by checking what collections exist for this book
      console.log('\n=== Debug: All collections for this book ===');
      const debugResult = await pool.query(`
        SELECT 
          bc.id,
          bc.name,
          bc.user_id,
          bc.is_public,
          u.username as owner_username
        FROM bookmark_collections bc
        INNER JOIN collection_books cb ON bc.id = cb.collection_id
        LEFT JOIN users u ON bc.user_id = u.id
        WHERE cb.book_id = $1
      `, [bookId]);
      
      debugResult.rows.forEach(row => {
        console.log(`- ${row.name} (${row.id})`);
        console.log(`  Owner: ${row.owner_username} (${row.user_id})`);
        console.log(`  Public: ${row.is_public}`);
        console.log(`  Would match query: ${row.is_public && row.user_id !== userId ? 'YES' : 'NO'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testQuery();