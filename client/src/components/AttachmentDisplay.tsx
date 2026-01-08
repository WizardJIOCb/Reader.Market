import React, { useState, useEffect } from 'react';
import { File, Image as ImageIcon, FileText, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { getFileUrl } from '@/lib/config';

interface Attachment {
  url: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

interface AttachmentDisplayProps {
  attachments: Attachment[];
  className?: string;
}

export function AttachmentDisplay({ attachments, className = '' }: AttachmentDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

  // Load authenticated image URLs
  React.useEffect(() => {
    const loadImages = async () => {
      console.log('🖼️ [AttachmentDisplay] Loading images for attachments:', attachments);
      const newUrls = new Map<string, string>();
      
      for (const attachment of attachments) {
        if (attachment.mimeType && attachment.mimeType.startsWith('image/')) {
          try {
            // For GIFs, always use original to preserve animation
            // For other images, use thumbnail if available for faster preview
            let imageUrl = attachment.mimeType === 'image/gif' 
              ? attachment.url 
              : (attachment.thumbnailUrl || attachment.url);
            console.log('🖼️ [AttachmentDisplay] Loading image URL:', imageUrl, 'MIME:', attachment.mimeType);
            
            // Handle localhost URLs by stripping them to relative paths
            // This fixes production issue where localhost URLs were stored during development
            if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('https://localhost')) {
              // Extract the path portion after the domain and port
              const url = new URL(imageUrl);
              imageUrl = url.pathname;
              console.log('🔧 [AttachmentDisplay] Stripped localhost URL to relative path:', imageUrl);
            }
            
            // If it's a blob URL, use it directly
            if (imageUrl.startsWith('blob:')) {
              console.log('🖼️ [AttachmentDisplay] Using blob URL directly:', imageUrl);
              newUrls.set(attachment.url, imageUrl);
            }
            // If it's an absolute URL (but not localhost), use it directly
            else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
              console.log('🖼️ [AttachmentDisplay] Using absolute URL directly:', imageUrl);
              newUrls.set(attachment.url, imageUrl);
            }
            // For relative paths, construct full URL
            else {
              const fullUrl = getFileUrl(imageUrl);
              console.log('🖼️ [AttachmentDisplay] Processing image:', fullUrl, 'MIME:', attachment.mimeType);
              
              // For GIFs, use direct URL without blob conversion to preserve animation
              // Static files in /uploads don't require authentication
              if (attachment.mimeType === 'image/gif') {
                console.log('🖼️ [AttachmentDisplay] Using direct URL for GIF (preserves animation):', fullUrl);
                newUrls.set(attachment.url, fullUrl);
              } else {
                // For non-GIF images, fetch and create blob URL for better caching
                const response = await fetch(fullUrl, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                  }
                });
                
                console.log('🖼️ [AttachmentDisplay] Fetch response status:', response.status);
                
                if (response.ok) {
                  const blob = await response.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  console.log('🖼️ [AttachmentDisplay] Created blob URL:', blobUrl);
                  newUrls.set(attachment.url, blobUrl);
                } else {
                  console.error('❌ Failed to load image:', imageUrl, 'Status:', response.status);
                }
              }
            }
          } catch (error) {
            console.error('❌ Error loading image:', attachment.url, error);
          }
        }
      }
      
      console.log('🖼️ [AttachmentDisplay] All images loaded. URLs map:', newUrls);
      setImageUrls(newUrls);
    };
    
    if (attachments.length > 0) {
      loadImages();
    }
    
    // Cleanup blob URLs on unmount
    return () => {
      imageUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter(a => a.mimeType && a.mimeType.startsWith('image/'));
  const documents = attachments.filter(a => a.mimeType && !a.mimeType.startsWith('image/'));

  // Helper function to load full-size image
  const loadFullSizeImage = async (image: Attachment) => {
    console.log('🔍 [loadFullSizeImage] Loading full-size for:', image.filename, 'MIME:', image.mimeType, 'URL:', image.url);
    let fullImageUrl = image.url;
    
    // Handle localhost URLs
    if (fullImageUrl.startsWith('http://localhost') || fullImageUrl.startsWith('https://localhost')) {
      const url = new URL(fullImageUrl);
      fullImageUrl = url.pathname;
      console.log('🔧 [loadFullSizeImage] Stripped localhost to:', fullImageUrl);
    }
    
    // If it's already a blob or absolute URL, use directly
    if (fullImageUrl.startsWith('blob:') || fullImageUrl.startsWith('http://') || fullImageUrl.startsWith('https://')) {
      console.log('⚠️ [loadFullSizeImage] Using as-is (blob or absolute):', fullImageUrl);
      return fullImageUrl;
    }
    
    // For GIFs, return the direct URL (don't convert to blob to preserve animation)
    if (image.mimeType === 'image/gif') {
      // Return the imageUrls map entry if available, otherwise construct URL
      const cachedUrl = imageUrls.get(image.url);
      if (cachedUrl) {
        console.log('✅ [loadFullSizeImage] Using cached GIF URL:', cachedUrl);
        return cachedUrl;
      }
      const directUrl = getFileUrl(fullImageUrl);
      console.log('✅ [loadFullSizeImage] Using direct GIF URL:', directUrl);
      return directUrl;
    }
    
    // For non-GIF images, fetch and create blob URL for better quality
    try {
      const fullUrl = getFileUrl(fullImageUrl);
      console.log('📦 [loadFullSizeImage] Fetching non-GIF as blob:', fullUrl);
      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        console.log('✅ [loadFullSizeImage] Created blob URL for non-GIF:', blobUrl);
        return blobUrl;
      }
    } catch (error) {
      console.error('❌ [loadFullSizeImage] Failed to load full-size image:', error);
    }
    
    console.log('⚠️ [loadFullSizeImage] Fallback to original URL:', fullImageUrl);
    return fullImageUrl;
  };

  // Navigate to previous image
  const goToPrevious = async () => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      const fullImageUrl = await loadFullSizeImage(images[newIndex]);
      setLightboxImage(fullImageUrl);
    }
  };

  // Navigate to next image
  const goToNext = async () => {
    if (currentImageIndex < images.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      const fullImageUrl = await loadFullSizeImage(images[newIndex]);
      setLightboxImage(fullImageUrl);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, currentImageIndex, images, imageUrls]);

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) {
      return <File className="h-6 w-6" />;
    }
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
      return <FileText className="h-6 w-6" />;
    }
    return <File className="h-6 w-6" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const fullUrl = getFileUrl(attachment.url);
      console.log('📥 [AttachmentDisplay] Downloading file:', fullUrl);
      
      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ Download failed with status:', response.status);
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('✅ [AttachmentDisplay] Download completed:', attachment.filename);
    } catch (error) {
      console.error('❌ Download failed:', error);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Image attachments */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => {
            const displayUrl = imageUrls.get(image.url);
            
            return (
              <div
                key={index}
                className="relative cursor-pointer rounded-lg overflow-hidden inline-block"
                onClick={async () => {
                  setCurrentImageIndex(index);
                  const fullImageUrl = await loadFullSizeImage(image);
                  setLightboxImage(fullImageUrl);
                }}
              >
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={image.filename}
                    className="max-w-full w-auto h-auto object-contain rounded-lg"
                    style={{ maxHeight: '200px', display: 'block' }}
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <ImageIcon className="h-12 w-12 text-gray-400 animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document attachments */}
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex-shrink-0 text-gray-500">
                {getFileIcon(doc.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-8 w-8"
                onClick={() => handleDownload(doc)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for images */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-black border-none">
          <div className="relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-white/20 hover:bg-white/30 text-white border border-white/50"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Previous button */}
            {images.length > 1 && currentImageIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 text-white border border-white/50"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}
            
            {/* Next button */}
            {images.length > 1 && currentImageIndex < images.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 text-white border border-white/50"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}
            
            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
            
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Full size"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
