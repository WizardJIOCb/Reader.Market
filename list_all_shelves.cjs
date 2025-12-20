const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function listAllShelves() {
  let client;
  try {
    client = await pool.connect();
    
    // List all shelves
    console.log('Listing all shelves in database...');
    const allShelvesResult = await client.query('SELECT * FROM shelves ORDER BY created_at DESC');
    console.log(`Total shelves found: ${allShelvesResult.rows.length}`);
    
    allShelvesResult.rows.forEach((shelf, index) => {
      console.log(`${index + 1}. Shelf ID: ${shelf.id}`);
      console.log(`   Name: ${shelf.name}`);
      console.log(`   User ID: ${shelf.user_id}`);
      console.log(`   Created: ${shelf.created_at}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

listAllShelves();