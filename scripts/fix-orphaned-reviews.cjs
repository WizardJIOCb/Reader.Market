const { Client } = require('pg');

async function fixOrphanedReviews() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check for orphaned parent_review_id references
    const orphanedCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM reviews 
      WHERE parent_review_id IS NOT NULL 
      AND parent_review_id NOT IN (SELECT id FROM reviews)
    `);

    console.log(`Found ${orphanedCount.rows[0].count} orphaned parent_review_id references`);

    if (orphanedCount.rows[0].count > 0) {
      // Clear the invalid parent_review_id values
      const result = await client.query(`
        UPDATE reviews 
        SET parent_review_id = NULL 
        WHERE parent_review_id IS NOT NULL 
        AND parent_review_id NOT IN (SELECT id FROM reviews)
      `);
      
      console.log(`Fixed ${result.rowCount} orphaned references by setting parent_review_id to NULL`);
    }

    console.log('Database cleanup completed successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

fixOrphanedReviews();