// Test TTS config fetching
import fetch from 'node-fetch';

async function testTtsConfigFetch() {
  try {
    console.log('Testing TTS config fetch...');
    
    // Test the public config endpoint (without auth)
    const response = await fetch('http://localhost:5001/api/tts/config');
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Public config data:', data);
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

testTtsConfigFetch();