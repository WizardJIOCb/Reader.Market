const WindowsTtsProvider = require('C:\\Projects\\reader.market\\server\\services\\tts\\windows-tts-provider.cjs');

async function testWindowsTts() {
  console.log('=== Testing Windows TTS ===');
  
  const provider = new WindowsTtsProvider();
  
  try {
    // Test 1: List voices
    console.log('\n1. Listing available voices...');
    const englishVoices = await provider.listVoices('en');
    console.log('English voices:', englishVoices);
    
    const russianVoices = await provider.listVoices('ru');
    console.log('Russian voices:', russianVoices);
    
    if (englishVoices.length === 0 && russianVoices.length === 0) {
      console.log('❌ No voices found!');
      return;
    }
    
    // Test 2: Generate audio
    console.log('\n2. Generating test audio...');
    const testText = "Hello world. This is a test of Windows text to speech.";
    const outputPath = './windows-tts-test.wav';
    
    const voice = englishVoices[0]?.id || russianVoices[0]?.id;
    if (!voice) {
      console.log('❌ No suitable voice found');
      return;
    }
    
    await provider.synthesizeToWav(testText, {
      lang: 'en',
      voice: voice,
      rate: 1.0
    }, outputPath);
    
    console.log('✅ SUCCESS: Audio generated');
    console.log('   Output file:', outputPath);
    console.log('   File size:', require('fs').statSync(outputPath).size, 'bytes');
    
    // Clean up
    require('fs').unlinkSync(outputPath);
    console.log('   Cleaned up test file');
    
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('Error details:', error.stack);
  }
}

testWindowsTts();