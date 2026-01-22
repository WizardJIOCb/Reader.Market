// Test script to create a comment and check if it appears in Last Activity
const fetch = require('node-fetch');

async function testLastActivity() {
  try {
    console.log('Testing Last Activity subscription functionality...\n');
    
    // First, let's login to get auth token
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:5001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'WizardJIOCb',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('Login failed');
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Logged in successfully\n');
    
    // Create a comment on the book
    console.log('2. Creating comment on book c64beca1-0bfe-4d9c-95e2-bebcabd53bb8...');
    const commentResponse = await fetch('http://localhost:5001/api/books/c64beca1-0bfe-4d9c-95e2-bebcabd53bb8/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: 'Test comment to trigger subscription - ' + new Date().toISOString()
      })
    });
    
    if (!commentResponse.ok) {
      console.error('Failed to create comment:', await commentResponse.text());
      return;
    }
    
    const commentData = await commentResponse.json();
    console.log('✅ Comment created with ID:', commentData.id, '\n');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check Last Activity for this user
    console.log('3. Checking Last Activity for WizardJIOCb...');
    const activitiesResponse = await fetch('http://localhost:5001/api/profile/WizardJIOCb/activities');
    
    if (!activitiesResponse.ok) {
      console.error('Failed to fetch activities:', await activitiesResponse.text());
      return;
    }
    
    const activitiesData = await activitiesResponse.json();
    console.log(`✅ Found ${activitiesData.activities.length} activities\n`);
    
    // Look for our comment
    const ourComment = activitiesData.activities.find(a => a.id === commentData.id);
    if (ourComment) {
      console.log('✅ Our comment found in Last Activity!');
      console.log('Comment content:', ourComment.metadata.content);
      console.log('Comment type:', ourComment.type);
    } else {
      console.log('❌ Our comment NOT found in Last Activity');
      console.log('All activities:');
      activitiesData.activities.forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.type} - ${activity.id} - ${activity.metadata?.content_preview || activity.metadata?.title || 'No content'}`);
      });
    }
    
    // Also check if subscription was created
    console.log('\n4. Checking database for subscription...');
    const { Client } = require('pg');
    const client = new Client({
      connectionString: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
    });
    
    await client.connect();
    
    const subscriptions = await client.query(`
      SELECT * FROM subscriptions 
      WHERE user_id = '605db90f-4691-4281-991e-b2e248e33915' 
      AND entity_type = 'book' 
      AND entity_id = 'c64beca1-0bfe-4d9c-95e2-bebcabd53bb8'
    `);
    
    if (subscriptions.rows.length > 0) {
      console.log('✅ Subscription found in database!');
      console.log('Subscription created at:', subscriptions.rows[0].created_at);
    } else {
      console.log('❌ No subscription found');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLastActivity();