import imageCompression from 'browser-image-compression';

export interface UploadedFile {
  uploadId: string;
  url: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface UploadProgress {
  fileId: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const MAX_ATTACHMENTS = 5;

export class FileUploadManager {
  private uploadQueue: Map<string, UploadProgress> = new Map();
  private progressCallbacks: Map<string, (progress: UploadProgress) => void> = new Map();

  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
      };
    }

    // Check file type
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'File type not supported. Allowed: images (JPEG, PNG, GIF, WEBP) and documents (PDF, DOC, DOCX, TXT)'
      };
    }

    return { valid: true };
  }

  async compressImageIfNeeded(file: File): Promise<File> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return file;
    }

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        fileType: file.type
      };

      const compressedFile = await imageCompression(file, options);
      console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      return compressedFile;
    } catch (error) {
      console.error('Image compression failed, using original:', error);
      return file;
    }
  }

  async uploadFile(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadedFile> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate temporary ID for tracking
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize progress
    const progress: UploadProgress = {
      fileId,
      progress: 0,
      status: 'pending'
    };

    this.uploadQueue.set(fileId, progress);
    if (onProgress) {
      this.progressCallbacks.set(fileId, onProgress);
      onProgress(progress);
    }

    try {
      // Compress image if needed
      progress.status = 'uploading';
      progress.progress = 10;
      this.updateProgress(fileId, progress);

      const processedFile = await this.compressImageIfNeeded(file);

      // Create form data
      const formData = new FormData();
      formData.append('file', processedFile);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<UploadedFile>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = 10 + (event.loaded / event.total) * 80; // 10-90%
            progress.progress = Math.round(percentComplete);
            this.updateProgress(fileId, progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              progress.status = 'completed';
              progress.progress = 100;
              this.updateProgress(fileId, progress);
              resolve(response);
            } catch (error) {
              progress.status = 'error';
              progress.error = 'Invalid response from server';
              this.updateProgress(fileId, progress);
              reject(new Error('Invalid response from server'));
            }
          } else {
            progress.status = 'error';
            progress.error = `Upload failed: ${xhr.statusText}`;
            this.updateProgress(fileId, progress);
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          progress.status = 'error';
          progress.error = 'Network error during upload';
          this.updateProgress(fileId, progress);
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          progress.status = 'error';
          progress.error = 'Upload cancelled';
          this.updateProgress(fileId, progress);
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/uploads');
        
        // Add auth token if available
        const token = localStorage.getItem('authToken');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(formData);
      });

      const result = await uploadPromise;
      this.uploadQueue.delete(fileId);
      this.progressCallbacks.delete(fileId);
      return result;
    } catch (error) {
      this.uploadQueue.delete(fileId);
      this.progressCallbacks.delete(fileId);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: File[],
    onProgress?: (fileId: string, progress: UploadProgress) => void
  ): Promise<UploadedFile[]> {
    if (files.length > MAX_ATTACHMENTS) {
      throw new Error(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
    }

    const uploadPromises = files.map(file => 
      this.uploadFile(file, onProgress ? (progress) => onProgress(progress.fileId, progress) : undefined)
    );

    return Promise.all(uploadPromises);
  }

  private updateProgress(fileId: string, progress: UploadProgress) {
    this.uploadQueue.set(fileId, progress);
    const callback = this.progressCallbacks.get(fileId);
    if (callback) {
      callback(progress);
    }
  }

  getProgress(fileId: string): UploadProgress | undefined {
    return this.uploadQueue.get(fileId);
  }

  getAllProgress(): UploadProgress[] {
    return Array.from(this.uploadQueue.values());
  }
}

export const fileUploadManager = new FileUploadManager();
