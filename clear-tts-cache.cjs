const { Client } = require('pg');

async function clearCache() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'DELETE FROM tts_cache WHERE text_hash = $1', 
      ['117d2a62ca98a9ab10f6f4190459df631effebef7f709d192185deb48426b9f3']
    );
    console.log('Deleted cache records:', res.rowCount);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

clearCache();