const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);
  
  try {
    console.log('Applying migration: 0011_add_activity_feed\n');
    console.log('Database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0011_add_activity_feed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Migration SQL:');
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));
    console.log('\nExecuting migration...\n');
    
    // Execute the entire SQL as a single transaction
    try {
      await pool.query(migrationSQL);
      console.log('✓ All migration statements executed successfully\n');
    } catch (err) {
      console.error('✗ Migration failed:', err.message);
      throw err;
    }
    
    console.log('\n✓ Migration applied successfully!\n');
    
    // Verify the table was created
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'activity_feed'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✓ Table verified: activity_feed exists');
    } else {
      console.log('⚠ Warning: activity_feed table not found in database');
    }
    
    // Check indexes
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'activity_feed'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log(`\n✓ Indexes created (${indexCheck.rows.length}):`);
      indexCheck.rows.forEach(row => console.log(`  - ${row.indexname}`));
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
