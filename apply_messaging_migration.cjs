const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMessagingMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  const db = drizzle(pool);

  try {
    console.log('Applying messaging system migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0008_add_messaging_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the entire migration as a single transaction
    console.log('Executing migration...');
    await pool.query(migrationSQL);

    // Record migration in tracking table
    console.log('Recording migration in tracking table...');
    try {
      await pool.query(`
        INSERT INTO _drizzle_migrations (hash, created_at)
        VALUES ($1, $2)
        ON CONFLICT (hash) DO NOTHING
      `, ['0008_add_messaging_system', Date.now()]);
    } catch (trackingError) {
      console.warn('Warning: Could not record migration in _drizzle_migrations table. This is okay if the table does not exist yet.');
      console.warn('Error:', trackingError.message);
    }

    console.log('✅ Messaging system migration completed successfully!');
    console.log('New tables created:');
    console.log('  - groups');
    console.log('  - group_members');
    console.log('  - group_books');
    console.log('  - channels');
    console.log('  - message_reactions');
    console.log('  - notifications');
    console.log('Updated tables:');
    console.log('  - messages (added conversation_id, channel_id, parent_message_id, deleted_at, deleted_by)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMessagingMigration();
