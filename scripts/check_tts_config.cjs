const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function checkTtsConfig() {
  try {
    console.log('Connecting to database...');
    
    // Check current TTS config
    const configResult = await pool.query('SELECT * FROM tts_config LIMIT 1');
    
    if (configResult.rows.length > 0) {
      console.log('Current TTS Config:');
      console.log(JSON.stringify(configResult.rows[0], null, 2));
      
      // Check specifically the tts_enabled field
      console.log('\ntts_enabled value:', configResult.rows[0].tts_enabled);
      console.log('enabled_providers:', configResult.rows[0].enabled_providers);
      console.log('default_provider:', configResult.rows[0].default_provider);
    } else {
      console.log('No TTS config found in database');
    }
    
  } catch (error) {
    console.error('Error checking TTS config:', error);
  } finally {
    await pool.end();
  }
}

checkTtsConfig();