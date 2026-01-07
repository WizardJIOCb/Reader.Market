/**
 * Server Duplicate Records Checker
 * 
 * This script checks if there are duplicate records in the book_view_statistics table
 * that would prevent adding the unique constraint.
 * 
 * Usage: node check_server_duplicates.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production DATABASE_URL from environment or command line
const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function checkDuplicates() {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking for Duplicate Records\n');
    console.log('Database:', dbUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'book_view_statistics'
      ) as exists
    `;

    const tableExists = await pool.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Table "book_view_statistics" does not exist!\n');
      process.exit(1);
    }

    // Check for duplicates
    const duplicatesQuery = `
      SELECT 
        book_id, 
        view_type, 
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id) as record_ids,
        ARRAY_AGG(view_count) as view_counts
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `;

    const result = await pool.query(duplicatesQuery);

    if (result.rows.length === 0) {
      console.log('✅ No duplicate records found!');
      console.log('   Safe to apply the unique constraint migration.\n');
      console.log('📋 Next Step:');
      console.log('   Apply migration: node apply_server_migration.cjs\n');
    } else {
      console.log(`⚠️  Found ${result.rows.length} duplicate record groups:\n`);
      
      result.rows.forEach((row, idx) => {
        console.log(`Duplicate Group ${idx + 1}:`);
        console.log(`  Book ID: ${row.book_id}`);
        console.log(`  View Type: ${row.view_type}`);
        console.log(`  Duplicate Count: ${row.duplicate_count}`);
        console.log(`  Record IDs: ${row.record_ids.join(', ')}`);
        console.log(`  View Counts: ${row.view_counts.join(', ')}`);
        console.log(`  Total Views: ${row.view_counts.reduce((a, b) => a + b, 0)}`);
        console.log('');
      });

      console.log('📋 Migration will automatically consolidate duplicates:');
      console.log('  - Sum up view counts from duplicate records');
      console.log('  - Keep the latest timestamp');
      console.log('  - Delete duplicate entries');
      console.log('  - Add unique constraint\n');
      console.log('It is SAFE to proceed with migration.');
      console.log('Run: node apply_server_migration.cjs\n');
    }

    // Show total record count
    const countQuery = 'SELECT COUNT(*) as total FROM book_view_statistics';
    const countResult = await pool.query(countQuery);
    console.log(`Total records in book_view_statistics: ${countResult.rows[0].total}`);

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error checking duplicates:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDuplicates();
/**
 * Server Duplicate Records Checker
 * 
 * This script checks if there are duplicate records in the book_view_statistics table
 * that would prevent adding the unique constraint.
 * 
 * Usage: node check_server_duplicates.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production DATABASE_URL from environment or command line
const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function checkDuplicates() {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking for Duplicate Records\n');
    console.log('Database:', dbUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'book_view_statistics'
      ) as exists
    `;

    const tableExists = await pool.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Table "book_view_statistics" does not exist!\n');
      process.exit(1);
    }

    // Check for duplicates
    const duplicatesQuery = `
      SELECT 
        book_id, 
        view_type, 
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id) as record_ids,
        ARRAY_AGG(view_count) as view_counts
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `;

    const result = await pool.query(duplicatesQuery);

    if (result.rows.length === 0) {
      console.log('✅ No duplicate records found!');
      console.log('   Safe to apply the unique constraint migration.\n');
      console.log('📋 Next Step:');
      console.log('   Apply migration: node apply_server_migration.cjs\n');
    } else {
      console.log(`⚠️  Found ${result.rows.length} duplicate record groups:\n`);
      
      result.rows.forEach((row, idx) => {
        console.log(`Duplicate Group ${idx + 1}:`);
        console.log(`  Book ID: ${row.book_id}`);
        console.log(`  View Type: ${row.view_type}`);
        console.log(`  Duplicate Count: ${row.duplicate_count}`);
        console.log(`  Record IDs: ${row.record_ids.join(', ')}`);
        console.log(`  View Counts: ${row.view_counts.join(', ')}`);
        console.log(`  Total Views: ${row.view_counts.reduce((a, b) => a + b, 0)}`);
        console.log('');
      });

      console.log('📋 Migration will automatically consolidate duplicates:');
      console.log('  - Sum up view counts from duplicate records');
      console.log('  - Keep the latest timestamp');
      console.log('  - Delete duplicate entries');
      console.log('  - Add unique constraint\n');
      console.log('It is SAFE to proceed with migration.');
      console.log('Run: node apply_server_migration.cjs\n');
    }

    // Show total record count
    const countQuery = 'SELECT COUNT(*) as total FROM book_view_statistics';
    const countResult = await pool.query(countQuery);
    console.log(`Total records in book_view_statistics: ${countResult.rows[0].total}`);

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error checking duplicates:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDuplicates();
