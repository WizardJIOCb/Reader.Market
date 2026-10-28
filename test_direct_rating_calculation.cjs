const { Client } = require('pg');

// Hardcoded connection parameters
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'booksdb',
  user: 'booksuser',
  password: 'bookspassword',
  ssl: false
});

async function testDirectRatingCalculation() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Find a book with reviews to test with
    console.log('Finding a book with reviews...');
    const bookWithReviewsRes = await client.query(`
      SELECT b.id, b.title, b.rating, COUNT(r.id) as review_count
      FROM books b
      LEFT JOIN reviews r ON b.id = r.book_id
      GROUP BY b.id, b.title, b.rating
      HAVING COUNT(r.id) > 0
      LIMIT 1
    `);
    
    if (bookWithReviewsRes.rows.length > 0) {
      const book = bookWithReviewsRes.rows[0];
      console.log(`Found book with reviews:`, book);
      
      // Get all reviews for this book
      console.log('Getting all reviews for this book...');
      const reviewsRes = await client.query('SELECT * FROM reviews WHERE book_id = $1', [book.id]);
      console.log('Reviews:', reviewsRes.rows);
      
      // Calculate average rating manually
      const totalRating = reviewsRes.rows.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviewsRes.rows.length;
      const formattedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place
      
      console.log(`Manual calculation - Total rating: ${totalRating}, Count: ${reviewsRes.rows.length}, Average: ${averageRating}, Formatted: ${formattedRating}`);
      
      // Update the book's rating field directly
      console.log('Updating book rating directly...');
      await client.query('UPDATE books SET rating = $1 WHERE id = $2', [formattedRating, book.id]);
      
      // Check the book's rating after the update
      console.log('Checking book rating after direct update...');
      const updatedBookRes = await client.query('SELECT id, title, rating FROM books WHERE id = $1', [book.id]);
      console.log('Book after direct update:', updatedBookRes.rows[0]);
      
      // Now let's test adding a new review and see if the rating gets updated
      console.log('Adding a new review...');
      const userId = reviewsRes.rows[0].user_id; // Use the same user ID
      const newReviewRes = await client.query(
        'INSERT INTO reviews (user_id, book_id, rating, content) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, book.id, 10, 'Test review for rating calculation']
      );
      console.log('Added review with ID:', newReviewRes.rows[0].id);
      
      // Get all reviews again
      console.log('Getting all reviews after adding new one...');
      const reviewsRes2 = await client.query('SELECT * FROM reviews WHERE book_id = $1', [book.id]);
      console.log('Reviews after adding new one:', reviewsRes2.rows);
      
      // Calculate new average
      const totalRating2 = reviewsRes2.rows.reduce((sum, review) => sum + review.rating, 0);
      const averageRating2 = totalRating2 / reviewsRes2.rows.length;
      const formattedRating2 = Math.round(averageRating2 * 10) / 10;
      
      console.log(`New calculation - Total rating: ${totalRating2}, Count: ${reviewsRes2.rows.length}, Average: ${averageRating2}, Formatted: ${formattedRating2}`);
      
      // Check if the book's rating was automatically updated (it should be if the trigger works)
      console.log('Checking if book rating was automatically updated...');
      const bookRes3 = await client.query('SELECT id, title, rating FROM books WHERE id = $1', [book.id]);
      console.log('Book after adding review:', bookRes3.rows[0]);
      
      // Clean up by deleting the test review
      console.log('Cleaning up test review...');
      await client.query('DELETE FROM reviews WHERE id = $1', [newReviewRes.rows[0].id]);
      
      // Restore original rating
      console.log('Restoring original rating...');
      await client.query('UPDATE books SET rating = $1 WHERE id = $2', [formattedRating, book.id]);
      
      // Final check
      console.log('Final check of book rating...');
      const finalBookRes = await client.query('SELECT id, title, rating FROM books WHERE id = $1', [book.id]);
      console.log('Final book state:', finalBookRes.rows[0]);
    } else {
      console.log('No books with reviews found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testDirectRatingCalculation();