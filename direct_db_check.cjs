const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function checkShelf() {
  let client;
  try {
    client = await pool.connect();
    
    // Check if the specific shelf exists
    const shelfId = '08d1454e-0296-4587-b0d3-b9ecb96082a4';
    console.log(`Checking if shelf ${shelfId} exists...`);
    
    const shelfResult = await client.query(
      'SELECT * FROM shelves WHERE id = $1',
      [shelfId]
    );
    
    if (shelfResult.rows.length > 0) {
      console.log('Shelf found:', shelfResult.rows[0]);
      console.log(`Shelf belongs to user: ${shelfResult.rows[0].user_id}`);
    } else {
      console.log('Shelf not found in database');
    }
    
    // Check all shelves
    console.log('\nChecking all shelves in database...');
    const allShelvesResult = await client.query('SELECT * FROM shelves');
    console.log(`Total shelves found: ${allShelvesResult.rows.length}`);
    allShelvesResult.rows.forEach(shelf => {
      console.log(`- Shelf ID: ${shelf.id}, Name: ${shelf.name}, User ID: ${shelf.user_id}`);
    });
    
    // Check if the book exists
    const bookId = '935fbc37-7e1f-4a83-b236-543cba12993d';
    console.log(`\nChecking if book ${bookId} exists...`);
    
    const bookResult = await client.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length > 0) {
      console.log('Book found:', bookResult.rows[0].title);
    } else {
      console.log('Book not found in database');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

checkShelf();