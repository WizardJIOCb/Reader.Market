/**
 * Test script to check if TTS engines are properly installed
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import * as schema from './shared/schema.ts';

dotenv.config();

async function testTTSEngines() {
  console.log('Testing TTS engines...\n');

  // Create database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:@localhost:5432/reader_market',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool, { schema });

  // Get current TTS configuration
  const config = await db.select().from(schema.ttsConfig).where(eq(schema.ttsConfig.id, 'default')).limit(1);
  
  if (config.length === 0) {
    console.log('❌ No TTS configuration found in database');
    return;
  }

  const ttsConfig = config[0];
  console.log('Current TTS Configuration:');
  console.log('- Enabled:', ttsConfig.ttsEnabled);
  console.log('- Providers:', ttsConfig.enabledProviders);
  console.log('- Default Provider:', ttsConfig.defaultProvider);
  console.log('- Piper Path:', ttsConfig.piperBinPath);
  console.log('- RHVoice Path:', ttsConfig.rhvoiceBinPath);
  console.log('- Models Directory:', ttsConfig.piperModelsDir);
  console.log('');

  // Test Piper
  if (ttsConfig.enabledProviders.includes('piper')) {
    console.log('Testing Piper TTS engine...');
    
    try {
      // Check if piper command exists
      const piperProc = spawn('cmd', ['/c', 'where', 'piper'], { shell: true });
      let piperOutput = '';
      let piperError = '';

      piperProc.stdout.on('data', (data) => {
        piperOutput += data.toString();
      });

      piperProc.stderr.on('data', (data) => {
        piperError += data.toString();
      });

      piperProc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Piper command found at:', piperOutput.trim());
          
          // Test if models directory exists
          if (ttsConfig.piperModelsDir && existsSync(ttsConfig.piperModelsDir)) {
            console.log('✅ Piper models directory exists:', ttsConfig.piperModelsDir);
            
            // List model files
            import('fs').then(({ readdirSync }) => {
              try {
                const files = readdirSync(ttsConfig.piperModelsDir);
                const modelFiles = files.filter(file => file.endsWith('.onnx'));
                console.log('📁 Piper model files found:', modelFiles);
                
                if (modelFiles.length === 0) {
                  console.log('❌ No .onnx model files found in models directory');
                } else {
                  console.log('✅ Piper engine appears to be properly configured');
                }
              } catch (err) {
                console.log('❌ Could not read models directory:', err.message);
              }
            });
          } else {
            console.log('❌ Piper models directory does not exist:', ttsConfig.piperModelsDir);
            console.log('💡 Install Piper models by downloading .onnx files to the models directory');
          }
        } else {
          console.log('❌ Piper command not found. Install Piper TTS engine:');
          console.log('   pip install piper-tts');
        }
      });
    } catch (error) {
      console.log('❌ Error testing Piper:', error.message);
    }
  }

  // Test RHVoice
  if (ttsConfig.enabledProviders.includes('rhvoice')) {
    console.log('\nTesting RHVoice TTS engine...');
    
    const rhvoicePath = ttsConfig.rhvoiceBinPath;
    if (rhvoicePath && existsSync(rhvoicePath)) {
      console.log('✅ RHVoice binary exists:', rhvoicePath);
    } else {
      console.log('❌ RHVoice binary does not exist:', rhvoicePath);
      console.log('💡 Install RHVoice from: https://github.com/RHVoice/RHVoice');
    }
  }

  console.log('\n📋 To install TTS engines on Windows:');
  console.log('1. Install Python from https://www.python.org/');
  console.log('2. Install Piper: pip install piper-tts');
  console.log('3. Install FFmpeg from https://www.gyan.dev/ffmpeg/builds/');
  console.log('4. Download voice models to C:\\opt\\piper\\models');
  console.log('');
  console.log('💡 Pro tip: For development, you can also use WSL2 with Ubuntu');
  console.log('   which has better compatibility for TTS engines.');

  pool.end();
}

testTTSEngines();