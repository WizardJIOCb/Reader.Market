/**
 * Apply Collection Books Relationship Migration
 * 
 * This script applies the collection-books relationship migration.
 * 
 * Usage: node apply_collection_books_migration.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbConnectionUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!dbConnectionUrl) {
  console.error('❌ Error: No database connection string found.');
  process.exit(1);
}

async function applyMigration() {
  const pool = new Pool({
    connectionString: dbConnectionUrl,
    ssl: dbConnectionUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Applying Collection Books Relationship Migration\n');
    console.log('Database:', dbConnectionUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', '0030_add_collection_books_relationship.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Step 1: Loaded migration SQL file\n');

    // Apply the migration
    console.log('Step 2: Applying migration...');
    await pool.query(migrationSql);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify tables were created
    console.log('Step 3: Verifying tables...');
    const verifyTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'collection_books'
    `);

    if (verifyTable.rows.length > 0) {
      console.log('✅ collection_books table successfully created!');
      
      // Check if data was migrated
      const dataCheck = await pool.query(`
        SELECT COUNT(*) as count FROM collection_books
      `);
      console.log(`   Records in collection_books: ${dataCheck.rows[0].count}`);
    } else {
      console.log('⚠️  Could not verify collection_books table.\n');
    }

    console.log('='.repeat(80));
    console.log('✅ COLLECTION BOOKS MIGRATION COMPLETED!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Update API endpoints to use collection_books table');
    console.log('   2. Update frontend to handle multiple books per collection');
    console.log('   3. Test collection editing with multiple books\n');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();