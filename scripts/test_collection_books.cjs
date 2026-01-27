const { Pool } = require('pg');

async function testCollectionData() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const collectionId = '293d5da7-f55b-4dd7-9185-1619e3efd8f7';
    
    console.log('=== TESTING COLLECTION DATA ===\n');
    
    // Test the collection_books table
    console.log('1. Checking collection_books table:');
    const collectionBooksResult = await pool.query(`
      SELECT cb.*, b.title, b.author
      FROM collection_books cb
      JOIN books b ON cb.book_id = b.id
      WHERE cb.collection_id = $1
    `, [collectionId]);
    
    console.log(`Found ${collectionBooksResult.rowCount} books in collection_books table:`);
    collectionBooksResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Book: ${row.title} by ${row.author}`);
    });
    
    console.log('\n2. Checking bookmarks in collection:');
    const bookmarksResult = await pool.query(`
      SELECT bc.*, b.title as bookmark_title, bk.title as book_title, bk.author
      FROM bookmark_collection_items bc
      JOIN bookmarks b ON bc.bookmark_id = b.id
      JOIN books bk ON b.book_id = bk.id
      WHERE bc.collection_id = $1
      ORDER BY bc.added_at
    `, [collectionId]);
    
    console.log(`Found ${bookmarksResult.rowCount} bookmarks in collection:`);
    const booksWithBookmarks = {};
    bookmarksResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Bookmark: "${row.bookmark_title}" in book "${row.book_title}"`);
      if (!booksWithBookmarks[row.book_id]) {
        booksWithBookmarks[row.book_id] = {
          title: row.book_title,
          author: row.author,
          bookmarkCount: 0
        };
      }
      booksWithBookmarks[row.book_id].bookmarkCount++;
    });
    
    console.log('\n3. Books with bookmark counts:');
    Object.entries(booksWithBookmarks).forEach(([bookId, data]) => {
      console.log(`- ${data.title} by ${data.author}: ${data.bookmarkCount} bookmarks`);
    });
    
    console.log('\n4. Checking collection details:');
    const collectionResult = await pool.query(`
      SELECT *
      FROM bookmark_collections
      WHERE id = $1
    `, [collectionId]);
    
    if (collectionResult.rows.length > 0) {
      const collection = collectionResult.rows[0];
      console.log(`Collection: ${collection.name}`);
      console.log(`Description: ${collection.description}`);
      console.log(`Book ID (deprecated): ${collection.book_id}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testCollectionData();