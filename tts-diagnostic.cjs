const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== TTS System Test ===');

// Test 1: Check if piper is accessible
console.log('\n1. Testing Piper availability...');
try {
  const piperCheck = spawn('piper', ['--help'], { timeout: 5000 });
  
  piperCheck.on('error', (err) => {
    console.log('❌ Piper not found or not in PATH:', err.message);
  });
  
  piperCheck.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ Piper is installed and accessible');
    } else {
      console.log('❌ Piper returned exit code:', code);
    }
  });
} catch (error) {
  console.log('❌ Error checking Piper:', error.message);
}

// Test 2: Check model files
console.log('\n2. Checking model files...');
const modelPath = 'C:\\opt\\piper\\models\\en_US-lessac-medium.onnx';
const configPath = 'C:\\opt\\piper\\models\\en_US-lessac-medium.onnx.json';

if (fs.existsSync(modelPath)) {
  console.log('✅ English model found:', modelPath);
  console.log('   Size:', fs.statSync(modelPath).size, 'bytes');
} else {
  console.log('❌ English model not found:', modelPath);
}

if (fs.existsSync(configPath)) {
  console.log('✅ English config found:', configPath);
} else {
  console.log('❌ English config not found:', configPath);
}

// Test 3: Simple TTS generation
console.log('\n3. Testing TTS generation...');
const testText = "Hello world. This is a TTS test.";
const outputPath = path.join(__dirname, 'tts-test-output.wav');

const piper = spawn('piper', [
  '--model', modelPath,
  '--config', configPath,
  '--input-file', '-',
  '--output-file', outputPath
]);

let stderrOutput = '';

piper.stdin.write(testText);
piper.stdin.end();

piper.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

piper.stderr.on('data', (data) => {
  stderrOutput += data.toString();
});

piper.on('close', (code) => {
  console.log(`Piper exited with code: ${code}`);
  if (stderrOutput) {
    console.log('STDERR output:', stderrOutput);
  }
  
  if (code === 0 && fs.existsSync(outputPath)) {
    const fileSize = fs.statSync(outputPath).size;
    console.log('✅ SUCCESS: Audio generated');
    console.log('   Output file:', outputPath);
    console.log('   File size:', fileSize, 'bytes');
    
    // Clean up
    fs.unlinkSync(outputPath);
    console.log('   Cleaned up test file');
  } else {
    console.log('❌ FAILED: Audio not generated');
    if (!fs.existsSync(outputPath)) {
      console.log('   Output file was not created');
    }
  }
});

piper.on('error', (err) => {
  console.log('❌ Failed to start Piper:', err.message);
});