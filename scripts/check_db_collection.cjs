const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'booksdb',
  user: 'booksuser',
  password: 'bookspassword'
});

async function checkCollection() {
  try {
    console.log('=== Checking Collection Books Directly ===');
    
    const collectionId = 'e42ea31c-9484-425d-8f45-3a07f3d79f36';
    
    // Get collection info
    const collectionResult = await pool.query(
      'SELECT id, name, user_id FROM bookmark_collections WHERE id = $1',
      [collectionId]
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Collection not found!');
      return;
    }
    
    const collection = collectionResult.rows[0];
    console.log('Collection found:', collection.name);
    console.log('User ID:', collection.user_id);
    
    // Check associated books
    const booksResult = await pool.query(
      'SELECT book_id FROM collection_books WHERE collection_id = $1',
      [collectionId]
    );
    
    console.log('Associated books count:', booksResult.rows.length);
    console.log('Book IDs:', booksResult.rows.map(row => row.book_id));
    
    // Get book details
    if (booksResult.rows.length > 0) {
      console.log('\n=== Book Details ===');
      for (const row of booksResult.rows) {
        const bookResult = await pool.query(
          'SELECT id, title, author FROM books WHERE id = $1',
          [row.book_id]
        );
        
        if (bookResult.rows.length > 0) {
          const book = bookResult.rows[0];
          console.log(`Book: ${book.title} by ${book.author}`);
        }
      }
    }
    
    // Check bookmarks in collection
    const bookmarksResult = await pool.query(`
      SELECT b.id, b.title, b.book_id 
      FROM bookmark_collection_items bci
      JOIN bookmarks b ON bci.bookmark_id = b.id
      WHERE bci.collection_id = $1
    `, [collectionId]);
    
    console.log('\nBookmarks in collection:', bookmarksResult.rows.length);
    
    // Check all collections for this user
    console.log('\n=== All Collections for User ===');
    const allCollectionsResult = await pool.query(
      'SELECT id, name FROM bookmark_collections WHERE user_id = $1 ORDER BY created_at',
      [collection.user_id]
    );
    
    for (const coll of allCollectionsResult.rows) {
      const bookCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM collection_books WHERE collection_id = $1',
        [coll.id]
      );
      
      const bookmarkCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM bookmark_collection_items WHERE collection_id = $1',
        [coll.id]
      );
      
      console.log(`${coll.name}: ${bookCountResult.rows[0].count} books, ${bookmarkCountResult.rows[0].count} bookmarks`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkCollection();