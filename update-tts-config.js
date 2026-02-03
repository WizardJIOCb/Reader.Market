/**
 * Script to update TTS configuration with proper binary paths
 * Run this script to fix the TTS configuration after the migration
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import * as schema from './shared/schema.ts';

dotenv.config();

async function updateTTSConfig() {
  try {
    console.log('Updating TTS configuration with proper binary paths...');

    // Create database connection using environment variables
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:@localhost:5432/reader_market',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    const db = drizzle(pool, { schema });

    // Update the TTS configuration with proper paths for Windows
    const result = await db.update(schema.ttsConfig)
      .set({
        rhvoiceBinPath: 'C:\\Program Files\\RHVoice\\bin\\RHVoice-test.exe',  // Windows path
        piperBinPath: 'piper',  // This should work if installed via pip
        piperModelsDir: 'C:\\opt\\piper\\models',  // Windows path
        defaultVoiceRu: 'ru_RU-irina',
        defaultVoiceEn: 'en_US-lessac',
        enabledProviders: ['piper']  // Start with piper which is easier to install on Windows
      })
      .where(eq(schema.ttsConfig.id, 'default'));

    console.log('TTS configuration updated successfully!', result);

    // Verify the update
    const updatedConfig = await db.select().from(schema.ttsConfig).where(eq(schema.ttsConfig.id, 'default')).limit(1);
    console.log('Updated TTS configuration:', {
      id: updatedConfig[0].id,
      ttsEnabled: updatedConfig[0].ttsEnabled,
      enabledProviders: updatedConfig[0].enabledProviders,
      defaultProvider: updatedConfig[0].defaultProvider,
      rhvoiceBinPath: updatedConfig[0].rhvoiceBinPath,
      piperBinPath: updatedConfig[0].piperBinPath,
      piperModelsDir: updatedConfig[0].piperModelsDir,
      defaultVoiceRu: updatedConfig[0].defaultVoiceRu,
      defaultVoiceEn: updatedConfig[0].defaultVoiceEn,
    });

    pool.end();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error updating TTS configuration:', error);
    process.exit(1);
  }
}

// Run the update
updateTTSConfig();