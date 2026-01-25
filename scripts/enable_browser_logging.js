// Script to enable frontend logging - run this in browser console
// Navigate to http://localhost:3001/admin first, then open F12 console and paste this:

(function enableFrontendLogs() {
  // Enable frontend logging in localStorage
  const loggingConfig = {
    globalEnabled: true,
    globalLevel: 'debug',
    modules: {
      frontend: { enabled: true, level: 'debug' },
      api: { enabled: true, level: 'debug' },
      websocket: { enabled: true, level: 'debug' },
      auth: { enabled: true, level: 'debug' },
      database: { enabled: true, level: 'debug' },
      ui: { enabled: true, level: 'debug' },
      readingProgress: { enabled: true, level: 'debug' },
      books: { enabled: true, level: 'debug' },
      shelves: { enabled: true, level: 'debug' },
      comments: { enabled: true, level: 'debug' },
      reactions: { enabled: true, level: 'debug' },
      fileHandling: { enabled: true, level: 'debug' },
      performance: { enabled: true, level: 'debug' },
      errors: { enabled: true, level: 'debug' },
      userActions: { enabled: true, level: 'debug' }
    }
  };
  
  localStorage.setItem('loggingConfig', JSON.stringify(loggingConfig));
  console.warn('[SETUP] Frontend logging enabled - refreshing page...');
  window.location.reload();
})();