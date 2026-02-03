const { Client } = require('pg');

async function updateConfig() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    await client.query(
      'UPDATE tts_config SET audio_format = $1 WHERE id = $2', 
      ['wav', 'default']
    );
    console.log('Updated audio format to wav');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

updateConfig();