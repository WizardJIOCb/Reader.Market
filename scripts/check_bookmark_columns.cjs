const { Client } = require('pg');

async function checkBookmarkColumns() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Bookmarks table columns:');
    result.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkBookmarkColumns();