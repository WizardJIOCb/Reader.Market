const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function debugTtsCompleteState() {
  try {
    console.log('=== DEBUGGING COMPLETE TTS STATE ===\n');
    
    // Check what's actually in the database after a PUT operation
    console.log('1. DATABASE CONTENT AFTER PUT:');
    const dbResult = await pool.query(`
      SELECT 
        id,
        tts_enabled,
        enabled_providers,
        default_provider,
        default_rate,
        min_rate,
        max_rate,
        default_lang,
        default_voice_ru,
        default_voice_en,
        chunk_min_chars,
        chunk_max_chars,
        audio_format,
        mp3_bitrate,
        queue_concurrency,
        cache_max_gb,
        cache_ttl_days,
        rhvoice_bin_path,
        piper_bin_path,
        piper_models_dir,
        created_at,
        updated_at
      FROM tts_config 
      LIMIT 1
    `);
    
    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      console.log('Raw database record:');
      Object.keys(row).forEach(key => {
        console.log(`- ${key}:`, row[key], `(type: ${typeof row[key]})`);
      });
      
      console.log('\n2. TESTING VALUE EXTRACTION:');
      console.log('- tts_enabled:', row.tts_enabled);
      console.log('- default_rate:', row.default_rate, '-> parseFloat:', parseFloat(row.default_rate));
      console.log('- min_rate:', row.min_rate, '-> parseFloat:', parseFloat(row.min_rate));
      console.log('- max_rate:', row.max_rate, '-> parseFloat:', parseFloat(row.max_rate));
      
      // Test JSON parsing
      console.log('\n3. JSON PARSING TEST:');
      try {
        const parsedProviders = JSON.parse(row.enabled_providers);
        console.log('enabled_providers parsed:', parsedProviders);
      } catch (e) {
        console.log('Failed to parse enabled_providers:', e.message);
      }
    } else {
      console.log('No TTS config found in database!');
    }
    
  } catch (error) {
    console.error('Error debugging TTS state:', error);
  } finally {
    await pool.end();
  }
}

debugTtsCompleteState();