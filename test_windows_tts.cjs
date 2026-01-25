const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Тест системного TTS через PowerShell
function testWindowsTTS() {
  const text = "Могучие герои сражаются за право властвовать над Галактикой";
  const outputFile = path.join(__dirname, 'uploads', 'audio', 'test_windows_tts.wav');
  
  // Создаем PowerShell скрипт для SAPI
  const psScript = `
  Add-Type -AssemblyName System.Speech
  $speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $speech.Rate = 0
  $speech.Volume = 100
  $speech.SetOutputToWaveFile("${outputFile}")
  $speech.Speak("${text}")
  $speech.Dispose()
  `;
  
  console.log('Testing Windows SAPI TTS...');
  
  const ps = spawn('powershell', ['-Command', psScript]);
  
  ps.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  
  ps.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  
  ps.on('close', (code) => {
    console.log(`PowerShell process exited with code ${code}`);
    if (code === 0) {
      // Проверим созданный файл
      if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        console.log(`Success! Created ${outputFile}`);
        console.log(`File size: ${stats.size} bytes`);
      } else {
        console.log('File was not created');
      }
    }
  });
}

testWindowsTTS();