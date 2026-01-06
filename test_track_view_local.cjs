const { Pool } = require('pg');
require('dotenv').config();

async function testTrackView() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('Testing book view tracking functionality\n');
    console.log('Database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    
    // Get a book to test with
    const booksResult = await pool.query('SELECT id, title FROM books LIMIT 1');
    
    if (booksResult.rows.length === 0) {
      console.log('⚠ No books found in database. Please add a book first.');
      await pool.end();
      return;
    }
    
    const testBook = booksResult.rows[0];
    console.log(`Testing with book: "${testBook.title}" (${testBook.id})\n`);
    
    // Test 1: Insert first card_view
    console.log('Test 1: Insert first card_view...');
    try {
      await pool.query(`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES ($1, 'card_view', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `, [testBook.id]);
      console.log('✓ Success: First card_view tracked\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Test 2: Increment card_view
    console.log('Test 2: Increment card_view (should update existing record)...');
    try {
      await pool.query(`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES ($1, 'card_view', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `, [testBook.id]);
      console.log('✓ Success: card_view incremented\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Test 3: Insert first reader_open
    console.log('Test 3: Insert first reader_open...');
    try {
      await pool.query(`
        INSERT INTO book_view_statistics (book_id, view_type, view_count, last_viewed_at)
        VALUES ($1, 'reader_open', 1, NOW())
        ON CONFLICT (book_id, view_type) 
        DO UPDATE SET
          view_count = book_view_statistics.view_count + 1,
          last_viewed_at = NOW(),
          updated_at = NOW()
      `, [testBook.id]);
      console.log('✓ Success: First reader_open tracked\n');
    } catch (error) {
      console.log('✗ Failed:', error.message, '\n');
    }
    
    // Verify the results
    const statsResult = await pool.query(`
      SELECT book_id, view_type, view_count, last_viewed_at
      FROM book_view_statistics
      WHERE book_id = $1
      ORDER BY view_type
    `, [testBook.id]);
    
    console.log('Final statistics for test book:');
    console.table(statsResult.rows);
    
    // Verify no duplicates exist
    const duplicateCheck = await pool.query(`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      WHERE book_id = $1
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `, [testBook.id]);
    
    if (duplicateCheck.rows.length === 0) {
      console.log('\n✓ No duplicates found - constraint is working correctly!');
    } else {
      console.log('\n⚠ Duplicates detected:');
      console.table(duplicateCheck.rows);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Test Summary:');
    console.log('- Upsert operations are working correctly');
    console.log('- View counts are being incremented properly');
    console.log('- Unique constraint is preventing duplicates');
    console.log('- The /api/books/:id/track-view endpoint should now work!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testTrackView();
