const { Pool } = require('pg');
const fs = require('fs');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
});

async function checkShelf() {
  let client;
  try {
    client = await pool.connect();
    
    let output = '';
    
    // Check if the specific shelf exists
    const shelfId = '08d1454e-0296-4587-b0d3-b9ecb96082a4';
    output += `Checking if shelf ${shelfId} exists...\n`;
    
    const shelfResult = await client.query(
      'SELECT * FROM shelves WHERE id = $1',
      [shelfId]
    );
    
    if (shelfResult.rows.length > 0) {
      output += 'Shelf found: ' + JSON.stringify(shelfResult.rows[0]) + '\n';
      output += `Shelf belongs to user: ${shelfResult.rows[0].user_id}\n`;
    } else {
      output += 'Shelf not found in database\n';
    }
    
    // Check all shelves
    output += '\nChecking all shelves in database...\n';
    const allShelvesResult = await client.query('SELECT * FROM shelves');
    output += `Total shelves found: ${allShelvesResult.rows.length}\n`;
    allShelvesResult.rows.forEach(shelf => {
      output += `- Shelf ID: ${shelf.id}, Name: ${shelf.name}, User ID: ${shelf.user_id}\n`;
    });
    
    // Check if the book exists
    const bookId = '935fbc37-7e1f-4a83-b236-543cba12993d';
    output += `\nChecking if book ${bookId} exists...\n`;
    
    const bookResult = await client.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length > 0) {
      output += 'Book found: ' + bookResult.rows[0].title + '\n';
    } else {
      output += 'Book not found in database\n';
    }
    
    console.log(output);
    fs.writeFileSync('db_check_output.txt', output);
    console.log('Output written to db_check_output.txt');
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

checkShelf();