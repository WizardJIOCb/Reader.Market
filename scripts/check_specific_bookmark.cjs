const { Pool } = require('pg');

async function checkSpecificBookmark() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const bookmarkId = '42afa1c1-ffe4-4837-906b-a843c594f140';
    const result = await pool.query(
      'SELECT id, title, chapter_index, page_in_chapter, percentage, selected_text FROM bookmarks WHERE id = $1', 
      [bookmarkId]
    );
    console.log('Bookmark data:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSpecificBookmark();