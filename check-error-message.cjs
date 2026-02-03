const { Client } = require('pg');

async function checkErrorMessage() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT error_message FROM tts_jobs WHERE text_hash = $1', 
      ['cb29c8b8a96988c4553ac686d6ebcb63f70e690303497e4535ee4d65e03a942d']
    );
    
    console.log('Error message:', res.rows[0]?.error_message || 'No error');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkErrorMessage();