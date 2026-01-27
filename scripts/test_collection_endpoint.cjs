const { Pool } = require('pg');

async function testCollectionEndpoint() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const collectionId = '280a3566-a865-4f0d-ac0f-5be21fe1fdcf';
    
    console.log('=== TESTING COLLECTION ENDPOINT DATA ===\n');
    
    // Test the exact query that the getBookmarkCollection method uses
    console.log('1. Testing collection query:');
    const collectionResult = await pool.query(`
      SELECT bc.*,
             u.id as owner_id,
             u.username as owner_username,
             u.full_name as owner_full_name,
             u.avatar_url as owner_avatar_url,
             u.profile_rating as owner_profile_rating
      FROM bookmark_collections bc
      LEFT JOIN users u ON bc.user_id = u.id
      WHERE bc.id = $1
    `, [collectionId]);
    
    console.log(`Collection found: ${collectionResult.rows.length > 0 ? 'Yes' : 'No'}`);
    if (collectionResult.rows.length > 0) {
      const coll = collectionResult.rows[0];
      console.log(`Name: "${coll.name}"`);
      console.log(`Description: ${coll.description}`);
    }
    
    console.log('\n2. Testing associated books with counts:');
    const booksQuery = `
      SELECT DISTINCT b.id, b.title, b.author, b.cover_image_url,
             COUNT(bci.id) as bookmark_count
      FROM collection_books cb
      JOIN books b ON cb.book_id = b.id
      LEFT JOIN bookmark_collection_items bci ON cb.collection_id = bci.collection_id 
        AND EXISTS (
          SELECT 1 FROM bookmarks bk 
          WHERE bk.id = bci.bookmark_id 
          AND bk.book_id = b.id
        )
      WHERE cb.collection_id = $1
      GROUP BY b.id, b.title, b.author, b.cover_image_url
    `;
    
    const booksResult = await pool.query(booksQuery, [collectionId]);
    console.log(`Books found: ${booksResult.rowCount}`);
    booksResult.rows.forEach((book, index) => {
      console.log(`${index + 1}. "${book.title}" by ${book.author}`);
      console.log(`   Bookmarks in collection: ${book.bookmark_count}`);
      console.log(`   Cover image: ${book.cover_image_url || 'None'}`);
    });
    
    console.log('\n3. Testing bookmarks in collection:');
    const bookmarksQuery = `
      SELECT b.id, b.title, b.chapter_index, b.percentage, b.selected_text,
             b.page_in_chapter, b.click_count, b.created_at,
             bk.id as book_id, bk.title as book_title, bk.author as book_author,
             bk.cover_image_url as book_cover_image_url
      FROM bookmark_collection_items bci
      JOIN bookmarks b ON bci.bookmark_id = b.id
      JOIN books bk ON b.book_id = bk.id
      WHERE bci.collection_id = $1
      ORDER BY bci.added_at
    `;
    
    const bookmarksResult = await pool.query(bookmarksQuery, [collectionId]);
    console.log(`Bookmarks found: ${bookmarksResult.rowCount}`);
    const bookmarksByBook = {};
    bookmarksResult.rows.forEach((bookmark, index) => {
      console.log(`${index + 1}. "${bookmark.title}" in "${bookmark.book_title}"`);
      if (!bookmarksByBook[bookmark.book_id]) {
        bookmarksByBook[bookmark.book_id] = [];
      }
      bookmarksByBook[bookmark.book_id].push(bookmark);
    });
    
    console.log('\n4. Summary by book:');
    Object.entries(bookmarksByBook).forEach(([bookId, bookmarks]) => {
      const firstBookmark = bookmarks[0];
      console.log(`"${firstBookmark.book_title}": ${bookmarks.length} bookmarks`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testCollectionEndpoint();