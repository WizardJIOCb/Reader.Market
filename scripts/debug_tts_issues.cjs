const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function debugTtsIssues() {
  try {
    console.log('=== DEBUGGING TTS CONFIG ISSUES ===\n');
    
    // 1. Check what's actually in the database
    console.log('1. DATABASE CONTENT:');
    const dbConfig = await pool.query('SELECT * FROM tts_config LIMIT 1');
    if (dbConfig.rows.length > 0) {
      console.log('Raw database record:');
      console.log(JSON.stringify(dbConfig.rows[0], null, 2));
    } else {
      console.log('No TTS config found in database!');
      return;
    }
    
    console.log('\n2. SPECIFIC FIELD VALUES:');
    console.log('- tts_enabled:', dbConfig.rows[0].tts_enabled);
    console.log('- enabled_providers:', dbConfig.rows[0].enabled_providers);
    console.log('- default_provider:', dbConfig.rows[0].default_provider);
    console.log('- default_rate:', dbConfig.rows[0].default_rate);
    console.log('- default_lang:', dbConfig.rows[0].default_lang);
    
    // 3. Test JSON parsing
    console.log('\n3. JSON PARSING TEST:');
    try {
      const parsedProviders = JSON.parse(dbConfig.rows[0].enabled_providers);
      console.log('Parsed enabled_providers:', parsedProviders);
      console.log('Type:', typeof parsedProviders);
      console.log('Is array:', Array.isArray(parsedProviders));
    } catch (e) {
      console.log('Failed to parse enabled_providers:', e.message);
    }
    
    // 4. Check if there are multiple records
    console.log('\n4. RECORD COUNT:');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM tts_config');
    console.log('Total TTS config records:', countResult.rows[0].count);
    
  } catch (error) {
    console.error('Error debugging TTS issues:', error);
  } finally {
    await pool.end();
  }
}

debugTtsIssues();