const { Client } = require('pg');

async function checkVzglyadTaksyActivities() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    console.log('=== Checking Взгляд таксы Activities ===\n');
    
    // Find comments for "Взгляд таксы" book
    const commentsResult = await client.query(`
      SELECT 
        c.id,
        c.user_id,
        c.book_id,
        c.content,
        c.created_at,
        b.title
      FROM comments c
      LEFT JOIN books b ON c.book_id = b.id
      WHERE b.title = 'Взгляд таксы'
      ORDER BY c.created_at DESC
    `);
    
    console.log(`Found ${commentsResult.rowCount} comments for "Взгляд таксы":`);
    commentsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Comment ID: ${row.id}`);
      console.log(`   Book ID: ${row.book_id}`);
      console.log(`   Content: "${row.content}"`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
    // Find reviews for "Взгляд таксы" book
    const reviewsResult = await client.query(`
      SELECT 
        r.id,
        r.user_id,
        r.book_id,
        r.content,
        r.rating,
        r.created_at,
        b.title
      FROM reviews r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE b.title = 'Взгляд таксы'
      ORDER BY r.created_at DESC
    `);
    
    console.log(`Found ${reviewsResult.rowCount} reviews for "Взгляд таксы":`);
    reviewsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Review ID: ${row.id}`);
      console.log(`   Book ID: ${row.book_id}`);
      console.log(`   Rating: ${row.rating}/10`);
      console.log(`   Content: "${row.content}"`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
    // Check reading progress for this specific user and book
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    const bookTitle = 'Взгляд таксы';
    
    const bookResult = await client.query(
      'SELECT id FROM books WHERE title = $1',
      [bookTitle]
    );
    
    if (bookResult.rows[0]) {
      const bookId = bookResult.rows[0].id;
      console.log(`Book ID for "${bookTitle}": ${bookId}`);
      
      const progressResult = await client.query(
        'SELECT current_page, total_pages, percentage, chapter_index, last_read_at FROM reading_progress WHERE user_id = $1 AND book_id = $2 LIMIT 1',
        [userId, bookId]
      );
      
      if (progressResult.rows[0]) {
        const progress = progressResult.rows[0];
        console.log(`Reading progress for user ${userId}:`);
        console.log(`   Percentage: ${progress.percentage}%`);
        console.log(`   Pages: ${progress.current_page}/${progress.total_pages}`);
        console.log(`   Last read: ${progress.last_read_at}`);
      } else {
        console.log(`No reading progress found for user ${userId} and book ${bookId}`);
      }
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkVzglyadTaksyActivities();