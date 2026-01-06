const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Applying migration: 0007_add_unique_constraint_book_view_statistics\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0007_add_unique_constraint_book_view_statistics.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Migration SQL:');
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));
    console.log('\nExecuting migration...\n');
    
    // Execute the migration (Neon doesn't support transactions in the same way, so we'll execute as is)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        await sql([statement]);
      }
    }
    
    console.log('✓ Migration applied successfully!\n');
    
    // Verify the constraint was created
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'book_view_statistics'
      AND constraint_name = 'book_view_statistics_book_id_view_type_unique'
    `;
    
    if (constraints.length > 0) {
      console.log('✓ Constraint verified:');
      console.table(constraints);
    } else {
      console.log('⚠ Warning: Constraint not found in database');
    }
    
    // Check for any remaining duplicates
    const duplicates = await sql`
      SELECT book_id, view_type, COUNT(*) as count
      FROM book_view_statistics
      GROUP BY book_id, view_type
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length === 0) {
      console.log('\n✓ No duplicates found');
    } else {
      console.log('\n⚠ Warning: Duplicates still exist:');
      console.table(duplicates);
    }
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
