const { Client } = require('pg');
require('dotenv').config();

// Get database URL from environment or use default
const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/your_database_name';

async function setupMigrationTracking() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create the _drizzle_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created _drizzle_migrations table if it did not exist');

    // Insert migration records if they don't already exist
    const migrations = [
      '0000_green_impossible_man',
      '0001_add_book_dates',
      '0002_update_book_rating_precision',
      '0003_add-messages-and-conversations',
      '0004_add-book-view-statistics'
    ];

    for (const migration of migrations) {
      await client.query(`
        INSERT INTO _drizzle_migrations (version) 
        VALUES ($1) 
        ON CONFLICT (version) DO NOTHING;
      `, [migration]);
    }
    
    console.log('Inserted migration records');
    console.log('Migration tracking setup completed successfully!');
    console.log('Now you can run: npx drizzle-kit migrate');

  } catch (error) {
    console.error('Error setting up migration tracking:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the function
setupMigrationTracking();