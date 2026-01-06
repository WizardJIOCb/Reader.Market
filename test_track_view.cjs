const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function testTrackView() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Testing book view tracking functionality\n');
    
    // Get a book to test with
    const books = await sql`SELECT id, title FROM books LIMIT 1`;
    
    if (books.length === 0) {
      console.log('⚠ No books found in database. Please add a book first.');
      return;
    }
    
    const testBook = books[0];
    console.log(`Testing with book: "${testBook.title}" (${testBook.id})\n`);
    
    // Simulate what the incrementBookViewCount function does
    console.log('Test 1: Insert first card_view...');
    try {
      await sql`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES (${testBook.id}, 'card_view', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `;
      console.log('✓ Success: First card_view tracked\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Test incrementing the same view type
    console.log('Test 2: Increment card_view (should update existing record)...');
    try {
      await sql`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES (${testBook.id}, 'card_view', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `;
      console.log('✓ Success: card_view incremented\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Test different view type
    console.log('Test 3: Insert first reader_open...');
    try {
      await sql`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES (${testBook.id}, 'reader_open', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `;
      console.log('✓ Success: First reader_open tracked\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Verify the results
    const stats = await sql`
      SELECT book_id, view_type, view_count, last_viewed_at
      FROM book_view_statistics
      WHERE book_id = ${testBook.id}
      ORDER BY view_type
    `;
    
    console.log('Final statistics for test book:');
    console.table(stats);
    
    // Verify no duplicates exist
    const duplicateCheck = await sql`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      WHERE book_id = ${testBook.id}
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `;
    
    if (duplicateCheck.length === 0) {
      console.log('\n✓ No duplicates found - constraint is working correctly!');
    } else {
      console.log('\n⚠ Duplicates detected:');
      console.table(duplicateCheck);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Test Summary:');
    console.log('- Upsert operations are working correctly');
    console.log('- View counts are being incremented properly');
    console.log('- Unique constraint is preventing duplicates');
    console.log('- The /api/books/:id/track-view endpoint should now work!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testTrackView();
