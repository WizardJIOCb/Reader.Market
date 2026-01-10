const { Client } = require('pg');

async function checkConstraints() {
  const client = new Client(process.env.DATABASE_URL);
  
  try {
    await client.connect();
    
    // Check constraints on book_view_statistics table
    const result = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'book_view_statistics';
    `);
    
    console.log('Constraints on book_view_statistics table:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Also check if the specific unique constraint exists
    const specificResult = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'book_view_statistics' 
      AND constraint_name = 'book_view_statistics_book_id_view_type_unique';
    `);
    
    console.log('\nSpecific unique constraint exists:');
    console.log(specificResult.rows.length > 0 ? 'YES' : 'NO');
    
    if (specificResult.rows.length > 0) {
      console.log('Constraint found:', specificResult.rows[0]);
    } else {
      console.log('Expected constraint "book_view_statistics_book_id_view_type_unique" is missing!');
    }
    
  } catch (err) {
    console.error('Error checking constraints:', err);
  } finally {
    await client.end();
  }
}

checkConstraints();