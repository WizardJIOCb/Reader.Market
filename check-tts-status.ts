import { db } from './server/storage';
import { ttsConfig, ttsJobs } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkTtsStatus() {
  try {
    console.log('=== TTS Configuration Status ===');
    
    // Check TTS config
    const config = await db.select().from(ttsConfig);
    console.log('TTS Config:', config);
    
    // Check recent TTS jobs
    const recentJobs = await db.select()
      .from(ttsJobs)
      .orderBy(ttsJobs.createdAt)
      .limit(10);
    
    console.log('\nRecent TTS Jobs:');
    recentJobs.forEach(job => {
      console.log(`- Job ${job.id}: ${job.status} (${job.textHash})`);
      if (job.errorMessage) {
        console.log(`  Error: ${job.errorMessage}`);
      }
    });
    
    // Check if Piper is installed
    const { spawn } = require('child_process');
    const piperProcess = spawn('piper', ['--help'], { timeout: 5000 });
    
    piperProcess.on('error', (err) => {
      console.log('\nPiper status: NOT INSTALLED or NOT IN PATH');
      console.log('Error:', err.message);
    });
    
    piperProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('\nPiper status: INSTALLED and WORKING');
      } else {
        console.log('\nPiper status: INSTALLED but returned exit code', code);
      }
    });
    
  } catch (error) {
    console.error('Error checking TTS status:', error);
  }
}

checkTtsStatus();