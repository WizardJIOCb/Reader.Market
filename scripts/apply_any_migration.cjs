const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const migrationName = process.argv[2];
  
  if (!migrationName) {
    console.error('Usage: node apply_any_migration.cjs <migration_filename>');
    console.error('Example: node apply_any_migration.cjs 0026_add_bookmark_collections.sql');
    process.exit(1);
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);
  
  try {
    console.log(`Applying migration: ${migrationName}\n`);
    console.log('Database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationName);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
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
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();