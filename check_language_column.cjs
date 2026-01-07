const { Pool } = require('pg');

const checkLanguageColumn = async () => {
  const pool = new Pool({
    connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public'
  });
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'language';
    `);
    
    console.log('Language column info:', result.rows);
    
    // Also check if there are any users with language set
    const usersResult = await pool.query(`
      SELECT id, username, language 
      FROM users 
      LIMIT 5;
    `);
    
    console.log('\nSample users with language:');
    console.log(usersResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
};

checkLanguageColumn();
