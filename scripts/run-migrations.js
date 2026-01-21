/**
 * Database Migration Runner
 * Runs SQL migrations from the migrations directory
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection - use DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL not found in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: false,
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `;
  
  try {
    await pool.query(query);
    log('✓ Migrations tracking table ready', colors.green);
  } catch (error) {
    log(`✗ Error creating migrations table: ${error.message}`, colors.red);
    throw error;
  }
}

async function getMigrationsApplied() {
  const query = 'SELECT migration_name FROM schema_migrations ORDER BY id';
  const result = await pool.query(query);
  return new Set(result.rows.map(row => row.migration_name));
}

async function recordMigration(migrationName) {
  const query = 'INSERT INTO schema_migrations (migration_name) VALUES ($1)';
  await pool.query(query, [migrationName]);
}

async function runMigrations() {
  console.log('\n========================================');
  log('Running Database Migrations', colors.blue);
  console.log('========================================\n');

  try {
    // Test database connection
    log(`Connecting to database...`, colors.blue);
    await pool.query('SELECT NOW()');
    log('✓ Database connection successful', colors.green);
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Get list of applied migrations
    const appliedMigrations = await getMigrationsApplied();
    
    // Read all migration files from custom subfolder
    const migrationsDir = path.join(__dirname, '..', 'migrations', 'custom');
    
    if (!fs.existsSync(migrationsDir)) {
      log(`✗ Migrations directory not found: ${migrationsDir}`, colors.red);
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure alphabetical order
    
    if (files.length === 0) {
      log('No migration files found', colors.yellow);
      return;
    }
    
    console.log(`\nFound ${files.length} migration file(s)\n`);
    
    let applied = 0;
    let skipped = 0;
    
    // Run each migration
    for (const file of files) {
      const migrationName = file;
      
      if (appliedMigrations.has(migrationName)) {
        log(`[SKIP] ${migrationName} (already applied)`, colors.yellow);
        skipped++;
        continue;
      }
      
      log(`[APPLYING] ${migrationName}`, colors.blue);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      try {
        // Run migration in a transaction
        await pool.query('BEGIN');
        await pool.query(sql);
        await recordMigration(migrationName);
        await pool.query('COMMIT');
        
        log(`[SUCCESS] ${migrationName} applied successfully`, colors.green);
        applied++;
      } catch (error) {
        await pool.query('ROLLBACK');
        log(`[ERROR] Failed to apply ${migrationName}`, colors.red);
        log(`Error: ${error.message}`, colors.red);
        throw error;
      }
      
      console.log('');
    }
    
    // Summary
    console.log('========================================');
    log('Migration Summary', colors.blue);
    console.log('========================================');
    console.log(`Applied: ${applied}`);
    console.log(`Skipped: ${skipped}`);
    console.log('========================================\n');
    
    if (applied > 0) {
      log('✓ Database migrations completed successfully!', colors.green);
    } else {
      log('No new migrations to apply', colors.yellow);
    }
    
  } catch (error) {
    log(`\n✗ Migration failed: ${error.message || error.code || 'Unknown error'}`, colors.red);
    if (error.code === 'ECONNREFUSED') {
      log('Database connection refused. Is PostgreSQL running?', colors.red);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();
