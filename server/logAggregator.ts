// Centralized Log Aggregation System
// Collects logs from both frontend and backend with search capabilities

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: 'frontend' | 'backend' | 'database' | 'websocket';
  module: string;
  message: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  stackTrace?: string;
  correlationId?: string; // For tracking request chains
  parentId?: string;      // For hierarchical logging
  metadata?: Record<string, any>;
}

interface LogQuery {
  level?: LogEntry['level'][];
  source?: LogEntry['source'][];
  module?: string[];
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

interface LogStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  byModule: Record<string, number>;
  recentErrors: number;
  avgLogsPerHour: number;
}

class LogAggregator extends EventEmitter {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 10000; // Keep last 10k logs in memory
  private readonly LOG_FILE = path.join(process.cwd(), 'logs', 'aggregated-logs.json');
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize() {
    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.dirname(this.LOG_FILE);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Load existing logs from file
      if (fs.existsSync(this.LOG_FILE)) {
        const fileContent = fs.readFileSync(this.LOG_FILE, 'utf8');
        const parsedLogs = JSON.parse(fileContent);
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }

      this.isInitialized = true;
      console.log('[LOG-AGGREGATOR] Initialized with', this.logs.length, 'existing logs');
    } catch (error) {
      console.error('[LOG-AGGREGATOR] Initialization error:', error);
      this.isInitialized = true; // Continue anyway
    }
  }

  // Add a log entry
  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    if (!this.isInitialized) {
      // Queue logs until initialized
      setTimeout(() => this.addLog(entry), 100);
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry
    };

    // Add to memory
    this.logs.push(logEntry);

    // Trim old logs if we exceed the limit
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    // Emit event for real-time updates
    this.emit('newLog', logEntry);

    // Persist periodically
    this.schedulePersist();
  }

  // Search logs with filters
  searchLogs(query: LogQuery): { logs: LogEntry[]; totalCount: number; stats: LogStats } {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (query.level && query.level.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.level!.includes(log.level));
    }

    if (query.source && query.source.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.source!.includes(log.source));
    }

    if (query.module && query.module.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.module!.includes(log.module));
    }

    if (query.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
    }

    if (query.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === query.sessionId);
    }

    if (query.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endDate!);
    }

    if (query.searchTerm) {
      const term = query.searchTerm.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.module.toLowerCase().includes(term) ||
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(term))
      );
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const totalCount = filteredLogs.length;

    // Apply pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    // Generate statistics
    const stats = this.generateStats(filteredLogs);

    return {
      logs: paginatedLogs,
      totalCount,
      stats
    };
  }

  // Get log statistics
  getStats(): LogStats {
    return this.generateStats(this.logs);
  }

  // Get log trends over time
  getTrends(hours: number = 24): Record<string, { 
    count: number; 
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    const hourlyData: Record<string, any> = {};
    
    // Initialize hourly buckets
    for (let i = 0; i < hours; i++) {
      const hour = new Date(startTime.getTime() + (i * 60 * 60 * 1000));
      const hourKey = hour.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      hourlyData[hourKey] = {
        count: 0,
        byLevel: { error: 0, warn: 0, info: 0, debug: 0 },
        bySource: { frontend: 0, backend: 0, database: 0, websocket: 0 }
      };
    }

    // Populate with actual data
    this.logs
      .filter(log => log.timestamp >= startTime)
      .forEach(log => {
        const hourKey = log.timestamp.toISOString().slice(0, 13);
        if (hourlyData[hourKey]) {
          hourlyData[hourKey].count++;
          hourlyData[hourKey].byLevel[log.level]++;
          hourlyData[hourKey].bySource[log.source]++;
        }
      });

    return hourlyData;
  }

  // Find call chains by correlation ID
  getCallChain(correlationId: string): LogEntry[] {
    return this.logs
      .filter(log => log.correlationId === correlationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Find related logs by session
  getSessionChain(sessionId: string): LogEntry[] {
    return this.logs
      .filter(log => log.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Find user activity chain
  getUserChain(userId: string, hours: number = 24): LogEntry[] {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.logs
      .filter(log => log.userId === userId && log.timestamp >= startTime)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Find error chains - logs leading up to and following errors
  getErrorContext(errorLogId: string, beforeMinutes: number = 5, afterMinutes: number = 5): LogEntry[] {
    const errorLog = this.logs.find(log => log.id === errorLogId);
    if (!errorLog) return [];
    
    const startTime = new Date(errorLog.timestamp.getTime() - (beforeMinutes * 60 * 1000));
    const endTime = new Date(errorLog.timestamp.getTime() + (afterMinutes * 60 * 1000));
    
    // Get logs from same session/user around the error
    return this.logs
      .filter(log => 
        log.timestamp >= startTime && 
        log.timestamp <= endTime &&
        (log.sessionId === errorLog.sessionId || log.userId === errorLog.userId)
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Find request flow - HTTP request -> processing -> response
  getRequestFlow(requestPath: string, method: string, hours: number = 1): LogEntry[] {
    // Find the initial request log
    const requestLogs = this.logs.filter(log => 
      log.source === 'backend' && 
      log.module === 'http-request' &&
      log.message.includes(`${method} ${requestPath}`) &&
      log.timestamp >= new Date(Date.now() - (hours * 60 * 60 * 1000))
    );
    
    if (requestLogs.length === 0) return [];
    
    // For each request, find related logs
    const allRelatedLogs: LogEntry[] = [];
    
    requestLogs.forEach(requestLog => {
      const sessionId = requestLog.sessionId;
      const userId = requestLog.userId;
      const startTime = requestLog.timestamp;
      const endTime = new Date(startTime.getTime() + (30 * 60 * 1000)); // 30 minutes window
      
      const relatedLogs = this.logs.filter(log => 
        log.timestamp >= startTime &&
        log.timestamp <= endTime &&
        (log.sessionId === sessionId || log.userId === userId || 
         (log.correlationId && requestLog.correlationId && log.correlationId === requestLog.correlationId))
      );
      
      allRelatedLogs.push(...relatedLogs);
    });
    
    // Remove duplicates and sort
    const uniqueLogs = Array.from(new Set(allRelatedLogs.map(log => log.id)))
      .map(id => allRelatedLogs.find(log => log.id === id)!);
    
    return uniqueLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Export logs
  exportLogs(format: 'json' | 'csv' = 'json', query?: LogQuery): string {
    let logsToExport = this.logs;
    
    if (query) {
      logsToExport = this.searchLogs(query).logs;
    }

    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'source', 'module', 'message', 'userId', 'sessionId'];
      const csvRows = logsToExport.map(log => [
        log.timestamp.toISOString(),
        log.level,
        log.source,
        log.module,
        `"${log.message.replace(/"/g, '""')}"`,
        log.userId || '',
        log.sessionId || ''
      ]);
      
      return [headers, ...csvRows].map(row => row.join(',')).join('\n');
    } else {
      return JSON.stringify(logsToExport, null, 2);
    }
  }

  // Clear old logs
  clearOldLogs(days: number = 30) {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    
    console.log(`[LOG-AGGREGATOR] Cleared ${initialCount - this.logs.length} old logs`);
    this.persistLogs();
  }

  // Private methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateStats(logs: LogEntry[]): LogStats {
    const byLevel: Record<string, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    const bySource: Record<string, number> = { frontend: 0, backend: 0, database: 0, websocket: 0 };
    const byModule: Record<string, number> = {};

    logs.forEach(log => {
      byLevel[log.level]++;
      bySource[log.source]++;
      byModule[log.module] = (byModule[log.module] || 0) + 1;
    });

    const recentErrors = logs.filter(log => 
      log.level === 'error' && 
      log.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    const oldestLog = logs.reduce((oldest, log) => 
      log.timestamp < oldest.timestamp ? log : oldest, 
      logs[0] || { timestamp: new Date() }
    );

    const timeSpanHours = (new Date().getTime() - oldestLog.timestamp.getTime()) / (1000 * 60 * 60);
    const avgLogsPerHour = timeSpanHours > 0 ? logs.length / timeSpanHours : 0;

    return {
      totalLogs: logs.length,
      byLevel,
      bySource,
      byModule,
      recentErrors,
      avgLogsPerHour: Math.round(avgLogsPerHour * 100) / 100
    };
  }

  private persistTimeout: NodeJS.Timeout | null = null;

  private schedulePersist() {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }
    
    this.persistTimeout = setTimeout(() => {
      this.persistLogs();
    }, 5000); // Persist every 5 seconds
  }

  private persistLogs() {
    try {
      fs.writeFileSync(this.LOG_FILE, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      console.error('[LOG-AGGREGATOR] Failed to persist logs:', error);
    }
  }
}

// Express middleware for backend logging
export const logMiddleware = (aggregator: LogAggregator) => {
  return (req: any, res: any, next: Function) => {
    const startTime = Date.now();
    
    // Log request
    aggregator.addLog({
      level: 'info',
      source: 'backend',
      module: 'http-request',
      message: `${req.method} ${req.path}`,
      userId: req.user?.userId,
      sessionId: req.sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        query: req.query,
        params: req.params,
        body: req.body
      }
    });

    // Capture response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      
      // Log response
      aggregator.addLog({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        source: 'backend',
        module: 'http-response',
        message: `${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
        userId: req.user?.userId,
        sessionId: req.sessionId,
        metadata: {
          statusCode: res.statusCode,
          duration,
          responseBodySize: body ? Buffer.byteLength(JSON.stringify(body)) : 0
        }
      });

      return originalSend.call(this, body);
    };

    next();
  };
};

// Database query logging
export const logDatabaseQuery = (aggregator: LogAggregator, query: string, duration: number, error?: Error) => {
  aggregator.addLog({
    level: error ? 'error' : 'info',
    source: 'database',
    module: 'query',
    message: error ? `Failed: ${query}` : `Executed: ${query} (${duration}ms)`,
    metadata: {
      query,
      duration,
      error: error?.message
    }
  });
};

// WebSocket logging
export const logWebSocketEvent = (aggregator: LogAggregator, event: string, data?: any, userId?: string) => {
  aggregator.addLog({
    level: 'info',
    source: 'websocket',
    module: 'websocket',
    message: `Event: ${event}`,
    userId,
    metadata: data
  });
};

// Export singleton instance
export const logAggregator = new LogAggregator();

export default logAggregator;