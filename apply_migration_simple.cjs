/**
 * Simple Server Migration Script - No Migration Tracking Required
 * 
 * This script applies migration 0007 without requiring _drizzle_migrations table.
 * Use this if your server doesn't have migration tracking set up yet.
 * 
 * Usage: node apply_migration_simple.cjs
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
    console.log('🚀 Applying Migration 0007\n');
    console.log('Database:', dbConnectionUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if constraint already exists
    console.log('Step 1: Checking if constraint already exists...');
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Constraint already exists! No migration needed.\n');
      await pool.end();
      return;
    }
    console.log('   Constraint does not exist. Proceeding...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0007_add_unique_constraint_book_view_statistics.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Step 2: Loaded migration SQL file\n');

    // Apply the migration
    console.log('Step 3: Applying migration...');
    await pool.query(migrationSql);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify constraint was created
    console.log('Step 4: Verifying constraint...');
    const verifyConstraint = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);

    if (verifyConstraint.rows.length > 0) {
      console.log('✅ Constraint successfully created!');
      console.log(`   Name: ${verifyConstraint.rows[0].constraint_name}`);
      console.log(`   Type: ${verifyConstraint.rows[0].constraint_type}\n`);
    } else {
      console.log('⚠️  Could not verify constraint.\n');
    }

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETED!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart: pm2 restart ollama-reader');
    console.log('   2. Test: POST /api/books/{id}/track-view');
    console.log('   3. Expected: {"success": true}\n');
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
/**
 * Simple Server Migration Script - No Migration Tracking Required
 * 
 * This script applies migration 0007 without requiring _drizzle_migrations table.
 * Use this if your server doesn't have migration tracking set up yet.
 * 
 * Usage: node apply_migration_simple.cjs
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
    console.log('🚀 Applying Migration 0007\n');
    console.log('Database:', dbConnectionUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if constraint already exists
    console.log('Step 1: Checking if constraint already exists...');
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Constraint already exists! No migration needed.\n');
      await pool.end();
      return;
    }
    console.log('   Constraint does not exist. Proceeding...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0007_add_unique_constraint_book_view_statistics.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Step 2: Loaded migration SQL file\n');

    // Apply the migration
    console.log('Step 3: Applying migration...');
    await pool.query(migrationSql);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify constraint was created
    console.log('Step 4: Verifying constraint...');
    const verifyConstraint = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);

    if (verifyConstraint.rows.length > 0) {
      console.log('✅ Constraint successfully created!');
      console.log(`   Name: ${verifyConstraint.rows[0].constraint_name}`);
      console.log(`   Type: ${verifyConstraint.rows[0].constraint_type}\n`);
    } else {
      console.log('⚠️  Could not verify constraint.\n');
    }

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETED!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart: pm2 restart ollama-reader');
    console.log('   2. Test: POST /api/books/{id}/track-view');
    console.log('   3. Expected: {"success": true}\n');
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
