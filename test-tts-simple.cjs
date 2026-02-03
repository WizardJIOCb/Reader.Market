const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test text
const testText = "Hello world. This is a test of text to speech functionality.";

// Test with English model
console.log('Testing English TTS...');
const outputPath = path.join(__dirname, 'test-output.wav');

const piperProcess = spawn('piper', [
  '--model', 'C:\\opt\\piper\\models\\en_US-lessac-medium.onnx',
  '--config', 'C:\\opt\\piper\\models\\en_US-lessac-medium.onnx.json',
  '--input-file', '-', // Read from stdin
  '--output-file', outputPath
]);

piperProcess.stdin.write(testText);
piperProcess.stdin.end();

piperProcess.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

piperProcess.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

piperProcess.on('close', (code) => {
  console.log(`Piper process exited with code ${code}`);
  if (code === 0 && fs.existsSync(outputPath)) {
    console.log('SUCCESS: Audio file created at', outputPath);
    console.log('File size:', fs.statSync(outputPath).size, 'bytes');
  } else {
    console.log('FAILED: Audio file not created');
  }
});

piperProcess.on('error', (err) => {
  console.log('Failed to start Piper:', err.message);
});