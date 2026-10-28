const { Client } = require('pg');

async function testDirectRating() {
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
    
    const bookId = '86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7';
    
    // First, let's check the current state of the book
    const bookBefore = await client.query('SELECT * FROM books WHERE id = $1', [bookId]);
    console.log('Book before update:', bookBefore.rows[0]);
    
    // Get all reviews for this book
    const reviewsResult = await client.query('SELECT * FROM reviews WHERE book_id = $1 ORDER BY created_at', [bookId]);
    console.log('Reviews found:', reviewsResult.rows);
    
    if (reviewsResult.rows.length > 0) {
      // Calculate average rating
      const totalRating = reviewsResult.rows.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviewsResult.rows.length;
      
      console.log(`Total rating: ${totalRating}`);
      console.log(`Number of reviews: ${reviewsResult.rows.length}`);
      console.log(`Calculated average rating: ${averageRating}`);
      
      // Update the book's rating field
      const formattedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place
      console.log(`Formatted rating: ${formattedRating}`);
      
      const updateResult = await client.query('UPDATE books SET rating = $1 WHERE id = $2 RETURNING *', [formattedRating, bookId]);
      console.log('Update result:', updateResult.rows[0]);
    }
    
    // Check the book's rating after the update
    const bookAfter = await client.query('SELECT * FROM books WHERE id = $1', [bookId]);
    console.log('Book after update:', bookAfter.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Full error:', err);
  }
}

testDirectRating();