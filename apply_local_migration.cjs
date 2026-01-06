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
    console.log('Applying migration: 0007_add_unique_constraint_book_view_statistics\n');
    console.log('Database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0007_add_unique_constraint_book_view_statistics.sql');
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
    
    // Verify the constraint was created
    const constraintCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
      AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✓ Constraint verified:');
      console.table(constraintCheck.rows);
    } else {
      console.log('⚠ Warning: Constraint not found in database');
    }
    
    // Check for any remaining duplicates
    const duplicateCheck = await pool.query(`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.rows.length === 0) {
      console.log('\n✓ No duplicates found');
    } else {
      console.log('\n⚠ Warning: Duplicates still exist:');
      console.table(duplicateCheck.rows);
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
