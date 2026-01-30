// Centralized Logging Configuration System
// Allows granular control over different logging modules and levels

import { useState, useCallback, useEffect } from 'react';

export interface LoggingModuleConfig {
  enabled: boolean;
  level: 'none' | 'error' | 'warn' | 'info' | 'debug';
  includeStackTrace?: boolean;
}

export interface LoggingConfig {
  // Global settings
  globalEnabled: boolean;
  globalLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  
  // Module-specific configurations
  modules: {
    // Frontend Collection
    frontend: LoggingModuleConfig;
    // API Layer
    api: LoggingModuleConfig;
    // WebSocket Layer
    websocket: LoggingModuleConfig;
    // Authentication Layer
    auth: LoggingModuleConfig;
    // Database Layer
    database: LoggingModuleConfig;
    // UI Components
    ui: LoggingModuleConfig;
    // Reading Progress Tracking
    readingProgress: LoggingModuleConfig;
    // Book Management
    books: LoggingModuleConfig;
    // Shelf Management
    shelves: LoggingModuleConfig;
    // Comments & Reviews
    comments: LoggingModuleConfig;
    // Reactions System
    reactions: LoggingModuleConfig;
    // File Upload/Download
    fileHandling: LoggingModuleConfig;
    // Performance Monitoring
    performance: LoggingModuleConfig;
    // Error Tracking
    errors: LoggingModuleConfig;
    // User Actions
    userActions: LoggingModuleConfig;
  };
}

// Default configuration
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  globalEnabled: false,
  globalLevel: 'error',
  modules: {
    frontend: { enabled: false, level: 'error' }, // DISABLED BY DEFAULT
    api: { enabled: false, level: 'error' },
    websocket: { enabled: false, level: 'error' },
    auth: { enabled: false, level: 'error' },
    database: { enabled: false, level: 'error' },
    ui: { enabled: false, level: 'error' },
    readingProgress: { enabled: false, level: 'error' },
    books: { enabled: false, level: 'error' },
    shelves: { enabled: false, level: 'error' },
    comments: { enabled: false, level: 'error' },
    reactions: { enabled: false, level: 'error' },
    fileHandling: { enabled: false, level: 'error' },
    performance: { enabled: false, level: 'error' },
    errors: { enabled: true, level: 'error' },
    userActions: { enabled: false, level: 'error' }
  }
};

// Logging levels mapping
const LOG_LEVELS = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

export class Logger {
  private config: LoggingConfig;
  private moduleName: string;

  constructor(moduleName: string, config?: LoggingConfig) {
    this.moduleName = moduleName;
    this.config = config || DEFAULT_LOGGING_CONFIG;
  }

  private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    if (!this.config.globalEnabled) return false;
    
    const moduleConfig = this.config.modules[this.moduleName as keyof typeof this.config.modules];
    if (!moduleConfig || !moduleConfig.enabled) return false;
    
    const globalLevelValue = LOG_LEVELS[this.config.globalLevel];
    const moduleLevelValue = LOG_LEVELS[moduleConfig.level];
    const requestedLevelValue = LOG_LEVELS[level];
    
    // Use the more restrictive level (higher number means more verbose)
    const effectiveLevel = Math.min(globalLevelValue, moduleLevelValue);
    
    return requestedLevelValue <= effectiveLevel;
  }

  private formatMessage(message: string, level: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.moduleName}] ${message}`;
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      const formattedMessage = this.formatMessage(message, 'error');
      console.error(formattedMessage);
      if (error && this.config.modules[this.moduleName as keyof typeof this.config.modules]?.includeStackTrace) {
        console.error('Stack trace:', error);
      }
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      const formattedMessage = this.formatMessage(message, 'warn');
      console.warn(formattedMessage);
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      const formattedMessage = this.formatMessage(message, 'info');
      console.info(formattedMessage);
    }
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      const formattedMessage = this.formatMessage(message, 'debug');
      console.debug(formattedMessage);
    }
  }

  // Method to update configuration
  updateConfig(newConfig: LoggingConfig): void {
    this.config = newConfig;
  }

  // Get current module configuration
  getModuleConfig(): LoggingModuleConfig {
    return this.config.modules[this.moduleName as keyof typeof this.config.modules] || 
           { enabled: false, level: 'none' };
  }
}

// Factory function to create loggers with shared configuration
class LoggerFactory {
  private static instance: LoggerFactory;
  private config: LoggingConfig;
  private loggers: Map<string, Logger> = new Map();

  private constructor() {
    // Initialize with default config, don't load from server immediately
    // Server loading will be triggered explicitly when needed
    this.config = DEFAULT_LOGGING_CONFIG;
  }

  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  getLogger(moduleName: string): Logger {
    if (!this.loggers.has(moduleName)) {
      const logger = new Logger(moduleName, this.config);
      this.loggers.set(moduleName, logger);
    }
    
    const logger = this.loggers.get(moduleName)!;
    logger.updateConfig(this.config); // Ensure logger has latest config
    return logger;
  }

  updateConfig(newConfig: LoggingConfig): void {
    this.config = newConfig;
    // Update all existing loggers
    this.loggers.forEach(logger => logger.updateConfig(newConfig));
    
    // Save to server
    this.saveToServer(newConfig).catch(() => {
      // Fallback to localStorage
      localStorage.setItem('loggingConfig', JSON.stringify(newConfig));
    });
  }

  private async saveToServer(config: LoggingConfig): Promise<void> {
    const response = await fetch('/api/admin/logging-config', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save logging configuration to server');
    }
  }

  getConfig(): LoggingConfig {
    return this.config;
  }

  // Explicitly load configuration from server (call this when user is authenticated)
  async loadConfigFromServer(): Promise<void> {
    try {
      const serverConfig = await this.fetchServerConfig();
      if (serverConfig) {
        this.config = serverConfig;
        // Update all existing loggers
        this.loggers.forEach(logger => logger.updateConfig(this.config));
      } else {
        // Fallback to localStorage
        const savedConfig = localStorage.getItem('loggingConfig');
        if (savedConfig) {
          this.config = { ...DEFAULT_LOGGING_CONFIG, ...JSON.parse(savedConfig) };
        }
      }
    } catch (error) {
      console.warn('Failed to load logging config from server, using defaults or localStorage');
      // Fallback to localStorage
      const savedConfig = localStorage.getItem('loggingConfig');
      if (savedConfig) {
        this.config = { ...DEFAULT_LOGGING_CONFIG, ...JSON.parse(savedConfig) };
      }
    }
  }

  // Private method to fetch config from server - used by loadConfigFromServer
  private async fetchServerConfig(): Promise<LoggingConfig | null> {
    try {
      const response = await fetch('/api/admin/logging-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.config;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Reset to default configuration
  resetToDefaults(): void {
    this.resetOnServer().then(() => {
      this.config = DEFAULT_LOGGING_CONFIG;
      // Update all existing loggers
      this.loggers.forEach(logger => logger.updateConfig(this.config));
    }).catch(() => {
      // Fallback to localStorage
      this.config = DEFAULT_LOGGING_CONFIG;
      localStorage.setItem('loggingConfig', JSON.stringify(DEFAULT_LOGGING_CONFIG));
      this.loggers.forEach(logger => logger.updateConfig(this.config));
    });
  }

  private async resetOnServer(): Promise<void> {
    const response = await fetch('/api/admin/logging-config/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset logging configuration on server');
    }
  }

  // Export current configuration
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // Import configuration from string
  importConfig(configString: string): boolean {
    try {
      const parsedConfig = JSON.parse(configString);
      // Validate structure
      if (this.validateConfig(parsedConfig)) {
        this.updateConfig(parsedConfig);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import logging configuration:', error);
      return false;
    }
  }

  private validateConfig(config: any): config is LoggingConfig {
    // Basic validation - check if it has required structure
    return config && 
           typeof config.globalEnabled === 'boolean' &&
           config.modules &&
           typeof config.modules === 'object';
  }

  // Export from server
  async exportFromServer(): Promise<string | null> {
    try {
      const response = await fetch('/api/admin/logging-config/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return JSON.stringify(data.config, null, 2);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const loggerFactory = LoggerFactory.getInstance();

// Convenience functions for common modules
export const apiLogger = loggerFactory.getLogger('api');
export const websocketLogger = loggerFactory.getLogger('websocket');
export const authLogger = loggerFactory.getLogger('auth');
export const databaseLogger = loggerFactory.getLogger('database');
export const uiLogger = loggerFactory.getLogger('ui');
export const readingProgressLogger = loggerFactory.getLogger('readingProgress');
export const booksLogger = loggerFactory.getLogger('books');
export const shelvesLogger = loggerFactory.getLogger('shelves');
export const commentsLogger = loggerFactory.getLogger('comments');
export const reactionsLogger = loggerFactory.getLogger('reactions');
export const fileHandlingLogger = loggerFactory.getLogger('fileHandling');
export const performanceLogger = loggerFactory.getLogger('performance');
export const errorsLogger = loggerFactory.getLogger('errors');
export const userActionsLogger = loggerFactory.getLogger('userActions');

// Hook for React components to access logger configuration
export const useLoggerConfig = () => {
  const [config, setConfig] = useState<LoggingConfig>(() => loggerFactory.getConfig());

  // Load server config when hook is used (assuming user is authenticated)
  useEffect(() => {
    loggerFactory.loadConfigFromServer().catch(console.warn);
  }, []);

  const updateConfig = useCallback((newConfig: LoggingConfig) => {
    loggerFactory.updateConfig(newConfig);
    setConfig(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    loggerFactory.resetToDefaults();
    setConfig(loggerFactory.getConfig());
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    exportConfig: loggerFactory.exportConfig,
    importConfig: loggerFactory.importConfig
  };
};

// Migration function for existing console.log statements
export const migrateConsoleLog = (moduleName: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) => {
  const logger = loggerFactory.getLogger(moduleName);
  switch (level) {
    case 'error':
      logger.error(message, args[0]);
      break;
    case 'warn':
      logger.warn(message);
      break;
    case 'info':
      logger.info(message);
      break;
    case 'debug':
      logger.debug(message);
      break;
  }
};