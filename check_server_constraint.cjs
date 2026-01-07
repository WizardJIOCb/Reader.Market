/**
 * Server Database Constraint Checker
 * 
 * This script checks if the required unique constraint exists on the 
 * book_view_statistics table in the production database.
 * 
 * Usage: node check_server_constraint.cjs
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

async function checkConstraint() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking Server Database Constraint Status\n');
    console.log('Database:', DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');
    console.log('='.repeat(80));

    // Check if the unique constraint exists
    const constraintQuery = `
      SELECT 
        constraint_name, 
        constraint_type,
        table_name
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
        AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `;

    const result = await pool.query(constraintQuery);

    if (result.rows.length > 0) {
      console.log('✅ CONSTRAINT EXISTS!');
      console.log('\nConstraint Details:');
      console.log('  Name:', result.rows[0].constraint_name);
      console.log('  Type:', result.rows[0].constraint_type);
      console.log('  Table:', result.rows[0].table_name);
      console.log('\n✅ The track-view endpoint should work correctly.\n');
    } else {
      console.log('❌ CONSTRAINT NOT FOUND!');
      console.log('\nThe unique constraint is missing on book_view_statistics table.');
      console.log('This is why the track-view endpoint is failing.\n');
      console.log('📋 Next Steps:');
      console.log('  1. Check for duplicates: node check_server_duplicates.cjs');
      console.log('  2. Apply migration: node apply_server_migration.cjs');
      console.log('  3. Restart application: pm2 restart ollama-reader\n');
    }

    // Check all constraints on the table
    const allConstraintsQuery = `
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
      ORDER BY constraint_type, constraint_name
    `;

    const allConstraints = await pool.query(allConstraintsQuery);
    
    if (allConstraints.rows.length > 0) {
      console.log('Current Constraints on book_view_statistics:');
      allConstraints.rows.forEach(row => {
        console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
      });
    } else {
      console.log('⚠️  No constraints found on book_view_statistics table.');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error checking constraint:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkConstraint();
