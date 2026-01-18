import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { bookTranslations, books, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { spawn, ChildProcess } from 'child_process';
import { translationService } from '../services/translationService';
import { fileURLToPath } from 'url';

const router = Router();

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store for active translation worker processes (for cancellation support)
interface ActiveTranslation {
  worker: ChildProcess;
  startedAt: Date;
  timeoutId?: NodeJS.Timeout;
}
const activeTranslations = new Map<string, ActiveTranslation>();

// Check for stuck translations every 5 minutes
setInterval(async () => {
  const now = new Date();
  for (const [translationId, active] of activeTranslations.entries()) {
    const runningTime = now.getTime() - active.startedAt.getTime();
    
    // If translation has been running for more than 30 minutes, check if it's stuck
    if (runningTime > 30 * 60 * 1000) {
      console.log(`[Translation] Translation ${translationId} has been running for ${Math.floor(runningTime / 60000)} minutes`);
      
      try {
        // Check the last update time from database
        const [translation] = await db
          .select()
          .from(bookTranslations)
          .where(eq(bookTranslations.id, translationId))
          .limit(1);
        
        if (translation && translation.statusDetails) {
          const lastUpdate = new Date(translation.statusDetails.updatedAt);
          const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
          
          // If no update for 5 minutes, consider it stuck
          if (timeSinceUpdate > 5 * 60 * 1000) {
            console.log(`[Translation] Translation ${translationId} appears stuck, killing worker`);
            active.worker.kill('SIGKILL');
            activeTranslations.delete(translationId);
            
            // Mark as failed
            await db
              .update(bookTranslations)
              .set({
                status: 'failed',
                statusDetails: { step: 'failed', message: 'Translation timed out - no progress for 5 minutes' },
                errorMessage: 'Translation timed out - worker appears to be stuck'
              })
              .where(eq(bookTranslations.id, translationId));
          }
        }
      } catch (error) {
        console.error(`[Translation] Error checking translation ${translationId}:`, error);
      }
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Spawn a translation worker process
function spawnTranslationWorker(
  translationId: string,
  bookId: string,
  targetLanguage: string,
  service: string,
  model?: string
) {
  // Use absolute path from project root
  const workerPath = path.join(process.cwd(), 'server', 'workers', 'translationWorker.ts');
  
  console.log(`[Translation] Spawning worker at: ${workerPath}`);
  
  // Use spawn with npx tsx for Windows compatibility
  const worker = spawn('npx', ['tsx', workerPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TRANSLATION_JOB: JSON.stringify({
        translationId,
        bookId,
        targetLanguage,
        service,
        model,
      }),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  // Store worker reference for cancellation
  activeTranslations.set(translationId, {
    worker,
    startedAt: new Date()
  });

  // Forward worker stdout/stderr to console
  worker.stdout?.on('data', (data) => {
    console.log(`[Translation Worker ${translationId}]`, data.toString().trim());
  });
  
  worker.stderr?.on('data', (data) => {
    console.error(`[Translation Worker ${translationId}]`, data.toString().trim());
  });

  // Handle worker exit
  worker.on('exit', async (code, signal) => {
    console.log(`[Translation Worker ${translationId}] Exited with code ${code}, signal ${signal}`);
    activeTranslations.delete(translationId);
    
    // If worker exited with non-zero code and translation is still processing, mark as failed
    // Don't mark as failed if it was paused (SIGTERM signal) or completed successfully
    if (code !== 0 && signal !== 'SIGTERM') {
      try {
        const [translation] = await db
          .select()
          .from(bookTranslations)
          .where(eq(bookTranslations.id, translationId))
          .limit(1);
        
        // Only mark as failed if it's still in processing/pending state
        // Don't overwrite 'paused' or 'completed' status
        if (translation && (translation.status === 'processing' || translation.status === 'pending')) {
          console.log(`[Translation] Worker crashed for ${translationId}, marking as failed`);
          await db
            .update(bookTranslations)
            .set({
              status: 'failed',
              statusDetails: { step: 'failed', message: `Worker process exited with code ${code}` },
              errorMessage: `Translation worker crashed unexpectedly (exit code: ${code})`
            })
            .where(eq(bookTranslations.id, translationId));
        }
      } catch (error) {
        console.error(`[Translation] Error handling worker exit for ${translationId}:`, error);
      }
    }
  });

  worker.on('error', async (error) => {
    console.error(`[Translation Worker ${translationId}] Error:`, error);
    activeTranslations.delete(translationId);
    
    // Mark translation as failed
    try {
      await db
        .update(bookTranslations)
        .set({
          status: 'failed',
          statusDetails: { step: 'failed', message: error.message },
          errorMessage: `Worker error: ${error.message}`
        })
        .where(eq(bookTranslations.id, translationId));
    } catch (dbError) {
      console.error(`[Translation] Error updating database for ${translationId}:`, dbError);
    }
  });

  console.log(`[Translation] Spawned worker process PID: ${worker.pid}`);
}

// Multer configuration for translation file uploads
const translationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bookId = req.params.bookId;
    const uploadDir = path.join(process.cwd(), 'uploads', 'translations', bookId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const language = req.body.language || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${language}_${timestamp}_${basename}${ext}`);
  }
});

const uploadTranslation = multer({
  storage: translationStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(pdf|epub|fb2|txt|doc|docx)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, EPUB, FB2, TXT, DOC, DOCX allowed.'));
    }
  }
});

// Middleware to check if user is admin/moderator
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Promisify jwt.verify
  const verifyToken = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  };

  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || "default_secret") as any;
    
    console.log('Decoded token:', decoded);
    
    // Verify that the user actually exists in the database
    const userData = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!userData.length) {
      return res.status(401).json({ error: "User not found. Please log in again." });
    }
    
    console.log('User data from DB:', userData[0]);
    
    (req as any).user = decoded;
    
    if (decoded.accessLevel !== 'admin' && decoded.accessLevel !== 'moder') {
      console.log('Access denied: accessLevel is', decoded.accessLevel);
      return res.status(403).json({ error: 'Admin or moderator access required' });
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// GET /api/books/:bookId/translations - Get all translations for a book (public)
router.get('/books/:bookId/translations', async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    
    const translations = await db
      .select({
        id: bookTranslations.id,
        language: bookTranslations.language,
        translationType: bookTranslations.translationType,
        translationService: bookTranslations.translationService,
        fileType: bookTranslations.fileType,
        fileSize: bookTranslations.fileSize,
        status: bookTranslations.status,
        progress: bookTranslations.progress,
        statusDetails: bookTranslations.statusDetails,
        errorMessage: bookTranslations.errorMessage,
        createdAt: bookTranslations.createdAt,
        completedAt: bookTranslations.completedAt,
        partialFilePath: bookTranslations.partialFilePath,
        lastCompletedChunk: bookTranslations.lastCompletedChunk,
        totalChunks: bookTranslations.totalChunks,
        totalCharacters: bookTranslations.totalCharacters,
        translatedCharacters: bookTranslations.translatedCharacters,
      })
      .from(bookTranslations)
      .where(eq(bookTranslations.bookId, bookId));
    
    res.json(translations);
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// POST /api/admin/books/:bookId/translations/upload - Upload manual translation
router.post('/admin/books/:bookId/translations/upload', 
  requireAdmin,
  uploadTranslation.single('translationFile'),
  async (req: Request, res: Response) => {
    try {
      const { bookId } = req.params;
      const { language } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'Translation file is required' });
      }
      
      if (!language) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Language is required' });
      }
      
      // Check if book exists
      const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
      if (!book.length) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: 'Book not found' });
      }
      
      // Check if translation already exists
      const existing = await db
        .select()
        .from(bookTranslations)
        .where(and(
          eq(bookTranslations.bookId, bookId),
          eq(bookTranslations.language, language)
        ))
        .limit(1);
      
      if (existing.length) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Translation for this language already exists' });
      }
      
      const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, '/');
      const fileType = path.extname(file.originalname).substring(1).toLowerCase();
      
      const [translation] = await db
        .insert(bookTranslations)
        .values({
          bookId,
          language,
          translationType: 'manual',
          translationService: null,
          filePath: relativePath,
          fileSize: file.size,
          fileType,
          status: 'completed',
          progress: 100,
          translatedBy: req.user!.id,
          completedAt: new Date(),
        })
        .returning();
      
      res.json({ success: true, translation });
    } catch (error) {
      console.error('Error uploading translation:', error);
      res.status(500).json({ error: 'Failed to upload translation' });
    }
  }
);

// POST /api/admin/books/:bookId/translations/generate - Generate automated translation
router.post('/admin/books/:bookId/translations/generate',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { bookId } = req.params;
      const { language, translationService: service, ollamaModel } = req.body;
      
      if (!language || !service) {
        return res.status(400).json({ error: 'Language and translation service are required' });
      }
      
      // Check if book exists
      const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
      if (!book.length) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      // Check if translation already exists
      const existing = await db
        .select()
        .from(bookTranslations)
        .where(and(
          eq(bookTranslations.bookId, bookId),
          eq(bookTranslations.language, language)
        ))
        .limit(1);
      
      if (existing.length) {
        return res.status(400).json({ error: 'Translation for this language already exists' });
      }
      
      // Create translation record with pending status
      const [translation] = await db
        .insert(bookTranslations)
        .values({
          bookId,
          language,
          translationType: 'automated',
          translationService: ollamaModel ? `${service}:${ollamaModel}` : service,
          filePath: '', // Will be set when translation completes
          fileSize: 0,
          fileType: book[0].fileType || 'epub',
          status: 'pending',
          progress: 0,
          translatedBy: req.user!.id,
        })
        .returning();
      
      // Start translation process in a separate worker process
      // This prevents blocking the main event loop
      spawnTranslationWorker(translation.id, bookId, language, service, ollamaModel);
      
      res.json({ success: true, translationId: translation.id, status: 'pending' });
    } catch (error) {
      console.error('Error generating translation:', error);
      res.status(500).json({ error: 'Failed to start translation' });
    }
  }
);

// GET /api/admin/books/:bookId/translations/:translationId/status - Get translation status
router.get('/admin/books/:bookId/translations/:translationId/status',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { translationId } = req.params;
      
      const [translation] = await db
        .select({
          status: bookTranslations.status,
          progress: bookTranslations.progress,
          statusDetails: bookTranslations.statusDetails,
          errorMessage: bookTranslations.errorMessage,
        })
        .from(bookTranslations)
        .where(eq(bookTranslations.id, translationId))
        .limit(1);
      
      if (!translation) {
        return res.status(404).json({ error: 'Translation not found' });
      }
      
      res.json(translation);
    } catch (error) {
      console.error('Error fetching translation status:', error);
      res.status(500).json({ error: 'Failed to fetch translation status' });
    }
  }
);

// POST /api/admin/books/:bookId/translations/:translationId/resume - Resume interrupted translation
router.post('/admin/books/:bookId/translations/:translationId/resume',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { bookId, translationId } = req.params;
      
      // Check if translation exists and is resumable
      const [translation] = await db
        .select()
        .from(bookTranslations)
        .where(eq(bookTranslations.id, translationId))
        .limit(1);
      
      if (!translation) {
        return res.status(404).json({ error: 'Translation not found' });
      }
      
      // Can only resume failed or paused translations with partial progress
      if (translation.status !== 'failed' && translation.status !== 'paused') {
        return res.status(400).json({ error: 'Translation is not in a resumable state' });
      }
      
      if (!translation.partialFilePath || !translation.lastCompletedChunk || translation.lastCompletedChunk === 0) {
        return res.status(400).json({ error: 'No partial progress found to resume from' });
      }
      
      console.log(`[Translation] Resuming translation ${translationId} from chunk ${translation.lastCompletedChunk}`);
      
      // Update status back to pending for worker to pick up
      await db
        .update(bookTranslations)
        .set({ 
          status: 'pending',
          errorMessage: null,
          statusDetails: { 
            step: 'resuming', 
            message: `Resuming from chunk ${translation.lastCompletedChunk}...`,
            currentChunk: translation.lastCompletedChunk,
            totalChunks: translation.totalChunks || 0
          },
          updatedAt: new Date()
        })
        .where(eq(bookTranslations.id, translationId));
      
      // Spawn worker to resume translation
      const serviceMatch = translation.translationService?.match(/^([^:]+):(.+)$/);
      const service = serviceMatch ? serviceMatch[1] : translation.translationService || 'ollama';
      const model = serviceMatch ? serviceMatch[2] : undefined;
      
      spawnTranslationWorker(
        translationId,
        bookId,
        translation.language,
        service,
        model
      );
      
      res.json({ success: true, message: 'Translation resumed', translationId });
    } catch (error) {
      console.error('Error resuming translation:', error);
      res.status(500).json({ error: 'Failed to resume translation' });
    }
  }
);

// POST /api/admin/books/:bookId/translations/:translationId/pause - Pause ongoing translation
router.post('/admin/books/:bookId/translations/:translationId/pause',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { translationId } = req.params;
      
      // Check if translation exists and is in progress
      const [translation] = await db
        .select()
        .from(bookTranslations)
        .where(eq(bookTranslations.id, translationId))
        .limit(1);
      
      if (!translation) {
        return res.status(404).json({ error: 'Translation not found' });
      }
      
      if (translation.status !== 'processing' && translation.status !== 'pending') {
        return res.status(400).json({ error: 'Translation is not in progress' });
      }
      
      // Kill worker process if active
      const active = activeTranslations.get(translationId);
      if (active) {
        active.worker.kill('SIGTERM');
        activeTranslations.delete(translationId);
      }
      
      // Update status to paused
      await db
        .update(bookTranslations)
        .set({ 
          status: 'paused',
          statusDetails: { step: 'paused', message: 'Translation paused by user' },
          updatedAt: new Date()
        })
        .where(eq(bookTranslations.id, translationId));
      
      console.log(`[Translation ${translationId}] Paused by user`);
      
      res.json({ success: true, message: 'Translation paused' });
    } catch (error) {
      console.error('Error pausing translation:', error);
      res.status(500).json({ error: 'Failed to pause translation' });
    }
  }
);

// DELETE /api/admin/books/:bookId/translations/:translationId - Delete translation
router.delete('/admin/books/:bookId/translations/:translationId',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { translationId } = req.params;
      
      const [translation] = await db
        .select()
        .from(bookTranslations)
        .where(eq(bookTranslations.id, translationId))
        .limit(1);
      
      if (!translation) {
        return res.status(404).json({ error: 'Translation not found' });
      }
      
      // Delete file if exists
      if (translation.filePath) {
        const filePath = path.join(process.cwd(), translation.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Delete from database
      await db.delete(bookTranslations).where(eq(bookTranslations.id, translationId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting translation:', error);
      res.status(500).json({ error: 'Failed to delete translation' });
    }
  }
);

// GET /api/admin/translation/models - Get available translation models
router.get('/admin/translation/models',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const models = await translationService.getAvailableModels();
      res.json(models);
    } catch (error) {
      console.error('Error fetching translation models:', error);
      res.status(500).json({ error: 'Failed to fetch translation models' });
    }
  }
);

// GET /api/books/:bookId/content/:language - Serve translated book file
router.get('/books/:bookId/content/:language', async (req: Request, res: Response) => {
  try {
    const { bookId, language } = req.params;
    
    console.log(`[Translation Serve] Request for book ${bookId}, language ${language}`);
    
    // Find translation
    const [translation] = await db
      .select()
      .from(bookTranslations)
      .where(and(
        eq(bookTranslations.bookId, bookId),
        eq(bookTranslations.language, language),
        eq(bookTranslations.status, 'completed')
      ))
      .limit(1);
    
    console.log('[Translation Serve] Translation record:', translation);
    
    if (!translation) {
      console.log('[Translation Serve] Translation not found');
      return res.status(404).json({ error: 'Translation not found or not completed' });
    }
    
    const filePath = path.join(process.cwd(), translation.filePath);
    console.log('[Translation Serve] File path:', filePath);
    console.log('[Translation Serve] File exists:', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      console.log('[Translation Serve] File not found on disk');
      return res.status(404).json({ error: 'Translation file not found' });
    }
    
    // Set proper content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.epub': 'application/epub+zip',
      '.fb2': 'application/xml',
      '.txt': 'text/plain',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    console.log('[Translation Serve] Content-Type:', contentType);
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving translated content:', error);
    res.status(500).json({ error: 'Failed to serve translated content' });
  }
});

export default router;
