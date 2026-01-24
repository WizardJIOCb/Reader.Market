const { Client } = require('pg');

async function debugPercentageValue() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    console.log('=== Debugging Percentage Value ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    const bookId = 'cba2883e-a92f-4245-ae04-6f16d0c2bb36'; // Взгляд таксы
    
    const progressResult = await client.query(
      'SELECT current_page, total_pages, percentage, chapter_index, last_read_at FROM reading_progress WHERE user_id = $1 AND book_id = $2 LIMIT 1',
      [userId, bookId]
    );
    
    if (progressResult.rows[0]) {
      const progress = progressResult.rows[0];
      console.log('Raw progress data:');
      console.log('  current_page:', progress.current_page, typeof progress.current_page);
      console.log('  total_pages:', progress.total_pages, typeof progress.total_pages);
      console.log('  percentage:', progress.percentage, typeof progress.percentage);
      console.log('  chapter_index:', progress.chapter_index, typeof progress.chapter_index);
      console.log('  last_read_at:', progress.last_read_at, typeof progress.last_read_at);
      
      console.log('\nTesting conditions:');
      console.log('  progress.percentage > 0:', progress.percentage > 0);
      console.log('  parseFloat(progress.percentage) > 0:', parseFloat(progress.percentage) > 0);
      console.log('  Number(progress.percentage) > 0:', Number(progress.percentage) > 0);
      
      // Test the exact condition from the code
      const readingProgressIncluded = progress.percentage > 0;
      console.log('\nWould reading progress be included?', readingProgressIncluded ? 'YES' : 'NO');
      
      if (readingProgressIncluded) {
        console.log('Reading progress object that would be created:');
        console.log({
          currentPage: progress.current_page,
          totalPages: progress.total_pages,
          percentage: parseFloat(progress.percentage),
          chapterIndex: progress.chapter_index,
          lastReadAt: progress.last_read_at
        });
      }
    } else {
      console.log('No reading progress found');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

debugPercentageValue();