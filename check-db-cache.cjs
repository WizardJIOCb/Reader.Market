const { Client } = require('pg');

async function checkCache() {
  const client = new Client({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb'
  });
  
  try {
    await client.connect();
    const res = await client.query(
      'SELECT * FROM "ttsCache" WHERE "textHash" = $1', 
      ['117d2a62ca98a9ab10f6f4190459df631effebef7f709d192185deb48426b9f3']
    );
    console.log('Cache records:', res.rows);
    
    if (res.rows.length > 0) {
      console.log('Audio path:', res.rows[0].audioPath);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkCache();