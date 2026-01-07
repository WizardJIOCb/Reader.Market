/**
 * Server Migration Application Script
 * 
 * This script applies migration 0007 to add the unique constraint on book_view_statistics table.
 * It handles duplicate consolidation automatically.
 * 
 * Usage: node apply_server_migration.cjs
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

async function applyMigration() {
  const pool = new Pool({
    connectionString: serverDbUrl,
    ssl: serverDbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Applying Migration 0007 to Server Database\n');
    console.log('Database:', serverDbUrl.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));
    console.log('⚠️  IMPORTANT: This will modify the database schema!');
    console.log('   Please ensure you have a recent backup.\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0007_add_unique_constraint_book_view_statistics.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      console.error('   Make sure you are running this script from the project root directory.');
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded:', migrationPath, '\n');

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
      console.log('If the endpoint is still failing, check the application logs:');
      console.log('   pm2 logs ollama-reader --lines 100\n');
      await pool.end();
      return;
    }
    console.log('   Constraint does not exist. Proceeding with migration...\n');

    // Check for duplicates before migration
    console.log('Step 2: Checking for duplicate records...');
    const duplicatesCheck = await pool.query(`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `);

    if (duplicatesCheck.rows.length > 0) {
      console.log(`   Found ${duplicatesCheck.rows.length} duplicate groups.`);
      console.log('   Migration will consolidate them automatically.\n');
    } else {
      console.log('   No duplicates found.\n');
    }

    // Apply the migration
    console.log('Step 3: Applying migration SQL...');
    console.log('   This may take a few seconds...\n');

    await pool.query(migrationSql);

    console.log('✅ Migration SQL executed successfully!\n');

    // Verify constraint was created
    console.log('Step 4: Verifying constraint creation...');
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
      console.log('⚠️  Could not verify constraint. Please check manually.\n');
    }

    // Check for remaining duplicates
    console.log('Step 5: Checking for remaining duplicates...');
    const finalDuplicatesCheck = await pool.query(`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `);

    if (finalDuplicatesCheck.rows.length === 0) {
      console.log('✅ No duplicates remaining!\n');
    } else {
      console.log(`⚠️  ${finalDuplicatesCheck.rows.length} duplicate groups still exist.`);
      console.log('   This should not happen. Please investigate.\n');
    }

    // Update migration tracking
    console.log('Step 6: Updating migration tracking...');
    const maxIdx = await pool.query('SELECT MAX(idx) as max_idx FROM _drizzle_migrations');
    const nextIdx = (maxIdx.rows[0].max_idx || 0) + 1;
    
    await pool.query(`
      INSERT INTO _drizzle_migrations (idx, hash, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (hash) DO NOTHING
    `, [nextIdx, '0007_add_unique_constraint_book_view_statistics', Date.now().toString()]);

    console.log('✅ Migration tracking updated!\n');

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart application: pm2 restart ollama-reader');
    console.log('   2. Test the endpoint:');
    console.log('      POST https://reader.market/api/books/{book-id}/track-view');
    console.log('      Body: {"viewType": "card_view"}');
    console.log('   3. Expected response: {"success": true}\n');
    console.log('   4. Monitor logs: pm2 logs ollama-reader\n');
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

applyMigration();
