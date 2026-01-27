const { Pool } = require('pg');

async function checkAndApplyMigration() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });

  try {
    // Check if collection_books table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'collection_books'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ collection_books table already exists');
      
      // Check if data migration was done
      const dataCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM collection_books
      `);
      
      console.log(`Found ${dataCheck.rows[0].count} records in collection_books table`);
      
      if (dataCheck.rows[0].count === '0') {
        console.log('Migrating existing data...');
        // Migrate existing data from bookmark_collections.book_id to collection_books
        const migrateResult = await pool.query(`
          INSERT INTO collection_books (collection_id, book_id, added_at)
          SELECT id, book_id, created_at
          FROM bookmark_collections
          WHERE book_id IS NOT NULL
          ON CONFLICT (collection_id, book_id) DO NOTHING
        `);
        console.log('✅ Data migration completed');
      }
    } else {
      console.log('❌ collection_books table does not exist, applying migration...');
      
      // Apply the migration
      await pool.query(`
        CREATE TABLE collection_books (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          collection_id VARCHAR NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
          book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          added_at TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE(collection_id, book_id)
        )
      `);
      
      console.log('✅ collection_books table created');
      
      // Create indexes
      await pool.query(`
        CREATE INDEX idx_collection_books_collection_id ON collection_books(collection_id)
      `);
      await pool.query(`
        CREATE INDEX idx_collection_books_book_id ON collection_books(book_id)
      `);
      
      console.log('✅ Indexes created');
      
      // Migrate existing data
      const migrateResult = await pool.query(`
        INSERT INTO collection_books (collection_id, book_id, added_at)
        SELECT id, book_id, created_at
        FROM bookmark_collections
        WHERE book_id IS NOT NULL
        ON CONFLICT (collection_id, book_id) DO NOTHING
      `);
      
      console.log('✅ Data migration completed');
    }
    
    // Update the deprecated comment
    await pool.query(`
      COMMENT ON COLUMN bookmark_collections.book_id IS 'Deprecated: Use collection_books table instead'
    `);
    
    console.log('✅ Migration fully applied!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await pool.end();
  }
}

checkAndApplyMigration();