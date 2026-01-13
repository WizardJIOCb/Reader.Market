require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbConnectionUrl = process.env.DATABASE_URL;

if (!dbConnectionUrl) {
  console.error('❌ Error: No DATABASE_URL found in .env');
  process.exit(1);
}

async function checkAndApplyMigration() {
  const pool = new Pool({
    connectionString: dbConnectionUrl,
    ssl: false
  });

  try {
    console.log('🔍 Checking if user_actions table exists...\n');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'user_actions'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;
    
    if (tableExists) {
      console.log('✅ user_actions table already exists!\n');
      
      // Show row count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM user_actions WHERE deleted_at IS NULL');
      console.log(`📊 Current action count: ${countResult.rows[0].count}\n`);
    } else {
      console.log('❌ user_actions table does not exist. Applying migration...\n');
      
      // Read and apply migration
      const migrationPath = path.join(__dirname, 'migrations', '0013_add_user_actions_table.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSql);
      console.log('✅ Migration applied successfully!\n');
      
      // Verify
      const verifyCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_name = 'user_actions'
        );
      `);
      
      if (verifyCheck.rows[0].exists) {
        console.log('✅ Verification successful - table created!\n');
      } else {
        console.log('❌ Verification failed - table not found\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkAndApplyMigration();
