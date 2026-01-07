/**
 * Comprehensive Server Diagnostic Script
 * 
 * This script performs a complete diagnostic check of the server database
 * to identify why the track-view endpoint is failing.
 * 
 * Usage: node diagnose_server_track_view.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production DATABASE_URL from environment or command line
const prodDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!prodDbUrl) {
  console.error('❌ Error: No database connection string found.');
  console.error('Set PROD_DATABASE_URL environment variable or update DATABASE_URL in .env');
  process.exit(1);
}

async function diagnoseServer() {
  const pool = new Pool({
    connectionString: prodDbUrl,
    ssl: prodDbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  const issues = [];
  const recommendations = [];

  try {
    console.log('🔍 COMPREHENSIVE SERVER DIAGNOSTIC\n');
    console.log('Database:', prodDbUrl.replace(/:[^:]*@/, ':****@'));
    console.log('Time:', new Date().toISOString());
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    console.log('-'.repeat(40));
    try {
      const result = await pool.query('SELECT version()');
      console.log('✅ Connection successful');
      console.log(`   PostgreSQL Version: ${result.rows[0].version.split(',')[0]}\n`);
    } catch (error) {
      console.log('❌ Connection failed:', error.message, '\n');
      issues.push('Database connection failed');
      recommendations.push('Check DATABASE_URL and network connectivity');
    }

    // Test 2: Table Existence
    console.log('Test 2: Table Existence');
    console.log('-'.repeat(40));
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'book_view_statistics'
      ) as exists
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Table "book_view_statistics" exists\n');
    } else {
      console.log('❌ Table "book_view_statistics" does NOT exist\n');
      issues.push('Table book_view_statistics missing');
      recommendations.push('Run migration 0004 to create the table');
    }

    // Test 3: Unique Constraint Check
    console.log('Test 3: Unique Constraint Check');
    console.log('-'.repeat(40));
    const constraintCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Unique constraint EXISTS');
      console.log(`   Name: ${constraintCheck.rows[0].constraint_name}`);
      console.log(`   Type: ${constraintCheck.rows[0].constraint_type}\n`);
    } else {
      console.log('❌ Unique constraint MISSING');
      console.log('   This is the root cause of the track-view endpoint failure!\n');
      issues.push('Required unique constraint missing on book_view_statistics');
      recommendations.push('Apply migration 0007: node apply_server_migration.cjs');
    }

    // Test 4: Duplicate Records Check
    console.log('Test 4: Duplicate Records Check');
    console.log('-'.repeat(40));
    const duplicatesCheck = await pool.query(`
      SELECT 
        book_id, 
        view_type, 
        COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `);

    if (duplicatesCheck.rows.length === 0) {
      console.log('✅ No duplicate records found\n');
    } else {
      console.log(`⚠️  Found ${duplicatesCheck.rows.length} duplicate groups`);
      duplicatesCheck.rows.slice(0, 5).forEach(row => {
        console.log(`   - Book ${row.book_id.substring(0, 8)}..., ${row.view_type}: ${row.count} duplicates`);
      });
      if (duplicatesCheck.rows.length > 5) {
        console.log(`   ... and ${duplicatesCheck.rows.length - 5} more`);
      }
      console.log('');
      issues.push(`${duplicatesCheck.rows.length} duplicate record groups found`);
      recommendations.push('Migration 0007 will consolidate duplicates automatically');
    }

    // Test 5: Migration Status
    console.log('Test 5: Migration Status');
    console.log('-'.repeat(40));
    const migrationsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_drizzle_migrations'
      ) as exists
    `);

    if (migrationsCheck.rows[0].exists) {
      const migrations = await pool.query(`
        SELECT idx, hash, created_at
        FROM _drizzle_migrations
        ORDER BY idx DESC
        LIMIT 5
      `);
      
      console.log(`✅ Migration tracking table exists`);
      console.log(`   Total migrations applied: ${migrations.rows.length}`);
      console.log('   Recent migrations:');
      migrations.rows.forEach(m => {
        const date = new Date(parseInt(m.created_at));
        console.log(`   - [${m.idx}] ${m.hash.substring(0, 40)}...`);
      });
      console.log('');

      // Check for migration 0007
      const migration0007 = await pool.query(`
        SELECT * FROM _drizzle_migrations 
        WHERE hash LIKE '%0007%' OR hash LIKE '%unique_constraint%'
      `);

      if (migration0007.rows.length === 0) {
        console.log('⚠️  Migration 0007 NOT applied');
        issues.push('Migration 0007 missing');
        recommendations.push('Apply migration 0007 immediately');
      } else {
        console.log('✅ Migration 0007 has been applied');
      }
    } else {
      console.log('⚠️  Migration tracking table missing\n');
      issues.push('Migration tracking not set up');
    }

    // Test 6: Sample Data Check
    console.log('\nTest 6: Sample Data Check');
    console.log('-'.repeat(40));
    const dataCheck = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT book_id) as unique_books,
             COUNT(DISTINCT view_type) as unique_types
      FROM book_view_statistics
    `);

    console.log(`   Total records: ${dataCheck.rows[0].total}`);
    console.log(`   Unique books: ${dataCheck.rows[0].unique_books}`);
    console.log(`   View types: ${dataCheck.rows[0].unique_types}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('\n📊 DIAGNOSTIC SUMMARY\n');
    
    if (issues.length === 0) {
      console.log('✅ NO ISSUES FOUND!');
      console.log('   The database schema appears correct.');
      console.log('   If the endpoint is still failing, check:');
      console.log('   - Application logs: pm2 logs ollama-reader');
      console.log('   - Restart application: pm2 restart ollama-reader');
      console.log('   - Test endpoint with proper authentication\n');
    } else {
      console.log(`❌ FOUND ${issues.length} ISSUE(S):\n`);
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      console.log('');
    }

    if (recommendations.length > 0) {
      console.log('📋 RECOMMENDED ACTIONS:\n');
      recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('\n💡 Quick Fix Command:');
    console.log('   node apply_server_migration.cjs\n');

  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

diagnoseServer();
