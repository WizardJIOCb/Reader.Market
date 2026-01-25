// Force enable frontend logging - more aggressive approach
// Run this in browser console on the TTS admin page

(function forceEnableFrontendLogging() {
  console.warn('[FORCE-LOG] Starting forced logging enablement...');
  
  // Method 1: Direct localStorage manipulation
  const config = {
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
  
  localStorage.setItem('loggingConfig', JSON.stringify(config));
  console.warn('[FORCE-LOG] Config saved to localStorage');
  
  // Method 2: Try to update the logger factory directly
  try {
    if (window.loggerFactory) {
      window.loggerFactory.updateConfig(config);
      console.warn('[FORCE-LOG] Logger factory updated');
    }
  } catch (e) {
    console.warn('[FORCE-LOG] Could not update logger factory:', e);
  }
  
  // Method 3: Force reload with cache busting
  console.warn('[FORCE-LOG] Reloading page with cache bust...');
  window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'logging_debug=' + Date.now();
})();