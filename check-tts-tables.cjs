const { Client } = require('pg');

async function checkTables() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE tablename LIKE '%tts%'");
    console.log('TTS tables:', res.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkTables();