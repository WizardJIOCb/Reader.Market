const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function debugShelfIssue() {
  let client;
  try {
    client = await pool.connect();
    
    console.log("Debugging shelf issue...");
    
    // Check if the shelf ID from the error exists
    const shelfId = "1f219030-f53f-4acb-a8a4-872816e7a241";
    console.log(`Checking if shelf ${shelfId} exists...`);
    
    const shelfResult = await client.query('SELECT * FROM shelves WHERE id = $1', [shelfId]);
    if (shelfResult.rows.length > 0) {
      console.log("Shelf found:", shelfResult.rows[0]);
    } else {
      console.log("Shelf not found");
    }
    
    // Check if the book ID from the URL exists
    const bookId = "7fc478fb-a828-43a8-b2b2-eae408f979ef";
    console.log(`Checking if book ${bookId} exists...`);
    
    const bookResult = await client.query('SELECT * FROM books WHERE id = $1', [bookId]);
    if (bookResult.rows.length > 0) {
      console.log("Book found:", bookResult.rows[0]);
      console.log(`Book title: ${bookResult.rows[0].title}`);
      console.log(`Book author: ${bookResult.rows[0].author}`);
    } else {
      console.log("Book not found");
    }
    
    // List all shelves
    console.log("Listing all shelves...");
    const allShelvesResult = await client.query('SELECT * FROM shelves ORDER BY created_at DESC');
    allShelvesResult.rows.forEach((shelf, index) => {
      console.log(`${index + 1}. Shelf ID: ${shelf.id}`);
      console.log(`   Name: ${shelf.name}`);
      console.log(`   User ID: ${shelf.user_id}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

debugShelfIssue();