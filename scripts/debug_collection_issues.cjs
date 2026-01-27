const { Pool } = require('pg');

async function debugCollectionIssues() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const collectionId = '293d5da7-f55b-4dd7-9185-1619e3efd8f7';
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    console.log('=== DEBUGGING COLLECTION ISSUES ===\n');
    
    // Check all bookmarks for this user
    console.log('1. All bookmarks for user:');
    const userBookmarks = await pool.query(`
      SELECT b.*, bk.title as book_title, bk.author
      FROM bookmarks b
      JOIN books bk ON b.book_id = bk.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
    
    console.log(`Found ${userBookmarks.rowCount} bookmarks:`);
    userBookmarks.rows.forEach((bookmark, index) => {
      console.log(`${index + 1}. "${bookmark.title}" in "${bookmark.book_title}" (ID: ${bookmark.id})`);
    });
    
    console.log('\n2. Bookmark collection items for this collection:');
    const collectionItems = await pool.query(`
      SELECT bc.*, b.title as bookmark_title
      FROM bookmark_collection_items bc
      JOIN bookmarks b ON bc.bookmark_id = b.id
      WHERE bc.collection_id = $1
    `, [collectionId]);
    
    console.log(`Found ${collectionItems.rowCount} items:`);
    collectionItems.rows.forEach((item, index) => {
      console.log(`${index + 1}. Bookmark ID: ${item.bookmark_id}, Title: "${item.bookmark_title}"`);
    });
    
    console.log('\n3. Checking if user bookmarks are in any collections:');
    const bookmarkCollections = await pool.query(`
      SELECT bc.collection_id, c.name, b.id as bookmark_id, b.title as bookmark_title
      FROM bookmark_collection_items bc
      JOIN bookmark_collections c ON bc.collection_id = c.id
      JOIN bookmarks b ON bc.bookmark_id = b.id
      WHERE b.user_id = $1
    `, [userId]);
    
    console.log(`Found ${bookmarkCollections.rowCount} bookmark-collection associations:`);
    bookmarkCollections.rows.forEach((assoc, index) => {
      console.log(`${index + 1}. Collection: "${assoc.name}" (ID: ${assoc.collection_id})`);
      console.log(`    Bookmark: "${assoc.bookmark_title}" (ID: ${assoc.bookmark_id})`);
    });
    
    console.log('\n4. Collection details:');
    const collection = await pool.query(`
      SELECT *
      FROM bookmark_collections
      WHERE id = $1
    `, [collectionId]);
    
    if (collection.rows.length > 0) {
      const coll = collection.rows[0];
      console.log(`Name: ${coll.name}`);
      console.log(`Description: ${coll.description}`);
      console.log(`Book ID (deprecated): ${coll.book_id}`);
      console.log(`User ID: ${coll.user_id}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugCollectionIssues();