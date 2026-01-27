const { Client } = require('pg');

async function checkSpecificBookmark() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check the bookmark data
    const result = await client.query(`
      SELECT id, title, chapter_index, percentage, selected_text, page_in_chapter, char_offset
      FROM bookmarks 
      WHERE id = '8628e850-ca79-4ae5-8107-a643250f066d'
    `);
    
    console.log('Bookmark data:', result.rows[0]);
    
    // Check if char_offset column exists
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' 
      AND column_name = 'char_offset'
    `);
    
    console.log('char_offset column exists:', columns.rows.length > 0);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkSpecificBookmark();