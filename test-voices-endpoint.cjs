const { spawn } = require('child_process');

async function testVoicesEndpoint() {
  // First get a valid token by logging in
  console.log('Getting auth token...');
  
  const loginProcess = spawn('curl', [
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({
      email: 'wizard@example.com',
      password: 'password123'
    }),
    'http://localhost:3001/api/auth/login'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  
  let loginOutput = '';
  loginProcess.stdout.on('data', (data) => {
    loginOutput += data.toString();
  });
  
  loginProcess.on('close', async (code) => {
    if (code === 0) {
      try {
        const loginResult = JSON.parse(loginOutput);
        const token = loginResult.token;
        console.log('Got token:', token.substring(0, 20) + '...');
        
        // Test voices endpoint
        console.log('\nTesting voices endpoint...');
        const voicesProcess = spawn('curl', [
          '-H', `Authorization: Bearer ${token}`,
          'http://localhost:3001/api/tts/voices?provider=windows&lang=en'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        
        voicesProcess.stdout.on('data', (data) => {
          console.log('Voices response:', data.toString());
        });
        
        voicesProcess.stderr.on('data', (data) => {
          console.error('Voices error:', data.toString());
        });
        
      } catch (error) {
        console.error('Error parsing login response:', error);
      }
    } else {
      console.error('Login failed with code:', code);
      console.error('Login output:', loginOutput);
    }
  });
}

testVoicesEndpoint();