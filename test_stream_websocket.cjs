const io = require('socket.io-client');

// Get auth token from command line (optional)
const token = process.argv[2];

if (token) {
  console.log('🔐 Testing with authentication token...');
} else {
  console.log('🌐 Testing WITHOUT authentication (guest mode)...');
}

console.log('Connecting to WebSocket server...');
const socket = io('http://localhost:5001', {
  auth: token ? { token } : {},
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('\n✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
  
  // Join global stream
  console.log('\nJoining global stream room...');
  socket.emit('join:stream:global');
  
  // Listen for stream events
  socket.on('stream:new-activity', (activity) => {
    console.log('\n🎉 NEW ACTIVITY RECEIVED:', JSON.stringify(activity, null, 2));
  });
  
  console.log('\n✅ Ready to receive stream events!');
  console.log('Waiting for new activities...');
  console.log('\nTip: Post a comment on a book in another browser tab to test real-time updates\n');
});

socket.on('connect_error', (error) => {
  console.error('\n❌ Connection error:', error.message);
  console.error('Make sure the server is running on http://localhost:5001');
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ Disconnected:', reason);
});

// Keep script running
console.log('\nPress Ctrl+C to exit\n');
