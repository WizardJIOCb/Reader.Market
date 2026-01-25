const fs = require('fs');
const path = require('path');

// Проверим последние файлы
const audioDir = path.join(__dirname, 'uploads', 'audio');
const files = fs.readdirSync(audioDir);

console.log('Audio files:');
files.forEach(file => {
  const filePath = path.join(audioDir, file);
  const stats = fs.statSync(filePath);
  console.log(`${file}: ${stats.size} bytes, created: ${stats.birthtime}`);
  
  if (file.endsWith('.txt')) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`  Content: "${content}"`);
  }
});