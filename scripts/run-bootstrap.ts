#!/usr/bin/env node

/**
 * Script to run the global catalog bootstrap process
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('Starting global catalog bootstrap process...');

// Path to the bootstrap script
const bootstrapScriptPath = path.join(__dirname, '../scripts/bootstrap_global_books.ts');

// Spawn the bootstrap process
const childProcess = spawn('npx', ['tsx', bootstrapScriptPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

childProcess.on('error', (err) => {
  console.error('Failed to start bootstrap process:', err);
  process.exit(1);
});

childProcess.on('close', (code) => {
  if (code === 0) {
    console.log('Bootstrap process completed successfully!');
  } else {
    console.error(`Bootstrap process exited with code ${code}`);
    process.exit(code || 1);
  }
});

// Handle interruption signals
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, terminating bootstrap process...');
  childProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, terminating bootstrap process...');
  childProcess.kill('SIGTERM');
});