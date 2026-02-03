const { Client } = require('pg');

async function checkFailedJobs() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT text_hash, error_message, created_at FROM tts_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT 5', 
      ['failed']
    );
    console.log('Failed jobs:', res.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkFailedJobs();