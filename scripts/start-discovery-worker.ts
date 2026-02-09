#!/usr/bin/env node

/**
 * Script to start the discovery worker process
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('Starting discovery worker process...');

// Path to the discovery worker script
const workerScriptPath = path.join(__dirname, '../server/workers/discoveryWorker.ts');

// Spawn the worker process
const childProcess = spawn('npx', ['tsx', workerScriptPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

childProcess.on('error', (err) => {
  console.error('Failed to start discovery worker process:', err);
  process.exit(1);
});

childProcess.on('close', (code) => {
  if (code === 0) {
    console.log('Discovery worker process completed successfully!');
  } else {
    console.error(`Discovery worker process exited with code ${code}`);
    process.exit(code || 1);
  }
});

// Handle interruption signals
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, terminating discovery worker process...');
  childProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, terminating discovery worker process...');
  childProcess.kill('SIGTERM');
});