// Quick test to check what the API returns
const http = require('http');

const token = process.argv[2];

if (!token) {
  console.log('Usage: node check_unread_api.cjs YOUR_AUTH_TOKEN');
  console.log('\nGet token from browser:');
  console.log('1. F12 -> Application -> Local Storage');
  console.log('2. Copy authToken value');
  process.exit(1);
}

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/conversations',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const conversations = JSON.parse(data);
      console.log('\n=== API Response ===\n');
      console.log(`Total conversations: ${conversations.length}\n`);
      
      if (conversations.length > 0) {
        const conv = conversations[0];
        console.log('First conversation:');
        console.log('  ID:', conv.id);
        console.log('  Other User:', conv.otherUser?.username);
        console.log('  unreadCount:', conv.unreadCount);
        console.log('  unreadCount type:', typeof conv.unreadCount);
        
        if (conv.unreadCount === undefined) {
          console.log('\n❌ PROBLEM: unreadCount is UNDEFINED');
          console.log('   Backend needs restart to include unreadCount field');
        } else if (conv.unreadCount === 1 && conversations.some(c => c.unreadCount > 1)) {
          console.log('\n⚠️  Some conversations have count > 1');
        } else {
          console.log('\n✅ unreadCount field exists');
        }
        
        console.log('\nAll unreadCounts:');
        conversations.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.otherUser?.username}: ${c.unreadCount ?? 'undefined'}`);
        });
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
});

req.end();
