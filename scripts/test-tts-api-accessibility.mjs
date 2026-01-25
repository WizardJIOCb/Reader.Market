// Test TTS Config API accessibility
async function testTtsApiAccessibility() {
  try {
    console.log('Testing TTS API accessibility...');
    
    // Test health endpoint first
    const healthResponse = await fetch('http://localhost:5001/api/health');
    console.log('Health check:', healthResponse.status, healthResponse.ok ? 'OK' : 'FAILED');
    
    // Test TTS config endpoint (will fail without auth, but we can see if it's reachable)
    const configResponse = await fetch('http://localhost:5001/api/tts/admin/config');
    console.log('TTS Config endpoint status:', configResponse.status);
    
    if (configResponse.status === 401) {
      console.log('✅ TTS API is reachable but requires authentication (expected)');
    } else if (configResponse.ok) {
      console.log('✅ TTS API is accessible');
      const data = await configResponse.json();
      console.log('Config data:', data);
    } else {
      console.log('❌ TTS API returned unexpected status:', configResponse.status);
      const errorText = await configResponse.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Network error testing TTS API:', error.message);
  }
}

testTtsApiAccessibility();