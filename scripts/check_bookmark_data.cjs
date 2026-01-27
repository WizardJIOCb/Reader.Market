// Check bookmark data to see if selectedText is stored
const { Pool } = require('pg');

async function checkBookmarkData() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log('=== Checking Bookmark Data ===');
    console.log('Book ID:', bookId);
    
    // Get all bookmarks for this book
    const bookmarks = await pool.query(`
      SELECT 
        b.id,
        b.title,
        b.chapter_index,
        b.percentage,
        b.selected_text,
        b.page_in_chapter,
        b.created_at,
        u.username as owner_username
      FROM bookmarks b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.book_id = $1
      ORDER BY b.created_at DESC
    `, [bookId]);
    
    console.log('Total bookmarks found:', bookmarks.rows.length);
    
    bookmarks.rows.forEach((bookmark, index) => {
      console.log(`\n--- Bookmark ${index + 1} ---`);
      console.log('ID:', bookmark.id);
      console.log('Title:', bookmark.title);
      console.log('Chapter Index:', bookmark.chapter_index);
      console.log('Page in Chapter:', bookmark.page_in_chapter);
      console.log('Percentage:', bookmark.percentage);
      console.log('Owner:', bookmark.owner_username);
      console.log('Has selected text:', !!bookmark.selected_text);
      console.log('Selected text length:', bookmark.selected_text ? bookmark.selected_text.length : 0);
      if (bookmark.selected_text) {
        console.log('Selected text (first 100 chars):', bookmark.selected_text.substring(0, 100));
      }
      console.log('Created at:', bookmark.created_at);
    });
    
    // Specifically check for bookmarks with the text we're looking for
    const searchText = 'Ты не на той стороне. Император лгал нам.';
    console.log('\n=== Searching for specific text ===');
    console.log('Searching for:', searchText);
    
    const matchingBookmarks = await pool.query(`
      SELECT 
        b.id,
        b.title,
        b.chapter_index,
        b.percentage,
        b.selected_text,
        b.page_in_chapter,
        b.created_at
      FROM bookmarks b
      WHERE b.book_id = $1 
        AND b.selected_text ILIKE $2
    `, [bookId, `%${searchText}%`]);
    
    console.log('Matching bookmarks found:', matchingBookmarks.rows.length);
    
    if (matchingBookmarks.rows.length > 0) {
      matchingBookmarks.rows.forEach((bookmark, index) => {
        console.log(`\n--- Matching Bookmark ${index + 1} ---`);
        console.log('ID:', bookmark.id);
        console.log('Title:', bookmark.title);
        console.log('Chapter:', bookmark.chapter_index);
        console.log('Page:', bookmark.page_in_chapter);
        console.log('Selected text:', bookmark.selected_text);
      });
    } else {
      console.log('No bookmarks found with that exact text');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

checkBookmarkData();