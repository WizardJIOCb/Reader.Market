const { Client } = require('pg');

async function checkDatabaseData() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    
    console.log('=== Checking Database Data ===\n');
    
    // Check comments table
    console.log('--- Comments Table ---');
    const commentsResult = await client.query(`
      SELECT 
        c.id,
        c.user_id,
        c.book_id,
        LENGTH(c.content) as content_length,
        c.created_at,
        u.username,
        u.full_name,
        b.title as book_title
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN books b ON c.book_id = b.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${commentsResult.rowCount} comments:`);
    commentsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   User: ${row.full_name || row.username} (${row.user_id})`);
      console.log(`   Book: ${row.book_title || 'Unknown'}`);
      console.log(`   Content length: ${row.content_length} chars`);
      console.log(`   Created: ${row.created_at}\n`);
    });
    
    // Check reviews table
    console.log('--- Reviews Table ---');
    const reviewsResult = await client.query(`
      SELECT 
        r.id,
        r.user_id,
        r.book_id,
        r.rating,
        LENGTH(r.content) as content_length,
        r.created_at,
        u.username,
        u.full_name,
        b.title as book_title
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN books b ON r.book_id = b.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${reviewsResult.rowCount} reviews:`);
    reviewsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   User: ${row.full_name || row.username} (${row.user_id})`);
      console.log(`   Book: ${row.book_title || 'Unknown'}`);
      console.log(`   Rating: ${row.rating}/10`);
      console.log(`   Content length: ${row.content_length} chars`);
      console.log(`   Created: ${row.created_at}\n`);
    });
    
    // Check reading progress table
    console.log('--- Reading Progress Table ---');
    const progressResult = await client.query(`
      SELECT 
        rp.user_id,
        rp.book_id,
        rp.percentage,
        rp.current_page,
        rp.total_pages,
        rp.last_read_at,
        u.username,
        u.full_name,
        b.title as book_title
      FROM reading_progress rp
      LEFT JOIN users u ON rp.user_id = u.id
      LEFT JOIN books b ON rp.book_id = b.id
      WHERE rp.percentage > 0
      ORDER BY rp.last_read_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${progressResult.rowCount} reading progress records:`);
    progressResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. User: ${row.full_name || row.username}`);
      console.log(`   Book: ${row.book_title || 'Unknown'}`);
      console.log(`   Progress: ${row.percentage}% (${row.current_page}/${row.total_pages} pages)`);
      console.log(`   Last read: ${row.last_read_at}\n`);
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkDatabaseData();