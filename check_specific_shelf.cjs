const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function checkSpecificShelf() {
  let client;
  try {
    client = await pool.connect();
    
    // Check if the specific shelf exists
    const shelfId = '1f219030-f53f-4acb-a8a4-872816e7a241';
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
    
    // Also check if the book exists
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

checkSpecificShelf();