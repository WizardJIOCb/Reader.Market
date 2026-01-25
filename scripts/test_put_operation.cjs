const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb',
  ssl: false
});

async function testPutOperation() {
  try {
    console.log('=== TESTING TTS CONFIG PUT OPERATION ===\n');
    
    // First, get current values
    console.log('1. BEFORE UPDATE:');
    const beforeResult = await pool.query(`
      SELECT 
        tts_enabled,
        enabled_providers,
        default_provider,
        default_rate,
        min_rate,
        max_rate
      FROM tts_config 
      LIMIT 1
    `);
    
    if (beforeResult.rows.length > 0) {
      console.log('Current values:');
      console.log('- tts_enabled:', beforeResult.rows[0].tts_enabled);
      console.log('- enabled_providers:', beforeResult.rows[0].enabled_providers);
      console.log('- default_provider:', beforeResult.rows[0].default_provider);
      console.log('- default_rate:', beforeResult.rows[0].default_rate);
      console.log('- min_rate:', beforeResult.rows[0].min_rate);
      console.log('- max_rate:', beforeResult.rows[0].max_rate);
    }
    
    // Simulate what the PUT operation should do
    console.log('\n2. SIMULATING PUT UPDATE:');
    const updateResult = await pool.query(`
      UPDATE tts_config 
      SET 
        tts_enabled = $1,
        enabled_providers = $2,
        default_provider = $3,
        default_rate = $4,
        min_rate = $5,
        max_rate = $6
      WHERE id = 'default'
      RETURNING *
    `, [
      false, // tts_enabled
      '["rhvoice","piper"]', // enabled_providers
      'rhvoice', // default_provider
      '1.00', // default_rate
      '0.80', // min_rate
      '1.25'  // max_rate
    ]);
    
    console.log('Update result rows:', updateResult.rowCount);
    
    // Check values after update
    console.log('\n3. AFTER UPDATE:');
    const afterResult = await pool.query(`
      SELECT 
        tts_enabled,
        enabled_providers,
        default_provider,
        default_rate,
        min_rate,
        max_rate
      FROM tts_config 
      LIMIT 1
    `);
    
    if (afterResult.rows.length > 0) {
      console.log('Updated values:');
      console.log('- tts_enabled:', afterResult.rows[0].tts_enabled);
      console.log('- enabled_providers:', afterResult.rows[0].enabled_providers);
      console.log('- default_provider:', afterResult.rows[0].default_provider);
      console.log('- default_rate:', afterResult.rows[0].default_rate);
      console.log('- min_rate:', afterResult.rows[0].min_rate);
      console.log('- max_rate:', afterResult.rows[0].max_rate);
      
      // Test parsing
      console.log('\nTesting parsing of updated values:');
      console.log('- parseFloat(default_rate):', parseFloat(afterResult.rows[0].default_rate));
      console.log('- parseFloat(min_rate):', parseFloat(afterResult.rows[0].min_rate));
      console.log('- parseFloat(max_rate):', parseFloat(afterResult.rows[0].max_rate));
    }
    
  } catch (error) {
    console.error('Error testing PUT operation:', error);
  } finally {
    await pool.end();
  }
}

testPutOperation();