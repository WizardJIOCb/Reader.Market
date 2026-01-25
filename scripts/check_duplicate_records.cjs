const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function checkDuplicateRecords() {
  try {
    console.log('=== CHECKING FOR DUPLICATE TTS CONFIG RECORDS ===\n');
    
    // Check how many records exist
    const countResult = await pool.query('SELECT COUNT(*) as count FROM tts_config');
    console.log('Total TTS config records:', countResult.rows[0].count);
    
    // List all records
    const allRecords = await pool.query(`
      SELECT 
        id,
        tts_enabled,
        enabled_providers,
        default_provider,
        default_rate,
        min_rate,
        max_rate
      FROM tts_config
      ORDER BY created_at
    `);
    
    console.log('\nAll TTS config records:');
    allRecords.rows.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log('  ID:', record.id);
      console.log('  tts_enabled:', record.tts_enabled);
      console.log('  default_rate:', record.default_rate);
      console.log('  min_rate:', record.min_rate);
      console.log('  max_rate:', record.max_rate);
      console.log('---');
    });
    
    // Check if there's a record with id = 'default'
    const defaultRecord = await pool.query(`
      SELECT * FROM tts_config WHERE id = 'default'
    `);
    
    if (defaultRecord.rows.length > 0) {
      console.log('\nDefault record found:');
      console.log('ID:', defaultRecord.rows[0].id);
      console.log('tts_enabled:', defaultRecord.rows[0].tts_enabled);
    } else {
      console.log('\nNo record with id = \'default\' found!');
    }
    
  } catch (error) {
    console.error('Error checking duplicate records:', error);
  } finally {
    await pool.end();
  }
}

checkDuplicateRecords();