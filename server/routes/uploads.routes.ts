import { Router, type Express } from 'express';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import { storage } from '../storage';
import { db } from '../storage/db';
import { fileUploads, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export function createUploadsRouter() {
  // Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'attachments', 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedFilename}`);
  }
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type');
      (error as any).code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  }
});

const router = Router();

// Upload file
router.post("/", authenticateToken, attachmentUpload.single('file'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const entityType = req.body.entityType;
    const entityId = req.body.entityId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!entityType) {
      return res.status(400).json({ error: 'Entity type is required' });
    }

    // Create file upload record
    const newUpload = await db
      .insert(fileUploads)
      .values({
        uploaderId: userId,
        fileUrl: req.file.path,
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        entityType,
        entityId: entityId || null
      })
      .returning();

    res.status(201).json(newUpload[0]);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get upload by ID
router.get("/:uploadId", authenticateToken, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = (req as any).user.userId;

    const upload = await db
      .select({
        id: fileUploads.id,
        filename: fileUploads.filename,
        fileSize: fileUploads.fileSize,
        mimeType: fileUploads.mimeType,
        fileUrl: fileUploads.fileUrl,
        entityType: fileUploads.entityType,
        entityId: fileUploads.entityId,
        uploadedAt: fileUploads.uploadedAt
      })
      .from(fileUploads)
      .where(and(eq(fileUploads.id, uploadId), eq(fileUploads.uploaderId, userId)))
      .limit(1);

    if (!upload[0]) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json(upload[0]);
  } catch (error) {
    console.error('Error fetching upload:', error);
    res.status(500).json({ error: 'Failed to fetch upload' });
  }
});

// Delete upload
router.delete("/:uploadId", authenticateToken, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = (req as any).user.userId;

    const upload = await db
      .select({
        id: fileUploads.id,
        storagePath: fileUploads.storagePath
      })
      .from(fileUploads)
      .where(and(eq(fileUploads.id, uploadId), eq(fileUploads.uploaderId, userId)))
      .limit(1);

    if (!upload[0]) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Delete file from disk
    try {
      if (upload[0].storagePath && fs.existsSync(upload[0].storagePath)) {
        fs.unlinkSync(upload[0].storagePath);
      }
    } catch (err) {
      console.error('Error deleting file from disk:', err);
      // Continue with database deletion even if file deletion fails
    }

    // Delete record from database
    await db
      .delete(fileUploads)
      .where(eq(fileUploads.id, uploadId));

    res.json({ message: 'Upload deleted successfully' });
  } catch (error) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ error: 'Failed to delete upload' });
  }
});

  return router;
}