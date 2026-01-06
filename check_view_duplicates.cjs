const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkDuplicates() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Checking for duplicate records in book_view_statistics...\n');
    
    // Check for duplicates
    const duplicates = await sql`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicates found! Safe to add unique constraint.');
    } else {
      console.log('⚠ Found duplicates:');
      console.table(duplicates);
      
      // Get details of duplicate records
      for (const dup of duplicates) {
        const records = await sql`
          SELECT id, book_id, view_type, view_count, last_viewed_at
          FROM book_view_statistics
          WHERE book_id = ${dup.book_id} AND view_type = ${dup.view_type}
          ORDER BY last_viewed_at DESC
        `;
        console.log(`\nDetails for book_id: ${dup.book_id}, view_type: ${dup.view_type}:`);
        console.table(records);
      }
    }
    
    // Get total record count
    const total = await sql`SELECT COUNT(*) as count FROM book_view_statistics`;
    console.log(`\nTotal records: ${total[0].count}`);
    
  } catch (error) {
    console.error('Error checking duplicates:', error);
  }
}

checkDuplicates();
