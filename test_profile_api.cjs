const http = require('http');

// Test the profile endpoint with a fake token to see if it returns JSON or HTML
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/profile/605db90f-4691-4281-991e-b2e248e33915',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer fake_token_for_testing'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers['content-type']);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body starts with:', data.substring(0, 100));
    console.log('Is HTML?', data.startsWith('<'));
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();