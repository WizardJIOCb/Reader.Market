const { Client } = require('pg');

async function checkJobStatus() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT id, status, text_hash, created_at FROM tts_jobs WHERE text_hash = $1', 
      ['cb29c8b8a96988c4553ac686d6ebcb63f70e690303497e4535ee4d65e03a942d']
    );
    
    if (res.rows.length > 0) {
      console.log('Job status:', res.rows[0].status);
      console.log('Created at:', res.rows[0].created_at);
    } else {
      console.log('Job not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkJobStatus();