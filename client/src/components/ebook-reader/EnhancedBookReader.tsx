import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { readerService, ReaderSettings } from './readerService';

// Define the props interface
interface EnhancedBookReaderProps {
  bookId: string;
  bookUrl: string;
  fileType: string;
  initialLocation?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  margin?: number;
  theme?: 'light' | 'dark';
  viewMode?: 'paginated' | 'scrolled';
  hasPrev: boolean;
  hasNext: boolean;
  onProgressUpdate?: (progress: number) => void;
  onLocationChange?: (location: any) => void;
  onBookmarkAdded?: (bookmark: any) => void;
  onTextSelected?: (text: string, location: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onError?: (error: any) => void;
}

// Define the ref interface
export interface EnhancedBookReaderRef {
  nextPage: () => void;
  prevPage: () => void;
  setFontSize: (size: number) => void;
  setCurrentLocation: (location: string) => void;
  getProgress: () => number;
}

// Create the component using forwardRef
const EnhancedBookReader = forwardRef<EnhancedBookReaderRef, EnhancedBookReaderProps>((props, ref) => {
  const {
    bookId,
    bookUrl,
    fileType,
    initialLocation,
    fontSize = 16,
    fontFamily = 'Georgia, serif',
    lineHeight = 1.6,
    margin = 20,
    theme = 'light',
    viewMode = 'paginated',
    hasPrev,
    hasNext,
    onProgressUpdate,
    onLocationChange,
    onBookmarkAdded,
    onTextSelected,
    onNext,
    onPrev,
    onError
  } = props;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readerInitialized = useRef(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    nextPage: () => {
      readerService.next();
    },
    prevPage: () => {
      readerService.prev();
    },
    setFontSize: (size: number) => {
      readerService.setFontSize(size);
    },
    setCurrentLocation: (location: string) => {
      readerService.navigateTo(location);
    },
    getProgress: () => {
      return readerService.getProgress();
    }
  }));

  // Initialize the reader
  useEffect(() => {
    const initReader = async () => {
      if (!containerRef.current || readerInitialized.current) return;
      
      try {
        console.log('Initializing reader with book:', bookUrl);
        setIsLoading(true);
        setError(null);
        
        // Configure reader settings
        const settings: Partial<ReaderSettings> = {
          fontSize,
          fontFamily,
          lineHeight,
          margin,
          theme,
          viewMode
        };
        
        readerService.updateSettings(settings);
        
        // Initialize the reader service with the container
        await readerService.initialize(bookUrl, containerRef.current);
        
        readerInitialized.current = true;
        console.log('Reader initialized successfully');
      } catch (err) {
        console.error('Failed to initialize reader:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    };

    initReader();

    // Cleanup function
    return () => {
      if (readerInitialized.current) {
        readerService.destroy();
        readerInitialized.current = false;
      }
    };
  }, [bookUrl, fontSize, fontFamily, lineHeight, margin, theme, viewMode]);

  // Set up event listeners
  useEffect(() => {
    if (!readerInitialized.current) return;

    const handleReady = () => {
      console.log('Reader is ready');
      setIsLoading(false);
      
      // Navigate to initial location if provided
      if (initialLocation) {
        readerService.navigateTo(initialLocation);
      }
    };

    const handleError = (err: any) => {
      console.error('Reader error:', err);
      setError(err.message || 'An error occurred while loading the book');
      setIsLoading(false);
      onError?.(err);
    };

    const handleRelocate = (location: any) => {
      console.log('Location changed:', location);
      onLocationChange?.(location);
      
      // Update progress
      const progress = readerService.getProgress();
      onProgressUpdate?.(progress);
    };

    // Add event listeners
    readerService.on('ready', handleReady);
    readerService.on('error', handleError);
    readerService.on('relocate', handleRelocate);

    // Cleanup event listeners
    return () => {
      readerService.off('ready', handleReady);
      readerService.off('error', handleError);
      readerService.off('relocate', handleRelocate);
    };
  }, [initialLocation, onLocationChange, onError, onProgressUpdate]);

  // Handle font size changes
  useEffect(() => {
    if (readerInitialized.current) {
      readerService.setFontSize(fontSize);
    }
  }, [fontSize]);

  return (
    <div className="flex flex-col h-full">
      {/* Loading and error states */}
      {isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Loading book...</div>
        </div>
      )}
      
      {error && (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500">Error: {error}</div>
        </div>
      )}
      
      {/* Reader container */}
      <div 
        ref={containerRef} 
        id="reader-container"
        className="flex-grow overflow-hidden"
        style={{ 
          height: 'calc(100% - 40px)',
          minHeight: '400px'
        }}
      />
      
      {/* Navigation controls */}
      <div className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800">
        <button 
          onClick={onPrev}
          disabled={!hasPrev || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        
        <button 
          onClick={onNext}
          disabled={!hasNext || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
});

// Set display name for debugging
EnhancedBookReader.displayName = 'EnhancedBookReader';

// Export the component
export { EnhancedBookReader };