// Direct console override for TTS debugging
// Run this in browser console on the TTS admin page

(function enableDirectConsole() {
  console.warn('[DIRECT-CONSOLE] Enabling direct console output...');
  
  // Store original console methods
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  
  // Override console methods to always show output
  console.log = function(...args) {
    originalConsole.log.apply(console, args);
  };
  
  console.info = function(...args) {
    originalConsole.info.apply(console, args);
  };
  
  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
  };
  
  console.error = function(...args) {
    originalConsole.error.apply(console, args);
  };
  
  console.debug = function(...args) {
    originalConsole.debug.apply(console, args);
  };
  
  console.warn('[DIRECT-CONSOLE] Console methods overridden - TTS logs should now be visible');
  
  // Also try to force-enable the logger factory
  try {
    if (window.loggerFactory) {
      const config = window.loggerFactory.getConfig();
      config.globalEnabled = true;
      config.globalLevel = 'debug';
      config.modules.frontend.enabled = true;
      config.modules.frontend.level = 'debug';
      window.loggerFactory.updateConfig(config);
      console.warn('[DIRECT-CONSOLE] Logger factory forced to debug mode');
    }
  } catch (e) {
    console.warn('[DIRECT-CONSOLE] Could not force logger factory:', e);
  }
  
  // Test if our logging works
  console.warn('[DIRECT-CONSOLE] Test message - if you see this, logging is working!');
  
  // Reload the page to ensure fresh start
  console.warn('[DIRECT-CONSOLE] Reloading page...');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
})();