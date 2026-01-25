// Simple database test for TTS config
const { Client } = require('pg');

async function testTtsConfig() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check what tables exist
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('Tables in database:', tables.rows.map(row => row.tablename));
    
    // Check column names in tts_config table
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tts_config' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Columns in tts_config table:', columns.rows);
    
    // Clean up duplicate records, keep only the 'default' record
    await client.query(`DELETE FROM tts_config WHERE id != 'default'`);
    console.log('Cleaned up duplicate TTS config records');
    
    // Check TTS config table
    const result = await client.query('SELECT * FROM tts_config');
    console.log('TTS Config records:', result.rows);
    
    if (result.rows.length > 0) {
      const config = result.rows[0];
      console.log('First config:', {
        id: config.id,
        ttsEnabled: config.ttsEnabled,
        enabledProviders: config.enabledProviders,
        defaultProvider: config.defaultProvider,
        defaultRate: config.defaultRate,
        updatedAt: config.updatedAt
      });
      
      // Check type of enabledProviders
      console.log('enabledProviders type:', typeof config.enabledProviders);
      console.log('enabledProviders value:', config.enabledProviders);
      
      if (typeof config.enabledProviders === 'string') {
        try {
          const parsed = JSON.parse(config.enabledProviders);
          console.log('enabledProviders parsed as array:', parsed);
        } catch (e) {
          console.log('enabledProviders is string but not valid JSON');
        }
      }
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

testTtsConfig();