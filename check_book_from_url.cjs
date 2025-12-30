const { Client } = require('pg');
require('dotenv').config();

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkBook() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check for the specific book ID from the URL
    const bookId = '7fc478fb-a828-43a8-b2b2-eae408f979ef';
    console.log(`Checking book with ID: ${bookId}`);
    
    const bookResult = await client.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length > 0) {
      console.log('Book found:');
      console.log(JSON.stringify(bookResult.rows[0], null, 2));
      
      // Check the file type and path
      const book = bookResult.rows[0];
      console.log(`File path: ${book.file_path}`);
      console.log(`File type: ${book.file_type}`);
    } else {
      console.log('Book not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkBook();