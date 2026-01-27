const { Pool } = require('pg');

async function checkBookmark() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const result = await pool.query(
      'SELECT id, title, chapter_index, page_in_chapter, percentage, selected_text FROM bookmarks WHERE id = $1', 
      ['80d67aac-daab-4595-8e8f-ef650e0a81fb']
    );
    console.log('Bookmark data:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBookmark();