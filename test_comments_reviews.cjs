const { Client } = require('pg');

async function testCounts() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword',
  });

  try {
    console.log('Attempting to connect to database...');
    await client.connect();
    console.log('Connected successfully!');
    
    // Check if the book exists
    const bookId = '86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7';
    console.log(`Checking book with ID: ${bookId}`);
    
    const bookResult = await client.query('SELECT * FROM books WHERE id = $1', [bookId]);
    console.log('Book found:', bookResult.rows.length > 0);
    if (bookResult.rows.length > 0) {
      console.log('Book details:', bookResult.rows[0]);
    }
    
    // Count comments for this book
    const commentCountResult = await client.query('SELECT COUNT(*) as count FROM comments WHERE book_id = $1', [bookId]);
    console.log('Comment count:', commentCountResult.rows[0].count);
    
    // Count reviews for this book
    const reviewCountResult = await client.query('SELECT COUNT(*) as count FROM reviews WHERE book_id = $1', [bookId]);
    console.log('Review count:', reviewCountResult.rows[0].count);
    
    // Get actual comments
    const commentsResult = await client.query('SELECT * FROM comments WHERE book_id = $1', [bookId]);
    console.log('Actual comments:', commentsResult.rows);
    
    // Get actual reviews
    const reviewsResult = await client.query('SELECT * FROM reviews WHERE book_id = $1', [bookId]);
    console.log('Actual reviews:', reviewsResult.rows);
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Full error:', err);
  }
}

testCounts();