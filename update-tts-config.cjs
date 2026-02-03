const { Pool } = require('pg');

async function updateTtsConfig() {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });

  try {
    console.log('Updating TTS configuration to use Windows provider...');
    
    await pool.query(`
      UPDATE tts_config 
      SET 
        default_provider = 'windows',
        enabled_providers = '["windows"]'
      WHERE id = 'default'
    `);
    
    console.log('✅ TTS config updated successfully');
    
    // Verify the update
    const result = await pool.query('SELECT default_provider, enabled_providers FROM tts_config WHERE id = $1', ['default']);
    console.log('Current config:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error updating TTS config:', error);
  } finally {
    await pool.end();
  }
}

updateTtsConfig();