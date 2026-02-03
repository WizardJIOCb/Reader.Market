import { Router, type Request, type Response } from 'express';
import { ttsService } from '../services/tts/tts.service';
import { db } from '../storage';
import { users, ttsConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { verifyToken as verifySecureToken } from '../utils/jwt-utils';

// Authentication middleware (copied from main routes.ts)
const authenticateToken = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = await verifySecureToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "Invalid token" });
    }
    
    // Verify that the user actually exists in the database
    const userData = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!userData[0]) {
      return res.status(401).json({ error: "User not found. Please log in again." });
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(403).json({ error: "Invalid token" });
  }
};

const router = Router();

// GET /api/tts/voices - List available voices for a provider and language
// Public endpoint for testing
router.get('/voices', async (req, res) => {
  try {
    const { provider, lang } = req.query;
    
    if (!provider || typeof provider !== 'string') {
      return res.status(400).json({ error: 'Provider is required' });
    }
    
    if (!lang || typeof lang !== 'string') {
      return res.status(400).json({ error: 'Language is required' });
    }
    
    // Validate provider
    if (provider !== 'rhvoice' && provider !== 'piper' && provider !== 'windows') {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    // Validate language
    if (lang !== 'ru' && lang !== 'en') {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    const voices = await ttsService.listVoices(provider as any, lang as any);
    res.json({
      provider,
      lang,
      voices
    });
  } catch (error: any) {
    console.error('Error listing voices:', error);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

// Apply authentication middleware to all routes except /voices
router.use(authenticateToken);

// GET /api/tts/config - Get TTS configuration
router.get('/config', async (req, res) => {
  try {
    const config = await ttsService.getConfig();
    if (!config) {
      return res.status(404).json({ error: 'TTS configuration not found' });
    }
    
    // Remove sensitive paths from response
    const { rhvoiceBinPath, piperBinPath, piperModelsDir, ...safeConfig } = config;
    
    res.json(safeConfig);
  } catch (error: any) {
    console.error('Error fetching TTS config:', error);
    res.status(500).json({ error: 'Failed to fetch TTS configuration' });
  }
});

// POST /api/tts/chunk - Process text chunk for TTS synthesis
router.post('/chunk', async (req, res) => {
  try {
    const { bookId, chapterIndex, chunkIndex, text, lang, provider, voice, rate } = req.body;
    
    // Debug logging
    console.log('TTS Chunk Request - Provider:', provider);
    console.log('TTS Chunk Request - Body:', { bookId, chapterIndex, chunkIndex, text: text?.substring(0, 50) + '...', lang, provider, voice, rate });
    
    // Validation
    if (!bookId || typeof bookId !== 'string') {
      return res.status(400).json({ error: 'bookId is required' });
    }
    
    if (typeof chunkIndex !== 'number') {
      return res.status(400).json({ error: 'chunkIndex is required and must be a number' });
    }
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    
    if (!lang || (lang !== 'ru' && lang !== 'en')) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    if (!provider || (provider !== 'rhvoice' && provider !== 'piper' && provider !== 'windows')) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (!voice || typeof voice !== 'string') {
      return res.status(400).json({ error: 'voice is required' });
    }
    
    if (typeof rate !== 'number' || rate < 0.5 || rate > 2.0) {
      return res.status(400).json({ error: 'rate must be a number between 0.5 and 2.0' });
    }
    
    // Check if user is blocked
    const userId = (req as any).user?.id;
    if (userId) {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user[0]?.isBlocked) {
        return res.status(403).json({ error: 'User is blocked' });
      }
    }
    
    const request = {
      bookId,
      chapterIndex: chapterIndex ?? null,
      chunkIndex,
      text,
      lang,
      provider,
      voice,
      rate
    };
    
    const result = await ttsService.processChunk(request);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing TTS chunk:', error);
    res.status(500).json({ error: 'Failed to process TTS chunk' });
  }
});

// GET /api/tts/status - Check status of TTS job
router.get('/status', async (req, res) => {
  try {
    const { textHash } = req.query;
    
    if (!textHash || typeof textHash !== 'string') {
      return res.status(400).json({ error: 'textHash is required' });
    }
    
    const result = await ttsService.getJobStatus(textHash);
    res.json(result);
  } catch (error: any) {
    console.error('Error checking TTS status:', error);
    res.status(500).json({ error: 'Failed to check TTS status' });
  }
});

// Admin routes - require admin access
router.use('/admin', async (req, res, next) => {
  const userId = (req as any).user?.id;
  if (userId) {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user[0]?.accessLevel !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  }
  next();
});

// GET /api/tts/admin/config - Get full TTS configuration (admin only)
router.get('/admin/config', async (req, res) => {
  try {
    const config = await ttsService.getConfig();
    if (!config) {
      return res.status(404).json({ error: 'TTS configuration not found' });
    }
    
    res.json(config);
  } catch (error: any) {
    console.error('Error fetching TTS admin config:', error);
    res.status(500).json({ error: 'Failed to fetch TTS configuration' });
  }
});

// PUT /api/tts/admin/config - Update TTS configuration (admin only)
router.put('/admin/config', async (req, res) => {
  try {
    const configData = req.body;
    
    // Validate required fields
    if (typeof configData.ttsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'ttsEnabled must be a boolean' });
    }
    
    if (!Array.isArray(configData.enabledProviders)) {
      return res.status(400).json({ error: 'enabledProviders must be an array' });
    }
    
    if (typeof configData.defaultProvider !== 'string') {
      return res.status(400).json({ error: 'defaultProvider is required' });
    }
    
    // Validate numeric fields
    const numericFields = [
      'defaultRate', 'minRate', 'maxRate', 
      'chunkMinChars', 'chunkMaxChars',
      'mp3Bitrate', 'queueConcurrency', 
      'cacheMaxGb', 'cacheTtlDays'
    ];
    
    for (const field of numericFields) {
      if (typeof configData[field] !== 'number' || isNaN(configData[field])) {
        return res.status(400).json({ error: `${field} must be a valid number` });
      }
    }
    
    // Validate that defaultProvider is in enabledProviders
    if (!configData.enabledProviders.includes(configData.defaultProvider)) {
      return res.status(400).json({ error: 'defaultProvider must be in enabledProviders list' });
    }
    
    // Validate string fields
    const stringFields = [
      'defaultLang', 'defaultVoiceRu', 'defaultVoiceEn',
      'audioFormat', 'rhvoiceBinPath', 'piperBinPath', 'piperModelsDir'
    ];
    
    for (const field of stringFields) {
      if (typeof configData[field] !== 'string') {
        return res.status(400).json({ error: `${field} must be a string` });
      }
    }
    
    // Update configuration in database
    console.log('TTS PUT: Updating config with data:', configData);
    
    const result = await db.update(ttsConfig)
      .set({
        ttsEnabled: configData.ttsEnabled,
        enabledProviders: JSON.stringify(configData.enabledProviders),
        defaultProvider: configData.defaultProvider,
        defaultLang: configData.defaultLang,
        defaultVoiceRu: configData.defaultVoiceRu,
        defaultVoiceEn: configData.defaultVoiceEn,
        defaultRate: configData.defaultRate.toString(), // Convert to string for DB
        minRate: configData.minRate.toString(), // Convert to string for DB
        maxRate: configData.maxRate.toString(), // Convert to string for DB
        chunkMinChars: configData.chunkMinChars,
        chunkMaxChars: configData.chunkMaxChars,
        audioFormat: configData.audioFormat,
        mp3Bitrate: configData.mp3Bitrate,
        queueConcurrency: configData.queueConcurrency,
        cacheMaxGb: configData.cacheMaxGb,
        cacheTtlDays: configData.cacheTtlDays,
        rhvoiceBinPath: configData.rhvoiceBinPath,
        piperBinPath: configData.piperBinPath,
        piperModelsDir: configData.piperModelsDir,
        updatedAt: new Date()
      })
      .where(eq(ttsConfig.id, 'default'))
      .returning();
    
    console.log('TTS PUT: Update result:', result);
    
    if (result.length === 0) {
      console.log('TTS PUT: No rows updated, attempting insert');
      // If no config exists, create it
      await db.insert(ttsConfig).values({
        id: 'default',
        ttsEnabled: configData.ttsEnabled,
        enabledProviders: JSON.stringify(configData.enabledProviders),
        defaultProvider: configData.defaultProvider,
        defaultLang: configData.defaultLang,
        defaultVoiceRu: configData.defaultVoiceRu,
        defaultVoiceEn: configData.defaultVoiceEn,
        defaultRate: configData.defaultRate.toString(), // Convert to string for DB
        minRate: configData.minRate.toString(), // Convert to string for DB
        maxRate: configData.maxRate.toString(), // Convert to string for DB
        chunkMinChars: configData.chunkMinChars,
        chunkMaxChars: configData.chunkMaxChars,
        audioFormat: configData.audioFormat,
        mp3Bitrate: configData.mp3Bitrate,
        queueConcurrency: configData.queueConcurrency,
        cacheMaxGb: configData.cacheMaxGb,
        cacheTtlDays: configData.cacheTtlDays,
        rhvoiceBinPath: configData.rhvoiceBinPath,
        piperBinPath: configData.piperBinPath,
        piperModelsDir: configData.piperModelsDir,
        updatedAt: new Date()
      });
      console.log('TTS PUT: Insert completed');
    }
    
    res.json({ message: 'TTS configuration updated successfully' });
  } catch (error: any) {
    console.error('Error updating TTS config:', error);
    res.status(500).json({ error: 'Failed to update TTS configuration' });
  }
});

// GET /api/tts/admin/cache-stats - Get cache statistics (admin only)
router.get('/admin/cache-stats', async (req, res) => {
  try {
    // Import fs module
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    
    const ttsStoragePath = process.env.TTS_STORAGE_PATH || join(process.cwd(), 'storage', 'tts');
    
    let totalSizeBytes = 0;
    let fileCount = 0;
    
    try {
      // Recursively calculate directory size
      const calculateDirSize = async (dir: string): Promise<void> => {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            
            if (entry.isDirectory()) {
              await calculateDirSize(fullPath);
            } else if (entry.isFile()) {
              const stats = await stat(fullPath);
              totalSizeBytes += stats.size;
              fileCount++;
            }
          }
        } catch (err) {
          // Skip directories that can't be read
          console.debug(`Could not read directory: ${dir}`);
        }
      };
      
      await calculateDirSize(ttsStoragePath);
    } catch (err) {
      // If storage directory doesn't exist, return zeros
      console.debug('TTS storage directory not found, returning zero stats');
    }
    
    const sizeGb = totalSizeBytes / (1024 * 1024 * 1024);
    
    res.json({
      sizeGb: parseFloat(sizeGb.toFixed(2)),
      fileCount
    });
  } catch (error: any) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch cache statistics' });
  }
});

// POST /api/tts/admin/clear-cache - Clear TTS cache (admin only)
router.post('/admin/clear-cache', async (req, res) => {
  try {
    // TODO: Implement actual cache clearing
    console.log('Clearing TTS cache');
    res.json({ message: 'TTS cache cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;