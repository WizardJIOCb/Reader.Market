// Frontend Logger Integration
// Sends frontend logs to the backend aggregator

class FrontendLogger {
  private sessionId: string;
  private isEnabled: boolean = false; // DISABLED BY DEFAULT
  private logQueue: Array<any> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastFlushTime: number = 0;
  private readonly FLUSH_INTERVAL = 5000; // Flush every 5 seconds
  private readonly MAX_QUEUE_SIZE = 50; // Max logs in queue
  
  constructor() {
    // Generate or retrieve session ID
    this.sessionId = this.getSessionId();
    
    // Check if frontend logging is enabled
    this.checkLoggingEnabled();
    
    // Intercept console methods
    this.interceptConsole();
    
    // Send initial page load log (if enabled)
    if (this.isEnabled) {
      this.log('info', 'frontend', 'app-init', 'Application initialized', {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      });
    }
  }
  
  private async checkLoggingEnabled() {
    try {
      const response = await fetch('/api/admin/logging-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isEnabled = data.config.modules.frontend?.enabled ?? true;
      }
    } catch (error) {
      // If we can't check config, default to enabled
      console.warn('Could not fetch logging configuration, defaulting to enabled');
    }
  }
  
  private getSessionId(): string {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }
  
  private getUserId(): string | undefined {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  
  // Check if logs should be shown in console for specific module
  private shouldShowInConsole(module: string, level: string): boolean {
    // Always show if debug mode is enabled
    if (localStorage.getItem('debugMode') === 'true') {
      return true;
    }
    
    // Check module-specific console setting
    try {
      const response = localStorage.getItem('loggingConfig');
      if (response) {
        const config = JSON.parse(response);
        const moduleConfig = config.modules?.[module];
        return moduleConfig?.showInConsole ?? false;
      }
    } catch (error) {
      // If we can't parse config, default to not showing
      return false;
    }
    
    return false;
  }
  
  private interceptConsole() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // Store originals for debug mode
    (window as any)._originalConsole = originalConsole;
    
    const createInterceptor = (level: 'error' | 'warn' | 'info' | 'debug', originalFn: Function) => {
      return (...args: any[]) => {
        // Extract log information
        const message = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              // Try to safely serialize objects
              return JSON.stringify(arg, (key, value) => {
                // Skip DOM elements and React components
                if (value instanceof HTMLElement || 
                    (value && typeof value === 'object' && value.constructor && 
                     (value.constructor.name.includes('HTML') || value.constructor.name.includes('Fiber')))) {
                  return '[DOM Element]';
                }
                return value;
              });
            } catch (e) {
              return '[Circular or Complex Object]';
            }
          }
          return String(arg);
        }).join(' ');
        
        // Try to extract module/component name from stack trace
        const stack = new Error().stack || '';
        const moduleMatch = stack.match(/at\s+(?:\w+\.)?(\w+)/);
        const module = moduleMatch ? moduleMatch[1] : 'unknown';
        
        // Check if this module should show logs in console
        const shouldShowInConsole = this.shouldShowInConsole(module, level);
        
        // Call original function only if showInConsole is enabled
        if (shouldShowInConsole) {
          originalFn.apply(console, args);
        }
        
        // Send to backend aggregator
        this.sendLog(level, 'frontend', module, message);
      };
    };
    
    // Check for debug mode
    const isDebugMode = localStorage.getItem('debugMode') === 'true';
    
    if (!isDebugMode) {
      console.log = createInterceptor('info', originalConsole.log);
      console.info = createInterceptor('info', originalConsole.info);
      console.warn = createInterceptor('warn', originalConsole.warn);
      console.error = createInterceptor('error', originalConsole.error);
      console.debug = createInterceptor('debug', originalConsole.debug);
    }
    // In debug mode, console methods remain untouched for easier copying
  }
  
  private sendLog(
    level: 'error' | 'warn' | 'info' | 'debug',
    source: 'frontend' | 'backend' | 'database' | 'websocket',
    module: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    // Skip if frontend logging is disabled
    if (!this.isEnabled) {
      return;
    }
    
    // Add to queue instead of sending immediately
    this.logQueue.push({
      level,
      source,
      module,
      message,
      userId: this.getUserId(),
      sessionId: this.sessionId,
      metadata,
      timestamp: new Date().toISOString()
    });
    
    // Flush if queue is full or timer expired
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushLogs();
    } else if (!this.flushTimer) {
      this.scheduleFlush();
    }
  }
  
  private scheduleFlush() {
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    
    if (timeSinceLastFlush >= this.FLUSH_INTERVAL) {
      this.flushLogs();
    } else {
      // Schedule flush for remaining time
      this.flushTimer = setTimeout(() => {
        this.flushLogs();
      }, this.FLUSH_INTERVAL - timeSinceLastFlush);
    }
  }
  
  private async flushLogs() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.logQueue.length === 0) return;
    
    this.lastFlushTime = Date.now();
    const logsToSend = [...this.logQueue];
    this.logQueue = [];
    
    try {
      // Send batch of logs
      await fetch('/api/admin/logs/frontend/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ logs: logsToSend })
      });
    } catch (error) {
      console.error('Failed to send log batch to backend:', error);
      // Retry individual logs if batch fails
      for (const log of logsToSend) {
        try {
          await fetch('/api/admin/logs/frontend', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(log)
          });
        } catch (retryError) {
          // If individual retry fails, log to console as fallback
          console.error('Failed to send individual log:', retryError);
        }
      }
    }
  }
  
  log(
    level: 'error' | 'warn' | 'info' | 'debug',
    source: 'frontend' | 'backend' | 'database' | 'websocket',
    module: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.sendLog(level, source, module, message, metadata);
  }
  
  // Public method to update enabled state
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
  
  // Convenience methods
  error(module: string, message: string, metadata?: Record<string, any>) {
    this.log('error', 'frontend', module, message, metadata);
  }
  
  warn(module: string, message: string, metadata?: Record<string, any>) {
    this.log('warn', 'frontend', module, message, metadata);
  }
  
  info(module: string, message: string, metadata?: Record<string, any>) {
    this.log('info', 'frontend', module, message, metadata);
  }
  
  debug(module: string, message: string, metadata?: Record<string, any>) {
    this.log('debug', 'frontend', module, message, metadata);
  }
}

// Initialize frontend logger
const frontendLogger = new FrontendLogger();

// Expose debug mode toggle
(window as any).toggleDebugMode = () => {
  const current = localStorage.getItem('debugMode') === 'true';
  const newState = !current;
  localStorage.setItem('debugMode', String(newState));
  console.log(`Debug mode ${newState ? 'enabled' : 'disabled'}. Reload page to apply changes.`);
  return newState;
};

// Show current debug status
console.log('Frontend logger initialized. Use window.toggleDebugMode() to toggle debug mode.');

// Also expose global logger for easy access
declare global {
  interface Window {
    appLogger?: FrontendLogger;
    toggleDebugMode?: () => boolean;
  }
}

window.appLogger = frontendLogger;

export { frontendLogger };
export default frontendLogger;