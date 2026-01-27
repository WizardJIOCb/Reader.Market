const { Pool } = require('pg');

async function checkMigration() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    // Check if view_count column exists in bookmark_collections
    const viewCountResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmark_collections' 
      AND column_name = 'view_count'
    `);
    
    console.log('view_count column exists:', viewCountResult.rows.length > 0);
    
    // Check if click_count column exists in bookmarks
    const clickCountResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' 
      AND column_name = 'click_count'
    `);
    
    console.log('click_count column exists:', clickCountResult.rows.length > 0);
    
    // Check sample data
    if (viewCountResult.rows.length > 0) {
      const sampleCollections = await pool.query(`
        SELECT id, name, view_count 
        FROM bookmark_collections 
        LIMIT 3
      `);
      console.log('Sample collections with view counts:', sampleCollections.rows);
    }
    
    if (clickCountResult.rows.length > 0) {
      const sampleBookmarks = await pool.query(`
        SELECT id, title, click_count 
        FROM bookmarks 
        LIMIT 3
      `);
      console.log('Sample bookmarks with click counts:', sampleBookmarks.rows);
    }
    
  } catch (error) {
    console.error('Error checking migration:', error);
  } finally {
    await pool.end();
  }
}

checkMigration();