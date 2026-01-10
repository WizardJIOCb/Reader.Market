import { Client } from 'pg';
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'booksuser',
  password: 'bookspassword',
  database: 'booksdb',
});

client.connect()
  .then(() => {
    console.log('Database connection successful');
    client.end();
    process.exit(0);
  })
  .catch(err => {
    console.log('Database not ready');
    client.end();
    process.exit(1);
  });