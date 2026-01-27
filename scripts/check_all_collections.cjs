const { Pool } = require('pg');

async function checkAllCollections() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    console.log('=== CHECKING ALL COLLECTIONS FOR USER ===\n');
    
    // Get all collections for this user
    console.log('1. All bookmark collections for user:');
    const collections = await pool.query(`
      SELECT bc.*, 
             COUNT(bci.id) as bookmark_count,
             STRING_AGG(cb.book_id, ',') as book_ids
      FROM bookmark_collections bc
      LEFT JOIN bookmark_collection_items bci ON bc.id = bci.collection_id
      LEFT JOIN collection_books cb ON bc.id = cb.collection_id
      WHERE bc.user_id = $1
      GROUP BY bc.id, bc.name, bc.description, bc.color, bc.is_public, bc.book_id, bc.view_count, bc.created_at, bc.updated_at
      ORDER BY bc.created_at DESC
    `, [userId]);
    
    console.log(`Found ${collections.rowCount} collections:`);
    collections.rows.forEach((collection, index) => {
      console.log(`${index + 1}. "${collection.name}" (ID: ${collection.id})`);
      console.log(`   Description: ${collection.description}`);
      console.log(`   Bookmarks: ${collection.bookmark_count}`);
      console.log(`   Book IDs: ${collection.book_ids || 'None'}`);
      console.log(`   Created: ${collection.created_at}`);
      console.log('   ---');
    });
    
    console.log('\n2. Detailed view of the problematic collection:');
    const problemCollection = await pool.query(`
      SELECT bc.*,
             COUNT(bci.id) as bookmark_count
      FROM bookmark_collections bc
      LEFT JOIN bookmark_collection_items bci ON bc.id = bci.collection_id
      WHERE bc.id = '293d5da7-f55b-4dd7-9185-1619e3efd8f7'
      GROUP BY bc.id, bc.name, bc.description, bc.color, bc.is_public, bc.book_id, bc.view_count, bc.created_at, bc.updated_at
    `);
    
    if (problemCollection.rows.length > 0) {
      const coll = problemCollection.rows[0];
      console.log(`Name: "${coll.name}"`);
      console.log(`Description: ${coll.description}`);
      console.log(`Bookmarks: ${coll.bookmark_count}`);
      console.log(`Created: ${coll.created_at}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllCollections();