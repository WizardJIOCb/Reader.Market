// Debug script to check conversation data in real-time
console.log('%c=== CONVERSATION LIST DEBUG ===', 'color: blue; font-size: 16px; font-weight: bold');

// Monitor conversation state updates
let originalSetState = null;

// Check if we're on messages page
if (window.location.pathname === '/messages') {
  console.log('✅ On messages page');
  
  // Wait a bit for React to load
  setTimeout(() => {
    // Try to access React internals to monitor state
    console.log('%cChecking conversation data...', 'color: orange; font-weight: bold');
    
    // Look for conversations in the DOM
    const conversationItems = document.querySelectorAll('[class*="cursor-pointer hover:bg-muted"]');
    console.log(`Found ${conversationItems.length} conversation items in DOM`);
    
    // Check for badges
    const badges = document.querySelectorAll('[class*="absolute -bottom-1 -left-1"]');
    console.log(`Found ${badges.length} unread badges in DOM`);
    
    if (badges.length > 0) {
      console.log('%c✅ Badges are in the DOM', 'color: green');
      badges.forEach((badge, i) => {
        console.log(`  Badge ${i + 1}: "${badge.textContent}"`);
      });
    } else {
      console.log('%c⚠️  No badges found in DOM', 'color: orange');
      console.log('This could mean:');
      console.log('  1. No unread messages');
      console.log('  2. unreadCount is 0 or undefined');
      console.log('  3. Badge component not rendering');
    }
    
    // Monitor fetch calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && url.includes('/api/conversations')) {
        console.log('%c📡 Fetching conversations...', 'color: blue; font-weight: bold');
        
        return originalFetch.apply(this, args).then(response => {
          const clonedResponse = response.clone();
          clonedResponse.json().then(data => {
            console.log('%c📊 Conversations data received:', 'color: green; font-weight: bold');
            console.log(`  Total: ${data.length} conversations`);
            
            if (data.length > 0) {
              console.table(data.map(conv => ({
                user: conv.otherUser?.username || 'Unknown',
                unreadCount: conv.unreadCount,
                hasLastMessage: !!conv.lastMessage,
                lastMessagePreview: conv.lastMessage?.content?.substring(0, 30)
              })));
              
              const hasUnread = data.some(c => c.unreadCount > 0);
              if (hasUnread) {
                console.log('%c✅ Found conversations with unread messages!', 'color: green');
              } else {
                console.log('%c⚠️  All conversations have unreadCount = 0', 'color: orange');
              }
            }
          });
          
          return response;
        });
      }
      return originalFetch.apply(this, args);
    };
    
    console.log('%c✅ Monitoring enabled', 'color: green');
    console.log('Send a test message and watch this console');
    
  }, 1000);
  
} else {
  console.log(`⚠️  Not on messages page (current: ${window.location.pathname})`);
  console.log('Navigate to /messages to use this debug script');
}

// Export helper function
window.debugConversations = function() {
  console.log('%c=== Manual Conversation Check ===', 'color: purple; font-size: 14px; font-weight: bold');
  
  const badges = document.querySelectorAll('[class*="absolute -bottom-1 -left-1"]');
  const conversationItems = document.querySelectorAll('[class*="p-4 border-b cursor-pointer"]');
  
  console.log(`DOM State:`);
  console.log(`  Conversation items: ${conversationItems.length}`);
  console.log(`  Visible badges: ${badges.length}`);
  
  if (badges.length > 0) {
    badges.forEach((badge, i) => {
      const parent = badge.closest('[class*="p-4 border-b"]');
      const username = parent?.querySelector('[class*="font-medium truncate"]')?.textContent;
      console.log(`  ${i + 1}. ${username}: badge shows "${badge.textContent}"`);
    });
  } else {
    console.log('  No badges visible - checking why...');
    
    // Check if any conversation items exist
    if (conversationItems.length === 0) {
      console.log('  ❌ No conversation items in DOM at all');
    } else {
      console.log('  ✅ Conversation items exist but no badges');
      console.log('  This means all unreadCount values are 0 or undefined');
    }
  }
  
  console.log('\nTo see full conversation data, check Network tab:');
  console.log('  1. Open DevTools → Network tab');
  console.log('  2. Filter: XHR');
  console.log('  3. Look for: /api/conversations');
  console.log('  4. Click on it → Response tab');
  console.log('  5. Check unreadCount field in the JSON');
};

console.log('\n%c💡 Run window.debugConversations() anytime to check current state', 'color: cyan; font-style: italic');
// Debug script to check conversation data in real-time
console.log('%c=== CONVERSATION LIST DEBUG ===', 'color: blue; font-size: 16px; font-weight: bold');

// Monitor conversation state updates
let originalSetState = null;

// Check if we're on messages page
if (window.location.pathname === '/messages') {
  console.log('✅ On messages page');
  
  // Wait a bit for React to load
  setTimeout(() => {
    // Try to access React internals to monitor state
    console.log('%cChecking conversation data...', 'color: orange; font-weight: bold');
    
    // Look for conversations in the DOM
    const conversationItems = document.querySelectorAll('[class*="cursor-pointer hover:bg-muted"]');
    console.log(`Found ${conversationItems.length} conversation items in DOM`);
    
    // Check for badges
    const badges = document.querySelectorAll('[class*="absolute -bottom-1 -left-1"]');
    console.log(`Found ${badges.length} unread badges in DOM`);
    
    if (badges.length > 0) {
      console.log('%c✅ Badges are in the DOM', 'color: green');
      badges.forEach((badge, i) => {
        console.log(`  Badge ${i + 1}: "${badge.textContent}"`);
      });
    } else {
      console.log('%c⚠️  No badges found in DOM', 'color: orange');
      console.log('This could mean:');
      console.log('  1. No unread messages');
      console.log('  2. unreadCount is 0 or undefined');
      console.log('  3. Badge component not rendering');
    }
    
    // Monitor fetch calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && url.includes('/api/conversations')) {
        console.log('%c📡 Fetching conversations...', 'color: blue; font-weight: bold');
        
        return originalFetch.apply(this, args).then(response => {
          const clonedResponse = response.clone();
          clonedResponse.json().then(data => {
            console.log('%c📊 Conversations data received:', 'color: green; font-weight: bold');
            console.log(`  Total: ${data.length} conversations`);
            
            if (data.length > 0) {
              console.table(data.map(conv => ({
                user: conv.otherUser?.username || 'Unknown',
                unreadCount: conv.unreadCount,
                hasLastMessage: !!conv.lastMessage,
                lastMessagePreview: conv.lastMessage?.content?.substring(0, 30)
              })));
              
              const hasUnread = data.some(c => c.unreadCount > 0);
              if (hasUnread) {
                console.log('%c✅ Found conversations with unread messages!', 'color: green');
              } else {
                console.log('%c⚠️  All conversations have unreadCount = 0', 'color: orange');
              }
            }
          });
          
          return response;
        });
      }
      return originalFetch.apply(this, args);
    };
    
    console.log('%c✅ Monitoring enabled', 'color: green');
    console.log('Send a test message and watch this console');
    
  }, 1000);
  
} else {
  console.log(`⚠️  Not on messages page (current: ${window.location.pathname})`);
  console.log('Navigate to /messages to use this debug script');
}

// Export helper function
window.debugConversations = function() {
  console.log('%c=== Manual Conversation Check ===', 'color: purple; font-size: 14px; font-weight: bold');
  
  const badges = document.querySelectorAll('[class*="absolute -bottom-1 -left-1"]');
  const conversationItems = document.querySelectorAll('[class*="p-4 border-b cursor-pointer"]');
  
  console.log(`DOM State:`);
  console.log(`  Conversation items: ${conversationItems.length}`);
  console.log(`  Visible badges: ${badges.length}`);
  
  if (badges.length > 0) {
    badges.forEach((badge, i) => {
      const parent = badge.closest('[class*="p-4 border-b"]');
      const username = parent?.querySelector('[class*="font-medium truncate"]')?.textContent;
      console.log(`  ${i + 1}. ${username}: badge shows "${badge.textContent}"`);
    });
  } else {
    console.log('  No badges visible - checking why...');
    
    // Check if any conversation items exist
    if (conversationItems.length === 0) {
      console.log('  ❌ No conversation items in DOM at all');
    } else {
      console.log('  ✅ Conversation items exist but no badges');
      console.log('  This means all unreadCount values are 0 or undefined');
    }
  }
  
  console.log('\nTo see full conversation data, check Network tab:');
  console.log('  1. Open DevTools → Network tab');
  console.log('  2. Filter: XHR');
  console.log('  3. Look for: /api/conversations');
  console.log('  4. Click on it → Response tab');
  console.log('  5. Check unreadCount field in the JSON');
};

console.log('\n%c💡 Run window.debugConversations() anytime to check current state', 'color: cyan; font-style: italic');
