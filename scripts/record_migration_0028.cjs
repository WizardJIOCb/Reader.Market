const { Pool } = require('pg');

async function recordMigration() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });

  try {
    await pool.query(`
      INSERT INTO _drizzle_migrations (hash, created_at) 
      VALUES ('0028_add_book_id_to_bookmark_collections', ${Date.now()})
      ON CONFLICT (hash) DO NOTHING
    `);
    console.log('Migration 0028 recorded successfully');
  } catch (error) {
    console.error('Error recording migration:', error);
  } finally {
    await pool.end();
  }
}

recordMigration();