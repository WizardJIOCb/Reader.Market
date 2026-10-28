const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function testSpecificCombination() {
  let client;
  try {
    client = await pool.connect();
    
    const shelfId = '935fbc37-7e1f-4a83-b236-543cba12993d';
    const bookId = '86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7';
    
    console.log(`Testing combination:`);
    console.log(`Shelf ID: ${shelfId} (should be shelf named "3")`);
    console.log(`Book ID: ${bookId} (should be book titled "ррр1")`);
    console.log('');
    
    // Check if shelf exists
    console.log('Checking if shelf exists...');
    const shelfResult = await client.query(
      'SELECT * FROM shelves WHERE id = $1',
      [shelfId]
    );
    
    if (shelfResult.rows.length > 0) {
      console.log('✓ Shelf found:', shelfResult.rows[0].name);
    } else {
      console.log('✗ Shelf not found!');
      return;
    }
    
    // Check if book exists
    console.log('\nChecking if book exists...');
    const bookResult = await client.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length > 0) {
      console.log('✓ Book found:', bookResult.rows[0].title);
    } else {
      console.log('✗ Book not found!');
      return;
    }
    
    // Check if book is already in shelf
    console.log('\nChecking if book is already in shelf...');
    const shelfBookResult = await client.query(
      'SELECT * FROM shelf_books WHERE shelf_id = $1 AND book_id = $2',
      [shelfId, bookId]
    );
    
    if (shelfBookResult.rows.length > 0) {
      console.log('⚠ Book is already in this shelf');
    } else {
      console.log('✓ Book is not in this shelf yet');
    }
    
    console.log('\nThis combination should work for API call:');
    console.log(`POST /api/shelves/${shelfId}/books/${bookId}`);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testSpecificCombination();