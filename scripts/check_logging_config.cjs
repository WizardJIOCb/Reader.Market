const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function checkLoggingConfig() {
  try {
    console.log('=== CHECKING CURRENT LOGGING CONFIGURATION ===\n');
    
    // Check if logging config table exists and get current config
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'logging_config'
    `);
    
    if (tables.rows.length > 0) {
      console.log('Logging config table exists');
      
      const configResult = await pool.query('SELECT * FROM logging_config LIMIT 1');
      if (configResult.rows.length > 0) {
        console.log('Current logging config:');
        console.log(JSON.stringify(configResult.rows[0], null, 2));
      } else {
        console.log('No logging config found in database');
      }
    } else {
      console.log('Logging config table does not exist');
    }
    
  } catch (error) {
    console.error('Error checking logging config:', error);
  } finally {
    await pool.end();
  }
}

checkLoggingConfig();