const { Pool } = require('pg');

async function checkCollection() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    // Check if the collection exists
    const collectionResult = await pool.query(
      'SELECT id, name, user_id, is_public, book_id FROM bookmark_collections WHERE id = $1',
      ['e42ea31c-9484-425d-8f45-3a07f3d79f36']
    );
    
    console.log('=== Collection Info ===');
    if (collectionResult.rows.length > 0) {
      const collection = collectionResult.rows[0];
      console.log('ID:', collection.id);
      console.log('Name:', collection.name);
      console.log('User ID:', collection.user_id);
      console.log('Is Public:', collection.is_public);
      console.log('Book ID (deprecated):', collection.book_id);
      
      // Check if this collection is associated with the book via collection_books table
      const associationResult = await pool.query(
        'SELECT * FROM collection_books WHERE collection_id = $1 AND book_id = $2',
        [collection.id, '4f9af291-1f3e-4b47-ad87-47216516bf3b']
      );
      
      console.log('\n=== Book Association ===');
      if (associationResult.rows.length > 0) {
        console.log('✅ Collection is associated with the book via collection_books table');
        console.log('Association details:', associationResult.rows[0]);
      } else {
        console.log('❌ Collection is NOT associated with the book via collection_books table');
        
        // Check if there are any associations at all
        const allAssociations = await pool.query(
          'SELECT book_id FROM collection_books WHERE collection_id = $1',
          [collection.id]
        );
        
        if (allAssociations.rows.length > 0) {
          console.log('Collection has associations with these books:');
          allAssociations.rows.forEach(row => {
            console.log('- Book ID:', row.book_id);
          });
        } else {
          console.log('Collection has no book associations at all');
        }
      }
      
      // Check if there are any bookmarks in this collection for this book
      const bookmarkResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM bookmark_collection_items bci
        JOIN bookmarks b ON bci.bookmark_id = b.id
        WHERE bci.collection_id = $1 AND b.book_id = $2
      `, [collection.id, '4f9af291-1f3e-4b47-ad87-47216516bf3b']);
      
      console.log('\n=== Bookmark Count ===');
      console.log('Bookmarks in this collection for this book:', bookmarkResult.rows[0].count);
      
    } else {
      console.log('Collection not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkCollection();