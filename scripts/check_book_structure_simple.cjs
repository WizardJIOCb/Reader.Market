const { Client } = require('pg');

async function checkBookStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check if chapters table exists
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'chapters'
    `);
    
    console.log('Chapters table exists:', tables.rows.length > 0);
    
    if (tables.rows.length > 0) {
      // Check chapters for this book
      const chapters = await client.query(`
        SELECT COUNT(*) as count FROM chapters 
        WHERE book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
      `);
      
      console.log('Chapters in book:', chapters.rows[0].count);
      
      // Check if the specific text exists anywhere
      const textCheck = await client.query(`
        SELECT index, title FROM chapters 
        WHERE book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
        AND content ILIKE '%Не звучит ни единого слова%'
      `);
      
      console.log('Text found in chapters:', textCheck.rows);
    } else {
      console.log('Checking books table structure...');
      const bookColumns = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'books' AND table_schema = 'public'
      `);
      
      console.log('Books table columns:', bookColumns.rows.map(r => r.column_name));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkBookStructure();