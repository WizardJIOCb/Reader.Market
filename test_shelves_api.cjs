const https = require('https');

// Test the shelves API endpoint
async function testShelvesAPI() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDVkYjkwZi00NjkxLTQyODEtOTkxZS1iMmUyNDhlMzM5MTUiLCJpYXQiOjE3NzE2NTY4ODcsImV4cCI6MTc3MjI2MTY4N30.YourActualToken'; // Replace with a valid token
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/shelves',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers: ${JSON.stringify(res.headers)}`);
        console.log(`Body: ${data}`);
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });
    
    req.end();
  });
}

testShelvesAPI()
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));