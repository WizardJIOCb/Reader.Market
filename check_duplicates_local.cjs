const { Pool } = require('pg');
require('dotenv').config();

async function checkDuplicates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('Checking for duplicate records in book_view_statistics...\n');
    console.log('Database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    
    // Check for duplicates
    const duplicatesResult = await pool.query(`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('✓ No duplicates found! Safe to add unique constraint.');
    } else {
      console.log('⚠ Found duplicates:');
      console.table(duplicatesResult.rows);
      
      // Get details of duplicate records
      for (const dup of duplicatesResult.rows) {
        const recordsResult = await pool.query(`
          SELECT id, book_id, view_type, view_count, last_viewed_at
          FROM book_view_statistics
          WHERE book_id = $1 AND view_type = $2
          ORDER BY last_viewed_at DESC
        `, [dup.book_id, dup.view_type]);
        
        console.log(`\nDetails for book_id: ${dup.book_id}, view_type: ${dup.view_type}:`);
        console.table(recordsResult.rows);
      }
    }
    
    // Get total record count
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM book_view_statistics');
    console.log(`\nTotal records: ${totalResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Error checking duplicates:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

checkDuplicates();
