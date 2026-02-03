#!/usr/bin/env node

/**
 * TTS Setup Verification Script
 * This script runs automatically on server startup to ensure TTS configuration exists
 */

const fs = require('fs');
const path = require('path');

async function ensureTTSSetup() {
  console.log('Verifying TTS configuration...');

  try {
    // Check if required environment variables are set
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      console.warn('Warning: DATABASE_URL or POSTGRES_URL not set. TTS configuration may fail.');
      return;
    }

    // Dynamically import modules to avoid issues if they're not available during build
    const { drizzle } = require('drizzle-orm/node-postgres');
    const { Pool } = require('pg');
    const { eq } = require('drizzle-orm');
    
    // Try to import the schema - if it fails, we'll skip the setup
    let ttsConfig;
    try {
      ttsConfig = require('../shared/schema').ttsConfig;
    } catch (error) {
      console.error('Could not import ttsConfig schema, skipping TTS setup:', error.message);
      return;
    }

    // Create database connection
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
      console.log('TTS configuration already exists, verifying...');
      
      // Check if essential fields are present
      const config = existingConfig[0];
      let needsUpdate = false;
      let updateData = {};
      
      for (const [key, value] of Object.entries(defaultConfig)) {
        if (key !== 'id' && (config[key] === null || config[key] === undefined || 
             (typeof value === 'string' && config[key] === ''))) {
          needsUpdate = true;
          updateData[key] = value;
          console.log(`Missing or invalid value for ${key}, will update`);
        }
      }
      
      if (needsUpdate) {
        console.log('Updating TTS configuration with missing values...');
        await db.update(ttsConfig)
          .set(updateData)
          .where(eq(ttsConfig.id, 'default'));
        console.log('TTS configuration updated successfully');
      } else {
        console.log('TTS configuration is complete');
      }
    } else {
      console.log('Creating new TTS configuration...');
      
      // Insert new config
      await db.insert(ttsConfig).values(defaultConfig);
      
      console.log('TTS configuration created successfully');
    }

    // Close the database connection
    await pool.end();
    
    console.log('TTS configuration verification completed successfully!');
  } catch (error) {
    console.error('Error during TTS configuration verification:', error.message);
    // Don't exit with error code as this is a verification script that shouldn't break the app startup
  }
}

// Run the verification
ensureTTSSetup();

module.exports = ensureTTSSetup;