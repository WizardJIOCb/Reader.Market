const fetch = require('node-fetch');

async function testUnreadCounts() {
  const BASE_URL = 'http://localhost:5001';
  
  console.log('Testing Unread Counts API\n');
  console.log('='.repeat(50));
  
  // You'll need to get a valid token from the browser
  // Open DevTools -> Application -> LocalStorage -> authToken
  const token = process.argv[2];
  
  if (!token) {
    console.log('Usage: node test_unread_counts.cjs <auth-token>');
    console.log('\nTo get your auth token:');
    console.log('1. Open http://localhost:3001 in browser');
    console.log('2. Open DevTools (F12)');
    console.log('3. Go to Application tab -> Local Storage');
    console.log('4. Copy the value of "authToken"');
    console.log('5. Run: node test_unread_counts.cjs "YOUR_TOKEN_HERE"');
    return;
  }
  
  try {
    // Test conversations endpoint
    console.log('\n1. Testing GET /api/conversations');
    console.log('-'.repeat(50));
    const convResponse = await fetch(`${BASE_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!convResponse.ok) {
      console.error('Error:', convResponse.status, convResponse.statusText);
      const text = await convResponse.text();
      console.error('Response:', text.substring(0, 200));
    } else {
      const conversations = await convResponse.json();
      console.log(`✓ Found ${conversations.length} conversations`);
      
      if (conversations.length > 0) {
        console.log('\nFirst conversation:');
        const conv = conversations[0];
        console.log('  ID:', conv.id);
        console.log('  Other User:', conv.otherUser?.username);
        console.log('  Last Message:', conv.lastMessage?.content?.substring(0, 50));
        console.log('  Unread Count:', conv.unreadCount !== undefined ? conv.unreadCount : '❌ MISSING');
        
        if (conv.unreadCount !== undefined) {
          console.log('\n  ✅ unreadCount field is present!');
        } else {
          console.log('\n  ❌ unreadCount field is MISSING - backend needs restart!');
        }
      }
    }
    
    // Test groups endpoint
    console.log('\n\n2. Testing GET /api/groups');
    console.log('-'.repeat(50));
    const groupsResponse = await fetch(`${BASE_URL}/api/groups`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!groupsResponse.ok) {
      console.error('Error:', groupsResponse.status, groupsResponse.statusText);
    } else {
      const groups = await groupsResponse.json();
      console.log(`✓ Found ${groups.length} groups`);
      
      if (groups.length > 0) {
        console.log('\nFirst group:');
        const group = groups[0];
        console.log('  ID:', group.id);
        console.log('  Name:', group.name);
        console.log('  Member Count:', group.memberCount);
        console.log('  Unread Count:', group.unreadCount !== undefined ? group.unreadCount : '❌ MISSING');
        
        if (group.unreadCount !== undefined) {
          console.log('\n  ✅ unreadCount field is present!');
        } else {
          console.log('\n  ❌ unreadCount field is MISSING - backend needs restart!');
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\nNext steps:');
    console.log('1. If unreadCount is MISSING, restart the backend server');
    console.log('2. Run: npm run dev');
    console.log('3. Refresh http://localhost:3001/messages in browser');
    console.log('4. Check browser console for conversation data');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUnreadCounts();
const fetch = require('node-fetch');

async function testUnreadCounts() {
  const BASE_URL = 'http://localhost:5001';
  
  console.log('Testing Unread Counts API\n');
  console.log('='.repeat(50));
  
  // You'll need to get a valid token from the browser
  // Open DevTools -> Application -> LocalStorage -> authToken
  const token = process.argv[2];
  
  if (!token) {
    console.log('Usage: node test_unread_counts.cjs <auth-token>');
    console.log('\nTo get your auth token:');
    console.log('1. Open http://localhost:3001 in browser');
    console.log('2. Open DevTools (F12)');
    console.log('3. Go to Application tab -> Local Storage');
    console.log('4. Copy the value of "authToken"');
    console.log('5. Run: node test_unread_counts.cjs "YOUR_TOKEN_HERE"');
    return;
  }
  
  try {
    // Test conversations endpoint
    console.log('\n1. Testing GET /api/conversations');
    console.log('-'.repeat(50));
    const convResponse = await fetch(`${BASE_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!convResponse.ok) {
      console.error('Error:', convResponse.status, convResponse.statusText);
      const text = await convResponse.text();
      console.error('Response:', text.substring(0, 200));
    } else {
      const conversations = await convResponse.json();
      console.log(`✓ Found ${conversations.length} conversations`);
      
      if (conversations.length > 0) {
        console.log('\nFirst conversation:');
        const conv = conversations[0];
        console.log('  ID:', conv.id);
        console.log('  Other User:', conv.otherUser?.username);
        console.log('  Last Message:', conv.lastMessage?.content?.substring(0, 50));
        console.log('  Unread Count:', conv.unreadCount !== undefined ? conv.unreadCount : '❌ MISSING');
        
        if (conv.unreadCount !== undefined) {
          console.log('\n  ✅ unreadCount field is present!');
        } else {
          console.log('\n  ❌ unreadCount field is MISSING - backend needs restart!');
        }
      }
    }
    
    // Test groups endpoint
    console.log('\n\n2. Testing GET /api/groups');
    console.log('-'.repeat(50));
    const groupsResponse = await fetch(`${BASE_URL}/api/groups`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!groupsResponse.ok) {
      console.error('Error:', groupsResponse.status, groupsResponse.statusText);
    } else {
      const groups = await groupsResponse.json();
      console.log(`✓ Found ${groups.length} groups`);
      
      if (groups.length > 0) {
        console.log('\nFirst group:');
        const group = groups[0];
        console.log('  ID:', group.id);
        console.log('  Name:', group.name);
        console.log('  Member Count:', group.memberCount);
        console.log('  Unread Count:', group.unreadCount !== undefined ? group.unreadCount : '❌ MISSING');
        
        if (group.unreadCount !== undefined) {
          console.log('\n  ✅ unreadCount field is present!');
        } else {
          console.log('\n  ❌ unreadCount field is MISSING - backend needs restart!');
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\nNext steps:');
    console.log('1. If unreadCount is MISSING, restart the backend server');
    console.log('2. Run: npm run dev');
    console.log('3. Refresh http://localhost:3001/messages in browser');
    console.log('4. Check browser console for conversation data');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUnreadCounts();
