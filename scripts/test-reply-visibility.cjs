#!/usr/bin/env node

const fetch = require('node-fetch');

async function testReplyVisibility() {
  console.log('=== Testing Reply Visibility in Last Activity ===\n');
  
  try {
    // Test 1: Create a parent comment
    console.log('1. Creating parent comment...');
    const parentResponse = await fetch('http://localhost:5001/api/books/cba2883e-a92f-4245-ae04-6f16d0c2bb36/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDVkYjkwZi00NjkxLTQyODEtOTkxZS1iMmUyNDhlMzM5MTUiLCJ1c2VybmFtZSI6IldpemFyZEpJT0NiIiwiaWF0IjoxNzczNTQ4MzYyLCJleHAiOjE3NzM2MzQ3NjJ9.VOYvW9dH8vK8zX8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8'
      },
      body: JSON.stringify({
        content: 'Test parent comment for reply visibility test'
      })
    });
    
    const parentData = await parentResponse.json();
    console.log('Parent comment created:', parentData.id);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Create a reply to the parent comment
    console.log('\n2. Creating reply to parent comment...');
    const replyResponse = await fetch('http://localhost:5001/api/books/cba2883e-a92f-4245-ae04-6f16d0c2bb36/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjNzgxYmZlMC1hNTdjLTRjOTctOWE3My1iZjY2NmM2NDdiZDAiLCJ1c2VybmFtZSI6IkthaGltdWxsaW4gUm9kaW9uIERhbnJvdmljaCIsImlhdCI6MTc3MzU0ODM2MiwiZXhwIjoxNzczNjM0NzYyfQ.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
      },
      body: JSON.stringify({
        content: 'Test reply to parent comment',
        parentCommentId: parentData.id
      })
    });
    
    const replyData = await replyResponse.json();
    console.log('Reply created:', replyData.id);
    
    // Wait for WebSocket propagation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Check if reply appears in Last Activity
    console.log('\n3. Checking Last Activity for reply visibility...');
    const activityResponse = await fetch('http://localhost:5001/api/profile/c781bfe0-a57c-4c97-9a73-bf666c647bd0/activities');
    const activityData = await activityResponse.json();
    
    console.log('Activities count:', activityData.activities?.length);
    
    // Look for our parent comment
    const parentActivity = activityData.activities?.find(a => a.id === parentData.id);
    if (parentActivity) {
      console.log('Parent activity found in Last Activity');
      console.log('Parent reply count:', parentActivity.metadata?.replyCount);
      console.log('Parent replies array length:', parentActivity.metadata?.replies?.length || 0);
      
      if (parentActivity.metadata?.replies?.length > 0) {
        console.log('✅ Reply is visible in Last Activity!');
        parentActivity.metadata.replies.forEach((reply, index) => {
          console.log(`  Reply ${index + 1}: ${reply.metadata?.content_preview}`);
        });
      } else {
        console.log('❌ Reply is NOT visible in Last Activity');
      }
    } else {
      console.log('❌ Parent activity not found in Last Activity');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testReplyVisibility();