/**
 * TTS Configuration Setup Script
 * This script ensures proper TTS configuration exists in the database
 * Run this script after deploying to the server
 */

require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { ttsConfig } = require('../shared/schema'); // Adjust path as needed
const { eq } = require('drizzle-orm');

async function setupTTSConfig() {
  try {
    console.log('Setting up TTS configuration...');

    // Create database connection using environment variables
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    const db = drizzle(pool);

    // Define the default TTS configuration
    const defaultConfig = {
      id: 'default',
      ttsEnabled: true,
      enabledProviders: JSON.stringify(['piper', 'rhvoice']),
      defaultProvider: 'piper',
      defaultLang: 'en',
      defaultVoiceRu: 'ru_RU-irina',
      defaultVoiceEn: 'en_US-lessac',
      defaultRate: '1.00',
      minRate: '0.80',
      maxRate: '1.25',
      chunkMinChars: 400,
      chunkMaxChars: 1800,
      audioFormat: 'mp3',
      mp3Bitrate: 64,
      queueConcurrency: 1,
      cacheMaxGb: 20,
      cacheTtlDays: 90,
      rhvoiceBinPath: '/usr/bin/RHVoice-test',
      piperBinPath: '/usr/local/bin/piper',
      piperModelsDir: '/opt/piper/models',
    };

    // Check if config already exists
    const existingConfig = await db.select().from(ttsConfig).where(eq(ttsConfig.id, 'default')).limit(1);
    
    if (existingConfig.length > 0) {
      console.log('TTS configuration already exists, updating...');
      
      // Update existing config
      await db.update(ttsConfig)
        .set(defaultConfig)
        .where(eq(ttsConfig.id, 'default'));
        
      console.log('TTS configuration updated successfully');
    } else {
      console.log('Creating new TTS configuration...');
      
      // Insert new config
      await db.insert(ttsConfig).values(defaultConfig);
      
      console.log('TTS configuration created successfully');
    }

    // Verify the configuration
    const config = await db.select().from(ttsConfig).where(eq(ttsConfig.id, 'default')).limit(1);
    console.log('Current TTS configuration:', {
      ...config[0],
      // Don't log sensitive data
    });

    console.log('TTS configuration setup completed successfully!');
    
    // Close the database connection
    await pool.end();
  } catch (error) {
    console.error('Error setting up TTS configuration:', error);
    process.exit(1);
  }
}

// Run the setup
setupTTSConfig();