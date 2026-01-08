import React, { useState, useEffect } from 'react';
import { X, File, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { fileUploadManager, type UploadProgress, type UploadedFile } from '@/lib/fileUploadManager';

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  onUploadComplete?: (uploadedFiles: UploadedFile[]) => void;
  autoUpload?: boolean;
}

interface FileWithProgress {
  file: File;
  uploadId?: string;
  progress?: number;
  status?: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedFile?: UploadedFile;
}

export function AttachmentPreview({ 
  files, 
  onRemove,
  onUploadComplete,
  autoUpload = false
}: AttachmentPreviewProps) {
  const [filesWithProgress, setFilesWithProgress] = useState<FileWithProgress[]>([]);

  useEffect(() => {
    const initialFiles = files.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }));
    
    setFilesWithProgress(initialFiles);

    if (autoUpload && files.length > 0) {
      // Use the local variable instead of state to avoid timing issues
      uploadFiles(initialFiles);
    }
  }, [files, autoUpload]);

  const uploadFiles = async (filesToUpload: FileWithProgress[]) => {
    const uploadPromises = filesToUpload.map(async (fileWithProgress, index) => {
      try {
        const uploadedFile = await fileUploadManager.uploadFile(fileWithProgress.file, (progress: UploadProgress) => {
          setFilesWithProgress(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              uploadId: progress.fileId,
              progress: progress.progress,
              status: progress.status,
              error: progress.error
            };
            return updated;
          });
        });

        setFilesWithProgress(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            uploadedFile,
            status: 'completed',
            progress: 100
          };
          return updated;
        });

        return uploadedFile;
      } catch (error) {
        setFilesWithProgress(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          };
          return updated;
        });
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((f): f is UploadedFile => f !== null);
    
    if (onUploadComplete && successfulUploads.length > 0) {
      onUploadComplete(successfulUploads);
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) {
      return <File className="h-5 w-5" />;
    }
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5" />;
    } else if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (filesWithProgress.length === 0) return null;

  return (
    <div className="space-y-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
      {filesWithProgress.map((fileWithProgress, index) => (
        <div
          key={`${fileWithProgress.file.name}-${index}`}
          className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border"
        >
          {/* File icon or thumbnail */}
          <div className="flex-shrink-0">
            {fileWithProgress.file.type?.startsWith('image/') ? (
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <img
                  src={URL.createObjectURL(fileWithProgress.file)}
                  alt={fileWithProgress.file.name}
                  className="w-full h-full object-cover"
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
              </div>
            ) : (
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                {getFileIcon(fileWithProgress.file.type)}
              </div>
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileWithProgress.file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(fileWithProgress.file.size)}</p>
            
            {/* Upload progress */}
            {fileWithProgress.status === 'uploading' && (
              <div className="mt-1">
                <Progress value={fileWithProgress.progress || 0} className="h-1" />
                <p className="text-xs text-gray-500 mt-1">{fileWithProgress.progress}%</p>
              </div>
            )}
            
            {fileWithProgress.status === 'error' && (
              <p className="text-xs text-red-500 mt-1">{fileWithProgress.error}</p>
            )}
            
            {fileWithProgress.status === 'completed' && (
              <p className="text-xs text-green-500 mt-1">✓ Uploaded</p>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex-shrink-0">
            {fileWithProgress.status === 'uploading' && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-8 w-8"
            onClick={() => onRemove(index)}
            disabled={fileWithProgress.status === 'uploading'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
