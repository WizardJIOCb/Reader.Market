// Check actual database column names
const { Client } = require('pg');

async function checkColumnNames() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public",
  });

  try {
    await client.connect();
    
    // Check the actual column names in the tts_config table
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tts_config'
      ORDER BY ordinal_position;
    `);
    
    console.log('TTS Config Table Columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check actual data in the table
    const data = await client.query(`
      SELECT * FROM tts_config WHERE id = 'default';
    `);
    
    console.log('\nActual TTS Config Data:');
    if (data.rows.length > 0) {
      console.log(JSON.stringify(data.rows[0], null, 2));
    } else {
      console.log('No data found');
    }
    
  } catch (error) {
    console.error('Error checking column names:', error);
  } finally {
    await client.end();
  }
}

checkColumnNames();