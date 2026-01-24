const { Client } = require('pg');

async function checkSpecificReadingProgress() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    console.log('=== Checking Specific Reading Progress ===\n');
    
    // Check reading progress for specific book IDs from the API response
    const bookIds = [
      'b35fd6da-648e-4a59-b967-3199090db3f9', // This one had reading progress
      'cba2883e-a92f-4245-ae04-6f16d0c2bb36', // From the user's complaint URL
      '86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7', // Multiple activities with null readingProgress
      'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'  // Another one with null readingProgress
    ];
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915'; // Kalimullin Rodion
    
    for (const bookId of bookIds) {
      console.log(`--- Book ID: ${bookId} ---`);
      
      // Get book title
      const bookResult = await client.query(
        'SELECT title FROM books WHERE id = $1',
        [bookId]
      );
      
      const bookTitle = bookResult.rows[0]?.title || 'Unknown';
      console.log(`Book title: ${bookTitle}`);
      
      // Check reading progress
      const progressResult = await client.query(
        'SELECT current_page, total_pages, percentage, chapter_index, last_read_at FROM reading_progress WHERE user_id = $1 AND book_id = $2 LIMIT 1',
        [userId, bookId]
      );
      
      if (progressResult.rows[0]) {
        const progress = progressResult.rows[0];
        console.log(`✅ Reading progress found:`);
        console.log(`   Percentage: ${progress.percentage}%`);
        console.log(`   Pages: ${progress.current_page}/${progress.total_pages}`);
        console.log(`   Last read: ${progress.last_read_at}`);
      } else {
        console.log(`❌ No reading progress found for this user/book combination`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkSpecificReadingProgress();