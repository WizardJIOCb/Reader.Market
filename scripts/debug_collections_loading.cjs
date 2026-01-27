// Test script to verify the collections API endpoint directly
const { Pool } = require('pg');

async function testCollectionsApiDirectly() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    const bookId = '4f9af291-1f3e-4b47-ad87-47216516bf3b';
    
    console.log('=== Testing Collections API Directly ===');
    console.log('Book ID:', bookId);
    
    // Test the exact query that the API endpoint should be running
    console.log('\n--- Query 1: Collections with bookmarks for this book ---');
    const collectionsWithBookmarks = await pool.query(`
      SELECT DISTINCT 
        bc.id,
        bc.name,
        bc.description,
        bc.color,
        bc.is_public,
        bc.book_id,
        bc.created_at,
        bc.updated_at,
        u.id as owner_id,
        u.username as owner_username,
        u.full_name as owner_full_name,
        u.avatar_url as owner_avatar_url,
        u.profile_rating as owner_profile_rating
      FROM bookmark_collections bc
      INNER JOIN bookmark_collection_items bci ON bc.id = bci.collection_id
      INNER JOIN bookmarks b ON bci.bookmark_id = b.id
      LEFT JOIN users u ON bc.user_id = u.id
      WHERE b.book_id = $1
        AND bc.user_id = '88d59974-6b3f-48c7-b36a-3c1747c12333'
    `, [bookId]);
    
    console.log('Collections with bookmarks found:', collectionsWithBookmarks.rows.length);
    collectionsWithBookmarks.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (ID: ${row.id})`);
      console.log(`   Owner: ${row.owner_username}`);
    });
    
    console.log('\n--- Query 2: Collections specifically linked to this book ---');
    const collectionsForBook = await pool.query(`
      SELECT 
        bc.id,
        bc.name,
        bc.description,
        bc.color,
        bc.is_public,
        bc.book_id,
        bc.created_at,
        bc.updated_at,
        u.id as owner_id,
        u.username as owner_username,
        u.full_name as owner_full_name,
        u.avatar_url as owner_avatar_url,
        u.profile_rating as owner_profile_rating
      FROM bookmark_collections bc
      LEFT JOIN users u ON bc.user_id = u.id
      WHERE bc.book_id = $1
        AND bc.user_id = '88d59974-6b3f-48c7-b36a-3c1747c12333'
    `, [bookId]);
    
    console.log('Collections linked to book found:', collectionsForBook.rows.length);
    collectionsForBook.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (ID: ${row.id})`);
      console.log(`   Owner: ${row.owner_username}`);
    });
    
    console.log('\n--- Query 3: Public collections from other users ---');
    const publicCollectionsFromOthers = await pool.query(`
      SELECT DISTINCT 
        bc.id,
        bc.name,
        bc.description,
        bc.color,
        bc.is_public,
        bc.book_id,
        bc.created_at,
        bc.updated_at,
        u.id as owner_id,
        u.username as owner_username,
        u.full_name as owner_full_name,
        u.avatar_url as owner_avatar_url,
        u.profile_rating as owner_profile_rating
      FROM bookmark_collections bc
      INNER JOIN collection_books cb ON bc.id = cb.collection_id
      LEFT JOIN users u ON bc.user_id = u.id
      WHERE cb.book_id = $1
        AND bc.is_public = true
        AND bc.user_id != '88d59974-6b3f-48c7-b36a-3c1747c12333'
    `, [bookId]);
    
    console.log('Public collections from others found:', publicCollectionsFromOthers.rows.length);
    publicCollectionsFromOthers.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (ID: ${row.id})`);
      console.log(`   Owner: ${row.owner_username}`);
    });
    
    // Total combined result
    const totalCollections = [
      ...collectionsWithBookmarks.rows,
      ...collectionsForBook.rows,
      ...publicCollectionsFromOthers.rows
    ];
    
    // Remove duplicates
    const uniqueCollections = Array.from(
      new Map(totalCollections.map(item => [item.id, item])).values()
    );
    
    console.log('\n=== TOTAL RESULT ===');
    console.log('Total unique collections found:', uniqueCollections.length);
    
    if (uniqueCollections.length === 0) {
      console.log('\n⚠️  NO COLLECTIONS FOUND!');
      console.log('This explains why the search shows "Collections not found"');
      console.log('Possible reasons:');
      console.log('1. No collections exist for this book');
      console.log('2. Database query is not working correctly');
      console.log('3. User ID mismatch in the query');
    } else {
      console.log('\n✅ Collections found - search should work!');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

testCollectionsApiDirectly();