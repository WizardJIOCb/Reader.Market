const { Pool } = require('pg');

async function createTestData() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    
    console.log('=== CREATING TEST DATA ===\n');
    
    // Create a new test collection
    console.log('1. Creating test collection...');
    const newCollection = await pool.query(`
      INSERT INTO bookmark_collections (user_id, name, description, color, is_public)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description
    `, [userId, 'Test Collection with Multiple Books', 'A test collection to verify multiple book functionality', '#84cc16', false]);
    
    const collectionId = newCollection.rows[0].id;
    console.log(`Created collection: "${newCollection.rows[0].name}" (ID: ${collectionId})`);
    
    // Get some books to associate with the collection
    console.log('\n2. Getting books for association...');
    const books = await pool.query(`
      SELECT id, title, author
      FROM books
      WHERE id IN ('4f9af291-1f3e-4b47-ad87-47216516bf3b', '7fc478fb-a828-43a8-b2b2-eae408f979ef')
    `);
    
    console.log(`Found ${books.rowCount} books:`);
    books.rows.forEach((book, index) => {
      console.log(`${index + 1}. "${book.title}" by ${book.author} (ID: ${book.id})`);
    });
    
    // Associate books with the collection
    console.log('\n3. Associating books with collection...');
    for (const book of books.rows) {
      await pool.query(`
        INSERT INTO collection_books (collection_id, book_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [collectionId, book.id]);
      console.log(`Associated "${book.title}" with collection`);
    }
    
    // Get some bookmarks to add to the collection
    console.log('\n4. Adding bookmarks to collection...');
    const bookmarks = await pool.query(`
      SELECT b.id, b.title, bk.title as book_title
      FROM bookmarks b
      JOIN books bk ON b.book_id = bk.id
      WHERE b.user_id = $1
      AND b.book_id IN ('4f9af291-1f3e-4b47-ad87-47216516bf3b', '7fc478fb-a828-43a8-b2b2-eae408f979ef')
      LIMIT 5
    `, [userId]);
    
    console.log(`Found ${bookmarks.rowCount} bookmarks to add:`);
    for (const bookmark of bookmarks.rows) {
      await pool.query(`
        INSERT INTO bookmark_collection_items (collection_id, bookmark_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [collectionId, bookmark.id]);
      console.log(`Added bookmark "${bookmark.title}" from "${bookmark.book_title}"`);
    }
    
    // Verify the collection data
    console.log('\n5. Verifying collection data...');
    const finalCollection = await pool.query(`
      SELECT bc.*,
             COUNT(bci.id) as bookmark_count,
             COUNT(DISTINCT cb.book_id) as book_count
      FROM bookmark_collections bc
      LEFT JOIN bookmark_collection_items bci ON bc.id = bci.collection_id
      LEFT JOIN collection_books cb ON bc.id = cb.collection_id
      WHERE bc.id = $1
      GROUP BY bc.id, bc.name, bc.description, bc.color, bc.is_public, bc.book_id, bc.view_count, bc.created_at, bc.updated_at
    `, [collectionId]);
    
    if (finalCollection.rows.length > 0) {
      const coll = finalCollection.rows[0];
      console.log(`Collection "${coll.name}":`);
      console.log(`- Description: ${coll.description}`);
      console.log(`- Bookmarks: ${coll.bookmark_count}`);
      console.log(`- Associated Books: ${coll.book_count}`);
      console.log(`- Collection ID: ${coll.id}`);
    }
    
    console.log('\nTest data creation completed successfully!');
    console.log(`You can now test the collection at: http://localhost:3001/collections/${collectionId}/edit`);
    
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await pool.end();
  }
}

createTestData();