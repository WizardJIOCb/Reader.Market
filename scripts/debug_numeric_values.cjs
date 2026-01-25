const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function debugNumericValues() {
  try {
    console.log('=== DEBUGGING TTS NUMERIC VALUES ===\n');
    
    // Check raw database values
    const result = await pool.query(`
      SELECT 
        default_rate,
        min_rate, 
        max_rate,
        chunk_min_chars,
        chunk_max_chars,
        mp3_bitrate,
        queue_concurrency,
        cache_max_gb,
        cache_ttl_days
      FROM tts_config 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('Raw database values:');
      console.log('- default_rate:', row.default_rate, '(type:', typeof row.default_rate, ')');
      console.log('- min_rate:', row.min_rate, '(type:', typeof row.min_rate, ')');
      console.log('- max_rate:', row.max_rate, '(type:', typeof row.max_rate, ')');
      console.log('- chunk_min_chars:', row.chunk_min_chars, '(type:', typeof row.chunk_min_chars, ')');
      
      console.log('\nTesting parseFloat conversions:');
      console.log('- parseFloat(default_rate):', parseFloat(row.default_rate));
      console.log('- parseFloat(min_rate):', parseFloat(row.min_rate));
      console.log('- parseFloat(max_rate):', parseFloat(row.max_rate));
      
      console.log('\nTesting Number conversions:');
      console.log('- Number(default_rate):', Number(row.default_rate));
      console.log('- Number(min_rate):', Number(row.min_rate));
      console.log('- Number(max_rate):', Number(row.max_rate));
      
      // Test with explicit string conversion
      console.log('\nTesting with String() conversion:');
      console.log('- parseFloat(String(default_rate)):', parseFloat(String(row.default_rate)));
      console.log('- parseFloat(String(min_rate)):', parseFloat(String(row.min_rate)));
      console.log('- parseFloat(String(max_rate)):', parseFloat(String(row.max_rate)));
    }
    
  } catch (error) {
    console.error('Error debugging numeric values:', error);
  } finally {
    await pool.end();
  }
}

debugNumericValues();