/**
 * Server Migration Status Checker
 * 
 * This script checks which migrations have been applied to the production database
 * and identifies if migration 0007 is missing.
 * 
 * Usage: node check_server_migrations.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production DATABASE_URL from environment or command line
const DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function checkMigrations() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking Server Migration Status\n');
    console.log('Database:', DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if migrations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_drizzle_migrations'
      ) as exists
    `;

    const tableExists = await pool.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Migration tracking table "_drizzle_migrations" does not exist!');
      console.log('This database may not have been initialized with Drizzle migrations.\n');
      process.exit(1);
    }

    // Get all applied migrations
    const migrationsQuery = `
      SELECT idx, hash, created_at
      FROM _drizzle_migrations
      ORDER BY idx
    `;

    const result = await pool.query(migrationsQuery);

    if (result.rows.length === 0) {
      console.log('⚠️  No migrations found in database.\n');
    } else {
      console.log(`Found ${result.rows.length} applied migrations:\n`);
      result.rows.forEach(row => {
        const date = new Date(parseInt(row.created_at));
        console.log(`  [${row.idx}] ${row.hash}`);
        console.log(`       Applied: ${date.toISOString()}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    // Check specifically for migration 0007
    const migration0007Query = `
      SELECT * FROM _drizzle_migrations 
      WHERE hash LIKE '%0007%' OR hash LIKE '%unique_constraint_book_view%'
    `;

    const migration0007 = await pool.query(migration0007Query);

    if (migration0007.rows.length > 0) {
      console.log('\n✅ Migration 0007 (unique constraint) HAS BEEN APPLIED');
      console.log('   The constraint should exist in the database.\n');
      console.log('If the endpoint is still failing, run:');
      console.log('   node check_server_constraint.cjs\n');
    } else {
      console.log('\n❌ Migration 0007 (unique constraint) NOT FOUND');
      console.log('   This migration needs to be applied!\n');
      console.log('📋 Next Steps:');
      console.log('  1. Check for duplicates: node check_server_duplicates.cjs');
      console.log('  2. Apply migration: node apply_server_migration.cjs');
      console.log('  3. Restart application: pm2 restart ollama-reader\n');
    }

    // List expected migrations
    console.log('Expected migrations:');
    const expectedMigrations = [
      '0000_green_impossible_man',
      '0001_add_book_dates',
      '0002_update_book_rating_precision',
      '0003_add-messages-and-conversations',
      '0004_add-book-view-statistics',
      '0005_windy_misty_knight',
      '0006_bent_plazm',
      '0007_add_unique_constraint_book_view_statistics',
      '0008_add_messaging_system',
      '0009_add_user_language_preference'
    ];

    expectedMigrations.forEach((migration, idx) => {
      const applied = result.rows.some(row => row.hash.includes(migration.split('_').slice(1).join('_')));
      const status = applied ? '✅' : '❌';
      console.log(`  ${status} ${migration}`);
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error checking migrations:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMigrations();
/**
 * Server Migration Status Checker
 * 
 * This script checks which migrations have been applied to the production database
 * and identifies if migration 0007 is missing.
 * 
 * Usage: node check_server_migrations.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production DATABASE_URL from environment or command line
const DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function checkMigrations() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking Server Migration Status\n');
    console.log('Database:', DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if migrations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_drizzle_migrations'
      ) as exists
    `;

    const tableExists = await pool.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Migration tracking table "_drizzle_migrations" does not exist!');
      console.log('This database may not have been initialized with Drizzle migrations.\n');
      process.exit(1);
    }

    // Get all applied migrations
    const migrationsQuery = `
      SELECT idx, hash, created_at
      FROM _drizzle_migrations
      ORDER BY idx
    `;

    const result = await pool.query(migrationsQuery);

    if (result.rows.length === 0) {
      console.log('⚠️  No migrations found in database.\n');
    } else {
      console.log(`Found ${result.rows.length} applied migrations:\n`);
      result.rows.forEach(row => {
        const date = new Date(parseInt(row.created_at));
        console.log(`  [${row.idx}] ${row.hash}`);
        console.log(`       Applied: ${date.toISOString()}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    // Check specifically for migration 0007
    const migration0007Query = `
      SELECT * FROM _drizzle_migrations 
      WHERE hash LIKE '%0007%' OR hash LIKE '%unique_constraint_book_view%'
    `;

    const migration0007 = await pool.query(migration0007Query);

    if (migration0007.rows.length > 0) {
      console.log('\n✅ Migration 0007 (unique constraint) HAS BEEN APPLIED');
      console.log('   The constraint should exist in the database.\n');
      console.log('If the endpoint is still failing, run:');
      console.log('   node check_server_constraint.cjs\n');
    } else {
      console.log('\n❌ Migration 0007 (unique constraint) NOT FOUND');
      console.log('   This migration needs to be applied!\n');
      console.log('📋 Next Steps:');
      console.log('  1. Check for duplicates: node check_server_duplicates.cjs');
      console.log('  2. Apply migration: node apply_server_migration.cjs');
      console.log('  3. Restart application: pm2 restart ollama-reader\n');
    }

    // List expected migrations
    console.log('Expected migrations:');
    const expectedMigrations = [
      '0000_green_impossible_man',
      '0001_add_book_dates',
      '0002_update_book_rating_precision',
      '0003_add-messages-and-conversations',
      '0004_add-book-view-statistics',
      '0005_windy_misty_knight',
      '0006_bent_plazm',
      '0007_add_unique_constraint_book_view_statistics',
      '0008_add_messaging_system',
      '0009_add_user_language_preference'
    ];

    expectedMigrations.forEach((migration, idx) => {
      const applied = result.rows.some(row => row.hash.includes(migration.split('_').slice(1).join('_')));
      const status = applied ? '✅' : '❌';
      console.log(`  ${status} ${migration}`);
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error checking migrations:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMigrations();
