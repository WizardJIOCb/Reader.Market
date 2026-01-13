const { config } = require('dotenv');
config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n📋 Applying migration: user_channel_read_positions table\n');
    console.log(`Database: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@')}\n`);

    const migrationPath = path.join(__dirname, 'migrations', '0014_add_user_channel_read_positions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Migration SQL:');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    console.log('\nExecuting migration...\n');

    await pool.query(sql);

    console.log('✓ Migration applied successfully!\n');

    // Verify the table was created
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_channel_read_positions'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✓ Table user_channel_read_positions verified\n');
      
      // Check indexes
      const indexResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'user_channel_read_positions'
      `);
      
      console.log('✓ Indexes created:');
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
      console.log('');
    } else {
      console.error('✗ Table verification failed\n');
    }

    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
