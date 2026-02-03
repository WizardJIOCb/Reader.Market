const { Client } = require('pg');

async function checkJobs() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT * FROM tts_jobs WHERE text_hash = $1', 
      ['117d2a62ca98a9ab10f6f4190459df631effebef7f709d192185deb48426b9f3']
    );
    console.log('Job records:', res.rows);
    
    if (res.rows.length > 0) {
      console.log('Job status:', res.rows[0].status);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkJobs();