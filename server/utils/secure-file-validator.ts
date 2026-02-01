import path from 'path';
import fs from 'fs/promises';
import { fileTypeFromFile } from 'file-type';

// Define allowed file types with their magic numbers
const ALLOWED_MIME_TYPES = {
  // Document types
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/epub+zip': ['.epub'],
  'text/plain': ['.txt'],
  'application/fb2': ['.fb2'],
  'application/x-fictionbook+xml': ['.fb2'],
  'text/xml': ['.xml', '.fb2'],
  
  // Image types for covers
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp']
};

/**
 * Validates file type based on magic numbers and extension
 */
export async function validateFileType(filePath: string, allowedMimeTypes: Record<string, string[]> = ALLOWED_MIME_TYPES): Promise<{ isValid: boolean; mimeType?: string; error?: string }> {
  try {
    // Read file header to detect actual file type
    const fileType = await fileTypeFromFile(filePath);
    
    if (!fileType) {
      return { 
        isValid: false, 
        error: 'Could not detect file type. Invalid or corrupted file.' 
      };
    }

    // Check if detected mime type is allowed
    if (!allowedMimeTypes[fileType.mime]) {
      return { 
        isValid: false, 
        error: `File type '${fileType.mime}' is not allowed` 
      };
    }

    // Double-check file extension matches detected type
    const fileExtension = path.extname(filePath).toLowerCase();
    const allowedExtensions = allowedMimeTypes[fileType.mime];
    
    if (!allowedExtensions.includes(fileExtension)) {
      return { 
        isValid: false, 
        error: `File extension '${fileExtension}' does not match detected file type '${fileType.mime}'` 
      };
    }

    // For XML-based files (like EPUB, FB2), scan for potentially dangerous content
    if (fileType.mime.includes('xml') || fileType.mime === 'application/epub+zip') {
      const dangerousPatterns = [
        /<!ENTITY/i,  // XXE indicators
        /SYSTEM\s+/i,
        /PUBLIC\s+/i,
        /<!DOCTYPE/i,
        /\s+on\w+\s*=/i,  // Event handlers
        /<script/i,  // Script tags
        /javascript:/i,
        /data:/i,
        /vbscript:/i
      ];

      const fileBuffer = await fs.readFile(filePath, { encoding: 'utf8', flag: 'r' });
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(fileBuffer)) {
          return { 
            isValid: false, 
            error: `File contains potentially dangerous content: ${pattern.toString()}` 
          };
        }
      }
    }

    return { 
      isValid: true, 
      mimeType: fileType.mime 
    };
  } catch (error: any) {
    console.error('File validation error:', error);
    return { 
      isValid: false, 
      error: 'Error validating file type: ' + (error.message || 'Unknown error') 
    };
  }
}

/**
 * Sanitizes file name to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts
  let cleanName = fileName.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  
  // Remove control characters
  cleanName = cleanName.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Get just the filename part (no path)
  cleanName = path.basename(cleanName);
  
  // Replace potentially dangerous characters
  cleanName = cleanName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return cleanName;
}

/**
 * Validates file size against maximum allowed size
 */
export function validateFileSize(size: number, maxSize: number): { isValid: boolean; error?: string } {
  if (size > maxSize) {
    return { 
      isValid: false, 
      error: `File size ${size} bytes exceeds maximum allowed size of ${maxSize} bytes` 
    };
  }
  return { isValid: true };
}

/**
 * Creates a secure file path preventing directory traversal
 */
export function createSecureFilePath(baseDir: string, fileName: string): string {
  const sanitizedFileName = sanitizeFileName(fileName);
  const securePath = path.join(baseDir, sanitizedFileName);
  
  // Resolve the path to eliminate any '..' sequences
  const resolvedPath = path.resolve(securePath);
  const baseResolvedPath = path.resolve(baseDir);
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(baseResolvedPath)) {
    throw new Error('Invalid file path: Path traversal detected');
  }
  
  return resolvedPath;
}