// Check if the collection is properly associated with the book
const { Pool } = require('pg');

async function checkCollectionBookAssociation() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const collectionId = 'e42ea31c-9484-425d-8f45-3a07f3d79f36';
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log('=== Checking Collection-Book Association ===');
    console.log('Collection ID:', collectionId);
    console.log('Book ID:', bookId);
    
    // Check if collection exists and is public
    const collectionCheck = await pool.query(`
      SELECT id, name, is_public, user_id 
      FROM bookmark_collections 
      WHERE id = $1
    `, [collectionId]);
    
    if (collectionCheck.rows.length === 0) {
      console.log('❌ Collection not found!');
      return;
    }
    
    const collection = collectionCheck.rows[0];
    console.log('\nCollection found:');
    console.log('- Name:', collection.name);
    console.log('- Is Public:', collection.is_public);
    console.log('- Owner User ID:', collection.user_id);
    
    // Check collection_books association
    console.log('\n--- Checking collection_books table ---');
    const associationCheck = await pool.query(`
      SELECT * FROM collection_books 
      WHERE collection_id = $1 AND book_id = $2
    `, [collectionId, bookId]);
    
    console.log('Association records found:', associationCheck.rows.length);
    if (associationCheck.rows.length > 0) {
      console.log('✅ Collection is associated with the book');
      associationCheck.rows.forEach(row => {
        console.log('  Record:', row);
      });
    } else {
      console.log('❌ No association found in collection_books table');
      
      // Let's check if we can create the association
      console.log('\n--- Attempting to create association ---');
      try {
        const insertResult = await pool.query(`
          INSERT INTO collection_books (collection_id, book_id)
          VALUES ($1, $2)
          ON CONFLICT (collection_id, book_id) DO NOTHING
          RETURNING *
        `, [collectionId, bookId]);
        
        if (insertResult.rows.length > 0) {
          console.log('✅ Successfully created association');
        } else {
          console.log('ℹ️  Association already exists or conflict occurred');
        }
      } catch (error) {
        console.log('❌ Failed to create association:', error.message);
      }
    }
    
    // Check if the collection has the correct book_id field
    console.log('\n--- Checking collection book_id field ---');
    console.log('Collection book_id:', collection.book_id);
    if (collection.book_id === bookId) {
      console.log('✅ Collection has correct book_id field');
    } else {
      console.log('❌ Collection book_id field does not match');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

checkCollectionBookAssociation();