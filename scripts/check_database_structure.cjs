const { Client } = require('pg');

async function checkDatabaseStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('All tables:');
    tables.rows.forEach(row => console.log('-', row.table_name));
    
    // Check bookmarks table structure
    console.log('\nBookmarks table structure:');
    const bookmarkColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    bookmarkColumns.rows.forEach(row => 
      console.log(`${row.column_name}: ${row.data_type}`)
    );
    
    // Check if there's a chapters or book_content table
    const contentTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%chapter%' OR table_name LIKE '%content%')
    `);
    
    console.log('\nContent-related tables:', contentTables.rows);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabaseStructure();