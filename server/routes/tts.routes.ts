import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage } from '../storage';

export function createTTSRouter() {
  const router = Router();

  // TTS files endpoint
  router.get('/files/:filename', (req, res) => {
    // This would handle serving TTS audio files
    // Implementation depends on how TTS files are stored and served
    const filename = req.params.filename;
    
    // Security check to prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = `./uploads/tts/${filename}`;
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending TTS file:', err);
        res.status(404).json({ error: 'File not found' });
      }
    });
  });

  // Additional TTS routes can be added here as needed
  
  // TTS Admin Configuration endpoints
  router.get('/admin/config', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // Use the TTS service directly instead of storage
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      if (!config) {
        return res.status(404).json({ error: 'TTS configuration not found' });
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting TTS config:', error);
      res.status(500).json({ error: 'Failed to get TTS configuration' });
    }
  });
  
  router.post('/admin/config', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // This would update the TTS configuration in the database
      // For now, return a not implemented response
      res.status(501).json({ error: 'TTS configuration update not implemented' });
    } catch (error) {
      console.error('Error updating TTS config:', error);
      res.status(500).json({ error: 'Failed to update TTS configuration' });
    }
  });
  
  // TTS Cache Statistics endpoint
  router.get('/admin/cache-stats', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // Use the TTS service to get cache statistics
      const { ttsService } = await import('../services/tts/tts.service');
      // This would get cache statistics - for now return a sample response
      res.json({
        totalCachedFiles: 0,
        sizeGb: 0,
        oldestEntry: null,
        newestEntry: null,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting TTS cache stats:', error);
      res.status(500).json({ error: 'Failed to get TTS cache statistics' });
    }
  });
  
  return router;
}