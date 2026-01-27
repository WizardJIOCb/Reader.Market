/**
 * ReaderCore - Main book rendering component
 * 
 * Handles:
 * - Book loading and parsing
 * - Paginated and scroll view modes
 * - Text selection
 * - Navigation
 * - Settings application
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { ReaderEngine, createReaderEngine } from './ReaderEngine';
import {
  BookContent,
  Chapter,
  Position,
  ReaderSettings,
  TextSelection,
  DEFAULT_READER_SETTINGS,
  THEME_COLORS,
} from './types';

export interface ReaderCoreProps {
  /** URL to book file */
  bookUrl: string;
  /** MIME type or file extension */
  fileType: string;
  /** Initial position to navigate to */
  initialPosition?: string;
  /** Reader settings */
  settings?: Partial<ReaderSettings>;
  /** Called when book is loaded */
  onReady?: (content: BookContent) => void;
  /** Called when position changes */
  onPositionChange?: (position: Position) => void;
  /** Called when text is selected */
  onTextSelect?: (selection: TextSelection | null) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when chapter changes */
  onChapterChange?: (chapter: Chapter) => void;
}

export interface ReaderCoreHandle {
  /** Navigate to next page */
  nextPage: () => void;
  /** Navigate to previous page */
  prevPage: () => void;
  /** Navigate to specific position */
  goToPosition: (position: Position) => void;
  /** Navigate to chapter */
  goToChapter: (index: number) => void;
  /** Navigate to chapter and find page containing text */
  goToChapterAndFindText: (chapterIndex: number, text: string) => Promise<boolean>;
  /** Navigate to chapter at specific character offset */
  goToChapterAtOffset: (chapterIndex: number, charOffset: number, textToHighlight: string) => Promise<boolean>;
  /** Get current position */
  getPosition: () => Position | null;
  /** Get book content */
  getContent: () => BookContent | null;
  /** Search in book */
  search: (query: string) => void;
  /** Get current page number (1-based) */
  getCurrentPage: () => number;
  /** Get total pages in current chapter */
  getTotalPages: () => number;
  /** Get estimated total pages across all chapters */
  getEstimatedTotalPages: () => number;
  /** Get estimated current page position in entire book (1-based) */
  getEstimatedCurrentPageOverall: () => number;
}

export const ReaderCore = forwardRef<ReaderCoreHandle, ReaderCoreProps>(
  (props, ref) => {
    const {
      bookUrl,
      fileType,
      initialPosition,
      settings: settingsProp,
      onReady,
      onPositionChange,
      onTextSelect,
      onError,
      onChapterChange,
    } = props;

    // Merge settings with defaults
    const settings: ReaderSettings = useMemo(
      () => ({ ...DEFAULT_READER_SETTINGS, ...settingsProp }),
      [settingsProp]
    );

    // State
    const [content, setContent] = useState<BookContent | null>(null);
    const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => 
      typeof window !== 'undefined' && window.innerWidth < 640
    );

    // Refs
    const engineRef = useRef<ReaderEngine | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<string[]>([]);

    // Theme colors
    const themeColors = THEME_COLORS[settings.theme];

    // Track mobile viewport
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 640);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    /**
     * Initialize engine and load book
     */
    useEffect(() => {
      if (!bookUrl) return;

      const loadBook = async () => {
        setLoading(true);
        setError(null);

        try {
          // Create new engine instance
          if (engineRef.current) {
            engineRef.current.destroy();
          }
          engineRef.current = createReaderEngine();

          // Load book
          const bookContent = await engineRef.current.loadBook(bookUrl, fileType);
          setContent(bookContent);

          // Set initial chapter
          if (bookContent.chapters.length > 0) {
            setCurrentChapter(bookContent.chapters[0]);
          }

          onReady?.(bookContent);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load book';
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
          setLoading(false);
        }
      };

      loadBook();

      return () => {
        engineRef.current?.destroy();
        engineRef.current = null;
      };
    }, [bookUrl, fileType]);

    /**
     * Paginate content when chapter or settings change
     */
    useEffect(() => {
      if (!currentChapter || !containerRef.current) return;

      const paginate = () => {
        if (settings.viewMode === 'scroll') {
          // In scroll mode, show all content
          pagesRef.current = [currentChapter.content];
          setTotalPages(1);
          setCurrentPage(0);
          return;
        }

        // Paginated mode - split content into pages
        const container = containerRef.current;
        if (!container) return;

        const pages = paginateHTML(
          currentChapter.content,
          container.clientWidth - settings.margins * 2,
          container.clientHeight - settings.margins * 2,
          settings
        );

        pagesRef.current = pages;
        setTotalPages(pages.length);

        // Ensure current page is within bounds
        // Handle -1 (go to last page when navigating from next chapter)
        if (currentPage < 0) {
          setCurrentPage(Math.max(0, pages.length - 1));
        } else if (currentPage >= pages.length) {
          setCurrentPage(Math.max(0, pages.length - 1));
        }
      };

      // Run pagination immediately for the current chapter
      // Use requestAnimationFrame to ensure DOM is ready
      const rafId = requestAnimationFrame(() => {
        paginate();
      });
      
      return () => cancelAnimationFrame(rafId);
    }, [currentChapter, settings]);

    // Handle page bounds separately (for when navigating to previous chapter with page=-1)
    useEffect(() => {
      const pages = pagesRef.current;
      if (pages.length === 0) return;
      
      if (currentPage < 0) {
        setCurrentPage(Math.max(0, pages.length - 1));
      } else if (currentPage >= pages.length) {
        setCurrentPage(Math.max(0, pages.length - 1));
      }
    }, [currentPage]);

    /**
     * Handle window resize
     */
    useEffect(() => {
      const handleResize = () => {
        if (currentChapter && containerRef.current && settings.viewMode === 'paginated') {
          const pages = paginateHTML(
            currentChapter.content,
            containerRef.current.clientWidth - settings.margins * 2,
            containerRef.current.clientHeight - settings.margins * 2,
            settings
          );
          pagesRef.current = pages;
          setTotalPages(pages.length);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [currentChapter, settings]);

    /**
     * Update position when page changes
     */
    useEffect(() => {
      if (!content || !currentChapter) return;

      const chapterIndex = currentChapter.index;
      const percentage = calculatePercentage(
        content,
        chapterIndex,
        currentPage,
        totalPages
      );

      const position: Position = {
        charOffset: currentChapter.startOffset,
        chapterIndex,
        pageInChapter: currentPage,
        totalPagesInChapter: totalPages,
        percentage,
      };

      engineRef.current?.setPosition(position);
      onPositionChange?.(position);
    }, [content, currentChapter, currentPage, totalPages]);

    /**
     * Handle text selection - capture range immediately, then notify parent
     */
    const captureSelection = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !currentChapter) {
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        // Clone range immediately to preserve it
        const clonedRange = range.cloneRange();

        // Calculate approximate position
        const position = engineRef.current?.getPosition() || {
          charOffset: 0,
          chapterIndex: currentChapter.index,
          pageInChapter: currentPage,
          totalPagesInChapter: totalPages,
          percentage: 0,
        };

        const textSelection: TextSelection = {
          text,
          start: position,
          end: position,
          rect,
          range: clonedRange,
        };

        onTextSelect?.(textSelection);
      } catch (err) {
        console.debug('Selection error:', err);
      }
    }, [currentChapter, currentPage, totalPages, onTextSelect]);

    // Track if mouse button is currently pressed
    const isMouseDownRef = useRef(false);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
      isMouseDownRef.current = false;
      // Use setTimeout to notify parent after current event processing completes
      setTimeout(captureSelection, 0);
    }, [captureSelection]);

    // Handle mobile selection via selectionchange event (only when mouse is NOT pressed)
    useEffect(() => {
      let selectionTimeout: ReturnType<typeof setTimeout> | null = null;
      
      const handleSelectionChange = () => {
        // Skip if mouse is currently pressed (user is still dragging on desktop)
        if (isMouseDownRef.current) {
          return;
        }
        
        // Debounce to avoid multiple rapid calls during selection adjustment
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        selectionTimeout = setTimeout(() => {
          // Double-check mouse is not pressed
          if (isMouseDownRef.current) {
            return;
          }
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selection.toString().trim()) {
            // Check if selection is within our reader content
            if (contentRef.current) {
              try {
                const range = selection.getRangeAt(0);
                if (contentRef.current.contains(range.commonAncestorContainer)) {
                  captureSelection();
                }
              } catch (e) {
                // Range might not exist
              }
            }
          }
        }, 200); // Debounce for 200ms to let user finish adjusting selection
      };
      
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
      };
    }, [captureSelection]);

    // Handle mousedown - track that mouse is pressed
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      isMouseDownRef.current = true;
    }, []);

    // Reset mouse state if released outside our component
    useEffect(() => {
      const handleGlobalMouseUp = () => {
        isMouseDownRef.current = false;
      };
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    /**
     * Navigation methods
     */
    const nextPage = useCallback(() => {
      if (!content || !currentChapter) return;

      if (currentPage < totalPages - 1) {
        // Next page in current chapter
        setCurrentPage(currentPage + 1);
      } else if (currentChapter.index < content.chapters.length - 1) {
        // Next chapter
        const nextChapter = content.chapters[currentChapter.index + 1];
        setCurrentChapter(nextChapter);
        setCurrentPage(0);
        onChapterChange?.(nextChapter);
      }
    }, [content, currentChapter, currentPage, totalPages, onChapterChange]);

    const prevPage = useCallback(() => {
      if (!content || !currentChapter) return;

      if (currentPage > 0) {
        // Previous page in current chapter
        setCurrentPage(currentPage - 1);
      } else if (currentChapter.index > 0) {
        // Previous chapter (go to last page)
        const prevChapter = content.chapters[currentChapter.index - 1];
        setCurrentChapter(prevChapter);
        // Page will be set after pagination
        setCurrentPage(-1); // Will be corrected after pagination
        onChapterChange?.(prevChapter);
      }
    }, [content, currentChapter, currentPage, onChapterChange]);

    const goToChapter = useCallback(
      (index: number) => {
        if (!content || index < 0 || index >= content.chapters.length) return;
        const chapter = content.chapters[index];
        
        // If already on this chapter, just reset to first page
        if (currentChapter?.index === index) {
          setCurrentPage(0);
          return;
        }
        
        // Clear pages to force re-render with new chapter content
        pagesRef.current = [];
        setCurrentChapter(chapter);
        setCurrentPage(0);
        onChapterChange?.(chapter);
      },
      [content, currentChapter, onChapterChange]
    );

    const goToPosition = useCallback(
      (position: Position) => {
        console.log('[GO-TO-POS] goToPosition called with:', position);
        if (!content) {
          console.log('[GO-TO-POS] No content available');
          return;
        }
        const chapter = content.chapters[position.chapterIndex];
        if (!chapter) {
          console.log('[GO-TO-POS] Chapter not found:', position.chapterIndex);
          return;
        }
        
        console.log('[GO-TO-POS] Setting chapter:', chapter.index);
        console.log('[GO-TO-POS] Setting page (before):', position.pageInChapter);
        
        setCurrentChapter(chapter);
        setCurrentPage(position.pageInChapter);
        
        console.log('[GO-TO-POS] Page set to:', position.pageInChapter);
        onChapterChange?.(chapter);
      },
      [content, onChapterChange]
    );

    const search = useCallback(
      (query: string) => {
        return engineRef.current?.searchText(query) || [];
      },
      []
    );

    // Navigate to chapter and find page containing specific text
    const goToChapterAndFindText = useCallback(
      async (chapterIndex: number, textToFind: string): Promise<boolean> => {
        console.log('[TEXT-SEARCH] Starting search for:', textToFind);
        console.log('[TEXT-SEARCH] Chapter index:', chapterIndex);
        
        if (!content || chapterIndex < 0 || chapterIndex >= content.chapters.length) {
          console.log('[TEXT-SEARCH] Invalid chapter index or no content');
          return false;
        }
        
        const chapter = content.chapters[chapterIndex];
        const isChapterChange = currentChapter?.index !== chapterIndex;
        
        console.log('[TEXT-SEARCH] Chapter change needed:', isChapterChange);
        console.log('[TEXT-SEARCH] Current chapter index:', currentChapter?.index);
        
        // Only change chapter if different
        if (isChapterChange) {
          setCurrentChapter(chapter);
          onChapterChange?.(chapter);
          
          // Wait for pagination to complete - multiple frames to ensure DOM is ready
          await new Promise(resolve => setTimeout(resolve, 50));
          await new Promise(resolve => requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve(undefined));
          }));
          // Additional wait for pagination calculations
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // Search through all pages to find the one containing the text
        const pages = pagesRef.current;
        console.log('[TEXT-SEARCH] Pages available:', pages.length);
        
        if (pages.length === 0) {
          console.log('[TEXT-SEARCH] No pages available');
          return false;
        }
        
        // Normalize search text - remove extra whitespace, take first 50 chars
        const searchText = textToFind
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50)
          .toLowerCase();
        
        console.log('[TEXT-SEARCH] Normalized search text:', JSON.stringify(searchText));
        
        for (let i = 0; i < pages.length; i++) {
          // Strip HTML and search in plain text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = pages[i];
          const pageText = (tempDiv.textContent || '')
            .replace(/\s+/g, ' ')
            .toLowerCase();
          
          console.log(`[TEXT-SEARCH] Page ${i} text sample:`, pageText.substring(0, 100));
          
          if (pageText.includes(searchText)) {
            console.log(`[TEXT-SEARCH] Found text on page ${i}`);
            setCurrentPage(i);
            return true;
          }
        }
        
        // Text not found on any page, stay on first page
        console.log('[TEXT-SEARCH] Text not found on any page');
        setCurrentPage(0);
        return false;
      },
      [content, currentChapter, onChapterChange]
    );

    // Navigate to chapter at specific character offset
    const goToChapterAtOffset = useCallback(
      async (chapterIndex: number, charOffset: number, textToHighlight: string): Promise<boolean> => {
        if (!content || chapterIndex < 0 || chapterIndex >= content.chapters.length) {
          return false;
        }
        
        const chapter = content.chapters[chapterIndex];
        const isChapterChange = currentChapter?.index !== chapterIndex;
        
        // Only change chapter if different
        if (isChapterChange) {
          setCurrentChapter(chapter);
          onChapterChange?.(chapter);
          
          // Wait for pagination to complete
          await new Promise(resolve => setTimeout(resolve, 50));
          await new Promise(resolve => requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve(undefined));
          }));
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        const pages = pagesRef.current;
        if (pages.length === 0) {
          return false;
        }
        
        // Calculate approximate page based on character offset proportion
        // First, strip HTML from chapter content to get plain text length
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = chapter.content;
        const plainText = tempDiv.textContent || '';
        const totalChars = plainText.length;
        
        if (totalChars === 0) {
          setCurrentPage(0);
          return false;
        }
        
        // Estimate which page based on character position
        const ratio = charOffset / totalChars;
        const estimatedPage = Math.floor(ratio * pages.length);
        const startPage = Math.max(0, estimatedPage - 1); // Start searching from one page before
        
        // Normalize highlight text for searching
        const highlightText = textToHighlight
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        
        // Search from estimated page outward to find exact match
        for (let offset = 0; offset < pages.length; offset++) {
          // Check pages around the estimated position
          const pagesToCheck = [startPage + offset, startPage - offset - 1];
          
          for (const pageIdx of pagesToCheck) {
            if (pageIdx < 0 || pageIdx >= pages.length) continue;
            
            const pageTempDiv = document.createElement('div');
            pageTempDiv.innerHTML = pages[pageIdx];
            const pageText = (pageTempDiv.textContent || '')
              .replace(/\s+/g, ' ')
              .toLowerCase();
            
            if (pageText.includes(highlightText)) {
              setCurrentPage(pageIdx);
              return true;
            }
          }
        }
        
        // Fallback to estimated page if text not found
        setCurrentPage(Math.min(estimatedPage, pages.length - 1));
        return false;
      },
      [content, currentChapter, onChapterChange]
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        nextPage,
        prevPage,
        goToPosition,
        goToChapter,
        goToChapterAndFindText,
        goToChapterAtOffset,
        getPosition: () => engineRef.current?.getPosition() || null,
        getContent: () => content,
        search,
        getCurrentPage: () => currentPage + 1, // 1-based for display
        getTotalPages: () => totalPages,
        getEstimatedTotalPages: () => {
          if (!content || !currentChapter || totalPages === 0) return 1;
          // Estimate total pages based on content length ratios
          const currentChapterLength = currentChapter.content.length;
          const charsPerPage = currentChapterLength / totalPages;
          if (charsPerPage <= 0) return 1;
          
          let estimatedTotal = 0;
          for (const chapter of content.chapters) {
            estimatedTotal += Math.max(1, Math.ceil(chapter.content.length / charsPerPage));
          }
          return Math.max(1, estimatedTotal);
        },
        getEstimatedCurrentPageOverall: () => {
          if (!content || !currentChapter || totalPages === 0) return 1;
          // Estimate pages in previous chapters + current page
          const currentChapterLength = currentChapter.content.length;
          const charsPerPage = currentChapterLength / totalPages;
          if (charsPerPage <= 0) return 1;
          
          let pagesBeforeCurrent = 0;
          for (let i = 0; i < currentChapter.index; i++) {
            pagesBeforeCurrent += Math.max(1, Math.ceil(content.chapters[i].content.length / charsPerPage));
          }
          return pagesBeforeCurrent + currentPage + 1; // +1 for 1-based display
        },
      }),
      [nextPage, prevPage, goToPosition, goToChapter, goToChapterAndFindText, goToChapterAtOffset, content, search, currentPage, totalPages, currentChapter]
    );

    /**
     * Handle keyboard navigation
     */
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        switch (e.key) {
          case 'ArrowRight':
          case 'PageDown':
          case ' ':
            e.preventDefault();
            nextPage();
            break;
          case 'ArrowLeft':
          case 'PageUp':
            e.preventDefault();
            prevPage();
            break;
          case 'Home':
            e.preventDefault();
            goToChapter(0);
            break;
          case 'End':
            e.preventDefault();
            if (content) goToChapter(content.chapters.length - 1);
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextPage, prevPage, goToChapter, content]);

    /**
     * Touch/swipe navigation
     */
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Only handle horizontal swipes (quick gesture, not long press)
      if (deltaTime < 500 && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          prevPage();
        } else {
          nextPage();
        }
      } else {
        // Not a swipe - check if there's a text selection (from long-press)
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selection.toString().trim()) {
            captureSelection();
          }
        }, 100);
      }

      touchStartRef.current = null;
    };

    // Render loading state
    if (loading) {
      return (
        <div
          className="flex items-center justify-center h-full"
          style={{ backgroundColor: themeColors.background }}
        >
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
              style={{ borderColor: themeColors.accent }}
            />
            <p style={{ color: themeColors.text }}>Loading book...</p>
          </div>
        </div>
      );
    }

    // Render error state
    if (error) {
      return (
        <div
          className="flex items-center justify-center h-full"
          style={{ backgroundColor: themeColors.background }}
        >
          <div className="text-center max-w-md p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: themeColors.text }}>
              Error Loading Book
            </h3>
            <p className="text-sm" style={{ color: themeColors.text, opacity: 0.7 }}>
              {error}
            </p>
          </div>
        </div>
      );
    }

    // Render book content
    const currentContent = settings.viewMode === 'scroll'
      ? currentChapter?.content || ''
      : (pagesRef.current.length > 0 ? pagesRef.current[currentPage] : currentChapter?.content) || '';

    return (
      <div
        ref={containerRef}
        className="reader-container w-full h-full relative"
        style={{
          backgroundColor: themeColors.background,
          color: themeColors.text,
        }}
      >
        {/* Navigation zone - Previous page (left side) - Inside mode or mobile */}
        {settings.viewMode === 'paginated' && (isMobile || settings.navigationZonePosition === 'inside') && (
          <div
            className="absolute left-0 top-0 bottom-0 w-16 z-10 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
            style={{
              background: `linear-gradient(to right, ${themeColors.accent}40, transparent)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              prevPage();
            }}
            title="Предыдущая страница"
          >
            <svg 
              className="w-8 h-8 opacity-60" 
              style={{ color: themeColors.text }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        )}

        {/* Navigation zone - Next page (right side) - Inside mode or mobile */}
        {settings.viewMode === 'paginated' && (isMobile || settings.navigationZonePosition === 'inside') && (
          <div
            className="absolute right-0 top-0 bottom-0 w-16 z-10 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
            style={{
              background: `linear-gradient(to left, ${themeColors.accent}40, transparent)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              nextPage();
            }}
            title="Следующая страница"
          >
            <svg 
              className="w-8 h-8 opacity-60" 
              style={{ color: themeColors.text }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}

        <div
          ref={contentRef}
          className={`reader-content h-full ${settings.viewMode === 'scroll' ? 'overflow-y-auto' : ''}`}
          style={{
            padding: `${settings.margins}px`,
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            textAlign: settings.textAlign,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseUp={handleMouseUp}
          onMouseDown={handleMouseDown}
        >
          <style>{`
            .reader-content {
              user-select: text !important;
              -webkit-user-select: text !important;
              -moz-user-select: text !important;
              -ms-user-select: text !important;
              -webkit-user-drag: none !important;
              position: relative;
            }
            .reader-content * {
              user-select: text !important;
              -webkit-user-select: text !important;
              -webkit-user-drag: none !important;
            }
            .reader-content img {
              max-width: 100%;
              max-height: 80%;
              height: auto;
              object-fit: contain;
              display: block;
              margin: 1em auto;
            }
            .reader-content p {
              margin-bottom: 1em;
              text-indent: ${settings.paragraphIndent}em;
              display: block;
            }
            .reader-content p:first-child {
              text-indent: 0;
            }
            .reader-content h1, .reader-content h2, .reader-content h3 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              text-indent: 0;
              display: block;
            }
            .reader-content blockquote {
              margin: 1em 2em;
              padding-left: 1em;
              border-left: 3px solid ${themeColors.accent};
              font-style: italic;
              display: block;
            }
            .reader-content .epigraph {
              margin: 1em 3em;
              font-style: italic;
              text-align: right;
            }
            .reader-content .poem {
              margin: 1em 2em;
            }
            .reader-content .verse {
              text-indent: 0;
              margin-bottom: 0.3em;
            }
            .reader-content a {
              color: ${themeColors.accent};
              text-decoration: none;
            }
            .reader-content a:hover {
              text-decoration: underline;
            }
            .reader-content div {
              display: block;
            }
          `}</style>
          <div dangerouslySetInnerHTML={{ __html: currentContent }} />
        </div>
      </div>
    );
  }
);

ReaderCore.displayName = 'ReaderCore';

/**
 * Paginate HTML content into pages
 * Uses a more accurate approach by rendering full content and splitting by height
 */
function paginateHTML(
  html: string,
  width: number,
  height: number,
  settings: ReaderSettings
): string[] {
  // Create temporary container for measurement with all reader styles
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.width = `${width}px`;
  container.style.fontFamily = settings.fontFamily;
  container.style.fontSize = `${settings.fontSize}px`;
  container.style.lineHeight = String(settings.lineHeight);
  container.style.textAlign = settings.textAlign;
  container.className = 'reader-content';
  
  // Add the same styles that are applied in the reader
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .reader-content img {
      max-width: 100%;
      max-height: 80%;
      height: auto;
      object-fit: contain;
      display: block;
      margin: 1em auto;
    }
    .reader-content p {
      margin-bottom: 1em;
      text-indent: ${settings.paragraphIndent}em;
    }
    .reader-content p:first-child {
      text-indent: 0;
    }
    .reader-content h1, .reader-content h2, .reader-content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      text-indent: 0;
    }
    .reader-content blockquote {
      margin: 1em 2em;
      padding-left: 1em;
      font-style: italic;
    }
  `;
  document.head.appendChild(styleEl);
  
  container.innerHTML = html;
  document.body.appendChild(container);

  const pages: string[] = [];
  
  // Get all block-level elements (only direct children to avoid duplicates)
  const getBlockElements = (parent: Element): Element[] => {
    const blocks: Element[] = [];
    const children = parent.children;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const tagName = child.tagName.toLowerCase();
      
      // Include block-level elements
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div', 'section', 'article', 'ul', 'ol', 'li', 'pre', 'table', 'hr'].includes(tagName)) {
        blocks.push(child);
      }
    }
    
    // If no block elements found, treat the whole content as one block
    if (blocks.length === 0 && parent.innerHTML.trim()) {
      return [parent];
    }
    
    return blocks;
  };
  
  const elements = getBlockElements(container);
  
  let currentPageHTML = '';
  let currentHeight = 0;

  // Measure each element's height in context with proper styles
  const measureElement = (el: Element, isFirst: boolean): number => {
    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.width = `${width}px`;
    measureDiv.style.fontFamily = settings.fontFamily;
    measureDiv.style.fontSize = `${settings.fontSize}px`;
    measureDiv.style.lineHeight = String(settings.lineHeight);
    measureDiv.style.textAlign = settings.textAlign;
    measureDiv.className = 'reader-content';
    measureDiv.innerHTML = el.outerHTML;
    document.body.appendChild(measureDiv);
    
    const elementHeight = measureDiv.offsetHeight;
    document.body.removeChild(measureDiv);
    
    return elementHeight;
  };

  elements.forEach((element, index) => {
    const elementHeight = measureElement(element, currentPageHTML === '');
    
    // If single element is taller than page, we need to include it anyway
    if (elementHeight > height && currentPageHTML === '') {
      pages.push(element.outerHTML);
      return;
    }

    if (currentHeight + elementHeight > height && currentPageHTML) {
      // Start new page
      pages.push(currentPageHTML);
      currentPageHTML = element.outerHTML;
      currentHeight = elementHeight;
    } else {
      currentPageHTML += element.outerHTML;
      currentHeight += elementHeight;
    }
  });

  // Add last page
  if (currentPageHTML) {
    pages.push(currentPageHTML);
  }

  document.body.removeChild(container);
  document.head.removeChild(styleEl);

  return pages.length > 0 ? pages : [html];
}

/**
 * Calculate reading percentage
 */
function calculatePercentage(
  content: BookContent,
  chapterIndex: number,
  pageInChapter: number,
  totalPagesInChapter: number
): number {
  if (!content || content.chapters.length === 0) return 0;

  // Show 0% at the very start of the book (first page of first chapter)
  if (chapterIndex === 0 && pageInChapter === 0) return 0;

  // Calculate based on chapters and pages
  // pageInChapter is 0-based, so add 1 to represent "having reached" this page
  const chapterWeight = 1 / content.chapters.length;
  const chapterProgress = chapterIndex * chapterWeight;
  const pageProgress = ((pageInChapter + 1) / Math.max(1, totalPagesInChapter)) * chapterWeight;

  return Math.min(100, (chapterProgress + pageProgress) * 100);
}

export default ReaderCore;
