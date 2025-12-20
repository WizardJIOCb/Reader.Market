const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function listAllBooks() {
  let client;
  try {
    client = await pool.connect();
    
    // List all books
    console.log('Listing all books in database...');
    const allBooksResult = await client.query('SELECT id, title, author FROM books ORDER BY created_at DESC');
    console.log(`Total books found: ${allBooksResult.rows.length}`);
    
    allBooksResult.rows.forEach((book, index) => {
      console.log(`${index + 1}. Book ID: ${book.id}`);
      console.log(`   Title: ${book.title}`);
      console.log(`   Author: ${book.author}`);
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

listAllBooks();