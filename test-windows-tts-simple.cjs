const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Windows TTS...');

const tempFile = path.join(require('os').tmpdir(), 'test-tts.wav');
console.log('Temp file:', tempFile);

const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$stream = New-Object System.IO.FileStream('${tempFile.replace(/\\/g, '\\\\')}', [System.IO.FileMode]::Create)
$synth.SetOutputToWaveStream($stream)
$synth.Speak('Test')
$stream.Close()
`;

console.log('Running PowerShell script...');
const child = spawn('powershell.exe', ['-Command', psScript]);

child.stdout.on('data', (data) => {
  console.log('stdout:', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('stderr:', data.toString());
});

child.on('close', (code) => {
  console.log('PowerShell exit code:', code);
  console.log('File exists:', fs.existsSync(tempFile));
  if (fs.existsSync(tempFile)) {
    console.log('File size:', fs.statSync(tempFile).size, 'bytes');
    // fs.unlinkSync(tempFile); // Uncomment to delete test file
  }
});