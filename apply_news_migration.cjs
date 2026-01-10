/**
 * News Migration Application Script
 * 
 * This script applies migration 0009 to add view_count, comment_count, and reaction_count columns to news table,
 * and adds news_id column to comments and reactions tables.
 * 
 * Usage: node apply_news_migration.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use production DATABASE_URL from environment or command line
const serverDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!serverDbUrl) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function applyNewsMigration() {
  const pool = new Pool({
    connectionString: serverDbUrl,
    ssl: serverDbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Applying Migration 0009 to Server Database\n');
    console.log('Database:', serverDbUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));
    console.log('⚠️  IMPORTANT: This will modify the database schema!');
    console.log('   Please ensure you have a recent backup.\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0009_add-news-view-and-stats-columns.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      console.error('   Make sure you are running this script from the project root directory.');
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded:', migrationPath, '\n');

    // Apply the migration
    console.log('Step 1: Applying migration SQL...');
    console.log('   This may take a few seconds...\n');

    await pool.query(migrationSql);

    console.log('✅ Migration SQL executed successfully!\n');

    console.log('✅ Migration completed successfully!\n');

    console.log('='.repeat(80));
    console.log('✅ NEWS MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart application: pm2 restart ollama-reader');
    console.log('   2. The news table now has view_count, comment_count, and reaction_count columns');
    console.log('   3. Comments table now supports news comments via news_id column');
    console.log('   4. Reactions table now supports news reactions via news_id column\n');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR applying migration:', error.message);
    console.error('\nFull error:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Check database connection string');
    console.error('   - Verify database user has ALTER TABLE permissions');
    console.error('   - Check PostgreSQL logs for more details');
    console.error('   - Consider applying migration manually via psql\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyNewsMigration();