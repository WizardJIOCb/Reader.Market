// Test to simulate the exact user scenario
const fetch = require('node-fetch');

async function testExactUserScenario() {
  try {
    console.log('=== Testing Exact User Scenario ===\n');
    
    // The user mentioned http://localhost:3001/profile/WizardJIOCb
    // But we found this user doesn't exist. Let's check what happens
    // when we try to access this profile
    
    console.log('Testing non-existent user WizardJIOCb:');
    const response1 = await fetch('http://localhost:3001/api/profile/WizardJIOCb/activities');
    
    console.log('Status:', response1.status);
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('Activities count:', data1.activities?.length || 0);
    } else {
      console.log('Error:', response1.statusText);
    }
    
    console.log('\nTesting lowercase wizardjiocb:');
    const response2 = await fetch('http://localhost:3001/api/profile/wizardjiocb/activities');
    
    console.log('Status:', response2.status);
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('Activities count:', data2.activities?.length || 0);
      
      if (data2.activities && data2.activities.length > 0) {
        console.log('\nSample activities:');
        data2.activities.slice(0, 3).forEach((activity, index) => {
          console.log(`${index + 1}. Type: ${activity.type}, ID: ${activity.id}`);
          console.log(`   Book ID: ${activity.bookId || activity.metadata?.book_id}`);
          console.log(`   Has readingProgress: ${!!activity.metadata?.readingProgress}`);
          if (activity.metadata?.readingProgress) {
            console.log(`   Reading Progress: ${activity.metadata.readingProgress.percentage}%`);
          }
          console.log('');
        });
      }
    } else {
      console.log('Error:', response2.statusText);
    }
    
    // Also test the user ID we found earlier
    console.log('\nTesting user ID fb85056f-7f4e-4169-ab3a-cdc54667ff54 (wizardjiocb):');
    const response3 = await fetch('http://localhost:3001/api/profile/fb85056f-7f4e-4169-ab3a-cdc54667ff54/activities');
    
    console.log('Status:', response3.status);
    if (response3.ok) {
      const data3 = await response3.json();
      console.log('Activities count:', data3.activities?.length || 0);
    } else {
      console.log('Error:', response3.statusText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testExactUserScenario();