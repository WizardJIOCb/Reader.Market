const { Client } = require('pg');

async function checkBooksStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check books table structure
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'books' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Books table columns:');
    columns.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    
    // Check if there's content or chapters column
    const contentColumns = columns.rows.filter(row => 
      row.column_name.includes('content') || row.column_name.includes('chapter')
    );
    
    console.log('\nContent-related columns:', contentColumns);
    
    // Check a sample book to see structure
    const sampleBook = await client.query(`
      SELECT id, title 
      FROM books 
      LIMIT 1
    `);
    
    if (sampleBook.rows.length > 0) {
      console.log('\nSample book:', sampleBook.rows[0]);
      
      // Check if there are any columns with content-like names
      const bookDetails = await client.query(`
        SELECT * 
        FROM books 
        WHERE id = $1
      `, [sampleBook.rows[0].id]);
      
      const row = bookDetails.rows[0];
      console.log('\nBook data keys:', Object.keys(row));
      
      // Look for content in any text/json columns
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > 100) {
          console.log(`\n${key} (first 200 chars):`, value.substring(0, 200));
        }
      }
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkBooksStructure();