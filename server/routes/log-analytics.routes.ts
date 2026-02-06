import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { logAggregator } from '../logAggregator';

export function createLogAnalyticsRouter() {
  const router = Router();

  // Search logs with filters
  router.post('/logs/search', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const {
        level,
        source,
        module,
        userId,
        sessionId,
        startDate,
        endDate,
        searchTerm,
        limit,
        offset
      } = req.body;

      const query = {
        level: level ? (Array.isArray(level) ? level : [level]) : undefined,
        source: source ? (Array.isArray(source) ? source : [source]) : undefined,
        module: module ? (Array.isArray(module) ? module : [module]) : undefined,
        userId,
        sessionId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        searchTerm,
        limit: limit || 50,
        offset: offset || 0
      };

      const result = logAggregator.searchLogs(query);
      
      res.json({
        success: true,
        logs: result.logs,
        totalCount: result.totalCount,
        stats: result.stats,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          totalCount: result.totalCount
        }
      });
    } catch (error) {
      console.error('[LOG-SEARCH] Search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search logs'
      });
    }
  });

  // Get log statistics
  router.get('/logs/stats', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const stats = logAggregator.getStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('[LOG-STATS] Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get log statistics'
      });
    }
  });

  // Get log trends
  router.get('/logs/trends', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const trends = logAggregator.getTrends(hours);
      
      res.json({
        success: true,
        trends,
        hours
      });
    } catch (error) {
      console.error('[LOG-TRENDS] Trends error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get log trends'
      });
    }
  });

  // Export logs
  router.post('/logs/export', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { format = 'json', filters } = req.body;
      
      let query = undefined;
      if (filters) {
        query = {
          level: filters.level ? (Array.isArray(filters.level) ? filters.level : [filters.level]) : undefined,
          source: filters.source ? (Array.isArray(filters.source) ? filters.source : [filters.source]) : undefined,
          module: filters.module ? (Array.isArray(filters.module) ? filters.module : [filters.module]) : undefined,
          userId: filters.userId,
          sessionId: filters.sessionId,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          searchTerm: filters.searchTerm
        };
      }

      const exportedData = logAggregator.exportLogs(format, query);
      
      const filename = `logs-export-${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      
      res.send(exportedData);
    } catch (error) {
      console.error('[LOG-EXPORT] Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export logs'
      });
    }
  });

  // Get recent logs (real-time feed)
  router.get('/logs/recent', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const result = logAggregator.searchLogs({ limit });
      
      res.json({
        success: true,
        logs: result.logs
      });
    } catch (error) {
      console.error('[LOG-RECENT] Recent logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent logs'
      });
    }
  });

  // Get call chain by correlation ID
  router.get('/logs/chain/correlation/:correlationId', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { correlationId } = req.params;
      const chain = logAggregator.getCallChain(correlationId);
      
      res.json({
        success: true,
        logs: chain,
        count: chain.length
      });
    } catch (error) {
      console.error('[LOG-CHAIN] Correlation chain error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get correlation chain'
      });
    }
  });

  // Get session chain
  router.get('/logs/chain/session/:sessionId', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const chain = logAggregator.getSessionChain(sessionId);
      
      res.json({
        success: true,
        logs: chain,
        count: chain.length
      });
    } catch (error) {
      console.error('[LOG-CHAIN] Session chain error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session chain'
      });
    }
  });

  // Get user activity chain
  router.get('/logs/chain/user/:userId', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { userId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;
      const chain = logAggregator.getUserChain(userId, hours);
      
      res.json({
        success: true,
        logs: chain,
        count: chain.length,
        hours
      });
    } catch (error) {
      console.error('[LOG-CHAIN] User chain error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user chain'
      });
    }
  });

  // Get error context
  router.get('/logs/error/:logId/context', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { logId } = req.params;
      const beforeMinutes = parseInt(req.query.before as string) || 5;
      const afterMinutes = parseInt(req.query.after as string) || 5;
      
      const context = logAggregator.getErrorContext(logId, beforeMinutes, afterMinutes);
      
      res.json({
        success: true,
        logs: context,
        count: context.length,
        beforeMinutes,
        afterMinutes
      });
    } catch (error) {
      console.error('[LOG-CONTEXT] Error context error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get error context'
      });
    }
  });

  // Get request flow
  router.get('/logs/request-flow', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { path, method } = req.query;
      const hours = parseInt(req.query.hours as string) || 1;
      
      if (!path || !method) {
        return res.status(400).json({
          success: false,
          error: 'Path and method are required'
        });
      }
      
      const flow = logAggregator.getRequestFlow(path as string, method as string, hours);
      
      res.json({
        success: true,
        logs: flow,
        count: flow.length,
        path,
        method,
        hours
      });
    } catch (error) {
      console.error('[LOG-FLOW] Request flow error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get request flow'
      });
    }
  });

  // Clear old logs
  router.post('/logs/clear-old', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const days = parseInt(req.body.days) || 30;
      logAggregator.clearOldLogs(days);
      
      res.json({
        success: true,
        message: `Cleared logs older than ${days} days`
      });
    } catch (error) {
      console.error('[LOG-CLEAR] Clear error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear old logs'
      });
    }
  });

  // Receive frontend logs (batch)
  router.post('/logs/frontend/batch', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { logs } = req.body;
      
      if (!Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or empty logs array'
        });
      }
      
      // Add all logs to aggregator
      logs.forEach(log => {
        logAggregator.addLog({
          level: log.level,
          source: log.source,
          module: log.module,
          message: log.message,
          userId: log.userId,
          sessionId: log.sessionId,
          metadata: log.metadata
        });
      });
      
      res.json({
        success: true,
        message: `Processed ${logs.length} logs`
      });
    } catch (error) {
      console.error('[LOG-ANALYTICS] Batch log processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process batch logs'
      });
    }
  });

  // Receive frontend logs
  router.post('/logs/frontend', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { level, source, module, message, userId, sessionId, metadata } = req.body;
      
      logAggregator.addLog({
        level,
        source,
        module,
        message,
        userId,
        sessionId,
        metadata
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[FRONTEND-LOG] Failed to process frontend log:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process log'
      });
    }
  });

  return router;
}