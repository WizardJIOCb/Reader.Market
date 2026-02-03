const { Client } = require('pg');

async function checkConfig() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT audio_format FROM tts_config WHERE id = $1', 
      ['default']
    );
    console.log('Current audio format:', res.rows[0]?.audio_format || 'Not set');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkConfig();