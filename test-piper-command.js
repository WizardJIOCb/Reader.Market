/**
 * Script to test the Piper TTS command directly
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function testPiperCommand() {
  console.log('Testing Piper TTS command...\n');

  // Test if piper command is available
  console.log('1. Testing if Piper command is available...');
  
  const piperProc = spawn('cmd', ['/c', 'piper', '--help'], { shell: true });
  let stdout = '';
  let stderr = '';

  piperProc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  piperProc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  piperProc.on('close', (code) => {
    console.log('Return code:', code);
    if (code === 0) {
      console.log('✅ Piper command is available');
      console.log('Piper help output (first 500 chars):', stdout.substring(0, 500));
    } else {
      console.log('❌ Piper command failed or is not available');
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }

    // Test model availability
    console.log('\n2. Checking model files...');
    const modelsDir = 'C:\\opt\\piper\\models';
    if (fs.existsSync(modelsDir)) {
      console.log('✅ Models directory exists:', modelsDir);
      const files = fs.readdirSync(modelsDir);
      console.log('Model files found:', files);
      
      // Check if required models exist
      const requiredModels = [
        'en_US-lessac-medium.onnx',
        'ru_RU-irina-medium.onnx'
      ];
      
      requiredModels.forEach(model => {
        const modelPath = path.join(modelsDir, model);
        if (fs.existsSync(modelPath)) {
          const stats = fs.statSync(modelPath);
          console.log(`✅ ${model} exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.log(`❌ ${model} does not exist`);
        }
      });
    } else {
      console.log('❌ Models directory does not exist:', modelsDir);
    }

    // Try a simple Piper test with a short text
    console.log('\n3. Testing Piper with sample text...');
    const testText = "Hello world";
    const modelPath = 'C:\\opt\\piper\\models\\en_US-lessac-medium.onnx';
    
    if (fs.existsSync(modelPath)) {
      const tempOutput = path.join(process.cwd(), 'temp_test.wav');
      const args = [
        '--model', modelPath,
        '--output_file', tempOutput
      ];

      console.log('Running command: piper', args.join(' '));
      
      const testProc = spawn('cmd', ['/c', 'piper'].concat(args), { shell: true });
      let testStdout = '';
      let testStderr = '';

      testProc.stdout.on('data', (data) => {
        testStdout += data.toString();
      });

      testProc.stderr.on('data', (data) => {
        testStderr += data.toString();
      });

      testProc.on('close', (testCode) => {
        console.log('Piper test return code:', testCode);
        if (testCode === 0) {
          console.log('✅ Piper test successful');
          if (fs.existsSync(tempOutput)) {
            const stats = fs.statSync(tempOutput);
            console.log(`✅ Output file created (${(stats.size / 1024).toFixed(2)} KB)`);
            // Clean up temp file
            fs.unlinkSync(tempOutput);
          }
        } else {
          console.log('❌ Piper test failed');
          console.log('stdout:', testStdout);
          console.log('stderr:', testStderr);
        }
      });
    } else {
      console.log('Cannot test Piper - model file does not exist');
    }
  });
}

testPiperCommand();