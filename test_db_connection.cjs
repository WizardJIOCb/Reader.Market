const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword',
  });

  try {
    console.log('Attempting to connect to database...');
    await client.connect();
    console.log('Connected successfully!');
    
    console.log('Querying users table...');
    const result = await client.query('SELECT * FROM users LIMIT 5;');
    console.log('Query successful!');
    console.log('Rows returned:', result.rows.length);
    console.log('Sample data:', result.rows);
    
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
    console.error('Full error:', err);
  }
}

testConnection();