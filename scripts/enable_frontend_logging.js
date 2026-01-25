// Temporary script to enable frontend logging for debugging
// Run this in the browser console on the admin page

(function enableFrontendLogging() {
  // Create development logging configuration
  const devConfig = {
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
  
  // Save to localStorage
  localStorage.setItem('loggingConfig', JSON.stringify(devConfig));
  
  // Force reload to apply configuration
  console.warn('[DEBUG] Frontend logging enabled - reloading page to apply configuration');
  window.location.reload();
})();