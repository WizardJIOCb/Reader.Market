const { Pool } = require('pg');
require('dotenv').config();

async function checkConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('Checking if unique constraint exists...\n');
    
    // Check for the constraint
    const result = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'book_view_statistics'
      AND tc.constraint_name = 'book_view_statistics_book_id_view_type_unique'
      ORDER BY kcu.ordinal_position
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint EXISTS!');
      console.table(result.rows);
      console.log('\n✓ The migration was successful!');
      console.log('✓ The /api/books/:id/track-view endpoint should now work correctly.');
    } else {
      console.log('❌ Constraint NOT FOUND');
      console.log('\nThe constraint might not have been created. Let me try to create it now...\n');
      
      try {
        await pool.query(`
          ALTER TABLE "book_view_statistics"
          ADD CONSTRAINT "book_view_statistics_book_id_view_type_unique"
          UNIQUE ("book_id", "view_type")
        `);
        console.log('✅ Constraint created successfully!');
        
        // Verify again
        const verifyResult = await pool.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'book_view_statistics'
          AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
        `);
        
        if (verifyResult.rows.length > 0) {
          console.log('\n✅ Verified! Constraint now exists:');
          console.table(verifyResult.rows);
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('✅ Constraint already exists (got duplicate error)');
        } else {
          console.error('❌ Failed to create constraint:', err.message);
        }
      }
    }
    
    // Show all constraints on the table
    console.log('\n📋 All constraints on book_view_statistics table:');
    const allConstraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
      ORDER BY constraint_type, constraint_name
    `);
    console.table(allConstraints.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkConstraint();
