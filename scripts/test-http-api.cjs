// This script tests the actual API endpoint by making a real HTTP request
const http = require('http');

async function testActualApiEndpoint() {
  console.log('=== Testing Actual API Endpoint via HTTP ===\n');
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/profile/WizardJIOCb/activities',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('\n=== API Response ===');
          console.log(JSON.stringify(jsonData, null, 2));
          
          console.log(`\nActivities count: ${jsonData.activities?.length || 0}`);
          
          if (jsonData.activities && jsonData.activities.length > 0) {
            console.log('\nActivity types found:');
            const typeCounts = {};
            jsonData.activities.forEach(activity => {
              const type = activity.type;
              typeCounts[type] = (typeCounts[type] || 0) + 1;
            });
            
            Object.entries(typeCounts).forEach(([type, count]) => {
              console.log(`  ${type}: ${count}`);
            });
            
            const subscribedComments = jsonData.activities.filter(a => a.type === 'subscribed_comment');
            console.log(`\nSubscribed comments: ${subscribedComments.length}`);
            subscribedComments.forEach((comment, index) => {
              console.log(`  ${index + 1}. ${comment.metadata?.author_name}: "${comment.metadata?.content_preview}"`);
            });
          }
          
          resolve(jsonData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          console.error('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.end();
  });
}

testActualApiEndpoint().catch(console.error);