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
  const getUploadDestination = (entityType?: string): string => {
    let uploadDir: string;

    switch (entityType) {
      case 'article':
        uploadDir = path.join(process.cwd(), 'uploads', 'articles');
        break;
      case 'book':
        uploadDir = path.join(process.cwd(), 'uploads', 'books');
        break;
      case 'cover':
        uploadDir = path.join(process.cwd(), 'uploads', 'covers');
        break;
      case 'book-chat':
        uploadDir = path.join(process.cwd(), 'uploads', 'chat-attachments');
        break;
      default:
        uploadDir = path.join(process.cwd(), 'uploads', 'attachments', 'temp');
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    return uploadDir;
  };

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = req.body.entityType;
    const uploadDir = getUploadDestination(entityType);
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

// Create file upload record first with the original fileUrl
    const newUpload = await db
      .insert(fileUploads)
      .values({
        uploaderId: userId,
        fileUrl: '', // We'll update this after path processing
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path, // Keep the full system path for server operations
        entityType,
        entityId: entityId || null
      })
      .returning();
    
    // Convert the full file path to a web-accessible URL
    // The file is stored in the uploads directory and served at /uploads
    let relativeFilePath = req.file.path.replace(process.cwd(), '').replace(/\\/g, '/');
    
    // Clean up the path to ensure it's properly formatted
    relativeFilePath = relativeFilePath.replace(/^[/\\]+/, ''); // Remove leading slashes/backslashes
    
    let webAccessibleUrl;
    
    // Check if the relative path already starts with 'uploads', if so use it directly
    if (relativeFilePath.toLowerCase().startsWith('uploads/')) {
      webAccessibleUrl = '/' + relativeFilePath;
    } else {
      // If the path doesn't start with uploads, prepend it
      webAccessibleUrl = '/uploads/' + relativeFilePath;
    }
    
    // Ensure we have a proper relative path
    if (webAccessibleUrl.includes(':')) {
      // If there's a colon (likely a Windows drive letter), extract just the uploads portion
      const uploadsIndex = webAccessibleUrl.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        webAccessibleUrl = webAccessibleUrl.substring(uploadsIndex);
      }
    }
    
    // Update the fileUrl in the database record with the corrected URL
    await db
      .update(fileUploads)
      .set({ fileUrl: webAccessibleUrl })
      .where(eq(fileUploads.id, newUpload[0].id));
    
    // Update the newUpload variable to reflect the corrected URL
    newUpload[0].fileUrl = webAccessibleUrl;

    // Transform the response to match frontend expectations
    const transformedUpload = {
      uploadId: newUpload[0].id,
      url: newUpload[0].fileUrl,
      filename: newUpload[0].filename,
      fileSize: newUpload[0].fileSize,
      mimeType: newUpload[0].mimeType,
      thumbnailUrl: newUpload[0].thumbnailUrl
    };

    res.status(201).json(transformedUpload);
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