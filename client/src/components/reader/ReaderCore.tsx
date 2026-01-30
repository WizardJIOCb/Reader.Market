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
import { canonicalizeForOffsets, normalizeForSearch, extractStructuredText } from './textNormalization';
import {
  BookContent,
  Chapter,
  Position,
  ReaderSettings,
  TextSelection,
  PageMapItem,
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
  /** Whether to hide the internal loading spinner (when external splash is shown) */
  hideInternalLoader?: boolean;
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
  goToChapterAndFindText: (chapterIndex: number, text: string, targetPage?: number) => Promise<boolean>;
  /** Navigate to chapter at specific character offset */
  goToChapterAtOffset: (chapterIndex: number, charOffset: number, textToHighlight: string) => Promise<boolean>;
  /** Navigate to specific global character offset with fallback options */
  goToCharOffset: (
    charOffsetInBook: number,
    opts?: { anchorText?: string; chapterIndexHint?: number; pageHintInChapter?: number }
  ) => Promise<boolean>;
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
      hideInternalLoader = false,
    } = props;

    // Merge settings with defaults
    const settings: ReaderSettings = useMemo(
      () => ({ ...DEFAULT_READER_SETTINGS, ...settingsProp }),
      [settingsProp]
    );

    // State
    const [content, setContent] = useState<BookContent | null>(null);
    const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
    const [currentChapterArrayIndex, setCurrentChapterArrayIndex] = useState<number>(0); // Safe array index
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => 
      typeof window !== 'undefined' && window.innerWidth < 640
    );

    // Unified position emission function
    const emitPosition = useCallback(() => {
      if (!content || !currentChapter) return;

      const pages = pagesRef.current;
      const pageItem = pages?.[currentPage];

      const pageStartInChapter = pageItem?.startChar ?? 0; // char offset within chapter.plainText
      const charOffsetInBook = (currentChapter.startOffset ?? 0) + pageStartInChapter;

      const pos: Position = {
        chapterIndex: currentChapter.index, // важно: плотный индекс
        pageInChapter: currentPage,
        totalPagesInChapter: pages?.length ?? 0,
        charOffset: charOffsetInBook, // ГЛОБАЛЬНЫЙ оффсет по книге
        percentage:
          content.totalChars && content.totalChars > 0
            ? (charOffsetInBook / content.totalChars) * 100
            : 0,
      };

      onPositionChange?.(pos);
    }, [content, currentChapter, currentPage, onPositionChange]);

    // Refs
    const engineRef = useRef<ReaderEngine | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<PageMapItem[]>([]);
    const currentChapterIndexRef = useRef<number>(0);
    
    // Safe chapter navigation helpers
    const setChapterByArrayIndex = useCallback((arrayIndex: number) => {
      if (!content) return;
      const safeIndex = Math.max(0, Math.min(arrayIndex, content.chapters.length - 1));
      const chapter = content.chapters[safeIndex];
      setCurrentChapter(chapter);
      setCurrentChapterArrayIndex(safeIndex);
      currentChapterIndexRef.current = safeIndex;
      onChapterChange?.(chapter);
    }, [content, onChapterChange]);
    
    const getCurrentChapterArrayIndex = useCallback(() => {
      if (!content || !currentChapter) return 0;
      // Find the actual array index of current chapter
      const actualIndex = content.chapters.findIndex(ch => ch.index === currentChapter.index);
      return actualIndex === -1 ? currentChapterArrayIndex : actualIndex;
    }, [content, currentChapter, currentChapterArrayIndex]);

    // Theme colors
    const themeColors = THEME_COLORS[settings.theme];

    // Track current chapter index
    useEffect(() => {
      if (currentChapter) {
        const actualIndex = content?.chapters.findIndex(ch => ch.index === currentChapter.index) ?? 0;
        const arrayIndex = actualIndex === -1 ? currentChapterArrayIndex : actualIndex;
        currentChapterIndexRef.current = arrayIndex;
        setCurrentChapterArrayIndex(arrayIndex);
      }
    }, [currentChapter, content, currentChapterArrayIndex]);

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
          // In scroll mode, show all content as one page with character mapping
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = currentChapter.content;
          const plainText = normalizePlainText(tempDiv.textContent || '');
          
          pagesRef.current = [{
            html: currentChapter.content,
            text: plainText,
            startChar: 0,
            endChar: plainText.length,
          }];
          
          // Validate length matches expected chapter length
          if (plainText.length !== currentChapter.plainText.length) {
            console.warn(`[SCROLL-MODE] Length mismatch: measured(${plainText.length}) != expected(${currentChapter.plainText.length})`);
            // Adjust to match expected length
            pagesRef.current[0].endChar = currentChapter.plainText.length;
          }
          
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
          settings,
          currentChapter.plainText.length // Pass expected length for validation
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
            settings,
            currentChapter.plainText.length // Pass expected length for validation
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
      
      // Use unified position emission
      requestAnimationFrame(() => emitPosition());
    }, [content, currentChapter, currentPage, emitPosition]);

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
      
      const currentArrayIndex = getCurrentChapterArrayIndex();

      if (currentPage < totalPages - 1) {
        // Next page in current chapter
        setCurrentPage(currentPage + 1);
      } else if (currentArrayIndex < content.chapters.length - 1) {
        // Next chapter
        setChapterByArrayIndex(currentArrayIndex + 1);
        setCurrentPage(0);
      }
    }, [content, currentChapter, currentPage, totalPages, getCurrentChapterArrayIndex, setChapterByArrayIndex]);

    const prevPage = useCallback(() => {
      if (!content || !currentChapter) return;
      
      const currentArrayIndex = getCurrentChapterArrayIndex();

      if (currentPage > 0) {
        // Previous page in current chapter
        setCurrentPage(currentPage - 1);
      } else if (currentArrayIndex > 0) {
        // Previous chapter (go to last page)
        setChapterByArrayIndex(currentArrayIndex - 1);
        // Page will be set after pagination
        setCurrentPage(-1); // Will be corrected after pagination
      }
    }, [content, currentChapter, currentPage, getCurrentChapterArrayIndex, setChapterByArrayIndex]);

    const goToChapter = useCallback(
      (index: number) => {
        if (!content || index < 0 || index >= content.chapters.length) return;
        
        // Clear pages to force re-render with new chapter content
        pagesRef.current = [];
        setChapterByArrayIndex(index);
        setCurrentPage(0);
      },
      [content, setChapterByArrayIndex]
    );

    const goToPosition = useCallback(
      (position: Position) => {
        // console.log('[GO-TO-POS] goToPosition called with:', position);
        if (!content) {
          console.log('[GO-TO-POS] No content available');
          return;
        }
        const chapter = content.chapters[position.chapterIndex];
        if (!chapter) {
          // console.log('[GO-TO-POS] Chapter not found:', position.chapterIndex);
          return;
        }
        
        console.log('[GO-TO-POS] Setting chapter:', chapter.index);
        console.log('[GO-TO-POS] Requested pageInChapter:', position.pageInChapter);
        console.log('[GO-TO-POS] Position totalPagesInChapter:', position.totalPagesInChapter);
        console.log('[GO-TO-POS] Chapter object:', {
          index: chapter.index,
          title: chapter.title,
          // pages: chapter.pages // This property may not exist
        });
        
        setCurrentChapter(chapter);
        setCurrentPage(position.pageInChapter);
        
        console.log('[GO-TO-POS] Actually set page to:', position.pageInChapter);
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
      async (chapterIndex: number, textToFind: string, targetPage?: number): Promise<boolean> => {
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
        
        // More sophisticated text normalization for better matching
        // Preserve special characters but normalize whitespace
        const normalizeText = (text: string) => {
          return text
            .replace(/[\s\u00A0]+/g, ' ')  // Normalize all whitespace including non-breaking spaces
            .replace(/\.([А-ЯA-Z])/g, '. $1')  // Add space after periods followed by uppercase letters
            .replace(/\?([А-ЯA-Z])/g, '? $1')  // Add space after question marks followed by uppercase letters
            .replace(/\!([А-ЯA-Z])/g, '! $1')  // Add space after exclamation marks followed by uppercase letters
            .trim()
            .substring(0, 300);  // Increase character limit for better matching
        };
        
        const searchText = normalizeText(textToFind);
        console.log('[TEXT-SEARCH] Normalized search text:', JSON.stringify(searchText));
        console.log('[TEXT-SEARCH] Search text length:', searchText.length);
        
        // Try exact match first - check more thoroughly
        let foundOnPage = -1;
        for (let i = 0; i < pages.length; i++) {
          // Strip HTML and normalize text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = pages[i].html;
          const pageText = normalizeText(tempDiv.textContent || '');
          
          // Log more detailed info for debugging
          if (i < 5 || i === pages.length - 1 || i === (targetPage ?? 0)) {  // Log first 5, last page, and target page
            console.log(`[TEXT-SEARCH] Page ${i} text sample:`, pageText.substring(0, 200));
                    
            // If this is the target page, log the full page content for debugging
            if (i === (targetPage ?? 0)) {
              console.log(`[TEXT-SEARCH] FULL TARGET PAGE ${i} CONTENT:`, pageText);
            }
          }
          
          if (pageText.includes(searchText)) {
            console.log(`[TEXT-SEARCH] Found exact text match on page ${i}`);
            foundOnPage = i;
            break;
          }
          
          // Also check if the search text appears in chunks
          if (searchText.length > 20) {
            const chunks = [
              searchText.substring(0, Math.min(30, searchText.length)),
              searchText.substring(Math.max(0, searchText.length - 30))
            ];
            
            const chunkMatches = chunks.filter(chunk => 
              pageText.includes(chunk)
            ).length;
            
            if (chunkMatches >= 1) {  // At least one chunk found
              console.log(`[TEXT-SEARCH] Found chunk match on page ${i} (${chunkMatches}/2 chunks)`);
              foundOnPage = i;
              break;
            }
          }
        }
        
        if (foundOnPage !== -1) {
          console.log(`[TEXT-SEARCH] Setting page to: ${foundOnPage}`);
          setCurrentPage(foundOnPage);
          return true;
        }
        
        // If we have a target page, let's check it specifically
        const targetPageIndex = targetPage ?? 0;
        if (targetPageIndex >= 0 && targetPageIndex < pages.length) {
          console.log(`[TEXT-SEARCH] Checking target page ${targetPageIndex} specifically`);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = pages[targetPageIndex].html;
          const targetPageText = normalizeText(tempDiv.textContent || '');
          
          console.log(`[TEXT-SEARCH] Target page ${targetPageIndex} full text:`, targetPageText);
          
          // Check for the exact text on target page
          if (targetPageText.includes(searchText)) {
            console.log(`[TEXT-SEARCH] Found exact text on target page ${targetPageIndex}`);
            setCurrentPage(targetPageIndex);
            return true;
          }
          
          // Check for partial matches
          const targetWords = searchText.split(' ').filter(word => word.length > 3);
          const targetMatches = targetWords.filter(word => 
            targetPageText.includes(word)
          ).length;
          
          if (targetMatches >= Math.ceil(targetWords.length / 2)) {
            console.log(`[TEXT-SEARCH] Found partial match on target page ${targetPageIndex} (${targetMatches}/${targetWords.length} words)`);
            setCurrentPage(targetPageIndex);
            return true;
          }
        }
        
        // If exact match fails, try fuzzy matching (partial matches)
        console.log('[TEXT-SEARCH] Exact match failed, trying fuzzy matching');
        const searchWords = searchText.split(' ').filter(word => word.length > 2); // Words longer than 2 chars
        
        if (searchWords.length > 0) {
          for (let i = 0; i < pages.length; i++) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = pages[i].html;
            const pageText = normalizeText(tempDiv.textContent || '').toLowerCase();
            const searchLower = searchText.toLowerCase();
            
            // Check if major parts of the text are present
            const wordMatches = searchWords.filter(word => 
              pageText.includes(word.toLowerCase())
            ).length;
            
            // More lenient matching - accept if at least 2 significant words match
            // or if a substantial portion of the text is found
            const hasSubstantialMatch = wordMatches >= Math.max(2, Math.ceil(searchWords.length / 2)) || 
                                      pageText.includes(searchLower.substring(0, Math.min(15, searchLower.length))) ||
                                      pageText.includes(searchLower.substring(Math.max(0, searchLower.length - 15)));
            
            if (hasSubstantialMatch) {
              console.log(`[TEXT-SEARCH] Found substantial match on page ${i} (${wordMatches}/${searchWords.length} words match)`);
              setCurrentPage(i);
              return true;
            }
          }
        }
        
        // INTERMEDIATE FALLBACK: Use the regular search engine if fuzzy matching fails
        console.log('[TEXT-SEARCH] Fuzzy matching failed, trying regular search engine');
              
        // Use the engine's built-in search functionality
        const engineSearchResults = search(textToFind);
        if (engineSearchResults && engineSearchResults.length > 0) {
          // Take the first result's position, but verify it's in the correct chapter
          const firstResult = engineSearchResults[0];
          // Safe logging of position data
          const safePosition = {
            pageInChapter: firstResult.position.pageInChapter,
            chapterIndex: firstResult.position.chapterIndex
          };
          console.log(`[TEXT-SEARCH] Found text via regular search engine on page ${safePosition.pageInChapter}`);
          console.log(`[TEXT-SEARCH] Result chapter: ${safePosition.chapterIndex}, Target chapter: ${chapterIndex}`);
                
          // Verify the result is in the correct chapter
          if (firstResult.position.chapterIndex === chapterIndex) {
            console.log('[TEXT-SEARCH] Chapter verified, using this position');
            setCurrentPage(firstResult.position.pageInChapter);
            return true;
          } else {
            console.log('[TEXT-SEARCH] Chapter mismatch, continuing to next page search');
          }
        }
        
        // FINAL FALLBACK: Use the regular search engine if all other methods fail
        console.log('[TEXT-SEARCH] All matching failed, trying regular search engine as final fallback');
        
        // Use the engine's built-in search functionality
        const finalSearchResults = search(textToFind);
        if (finalSearchResults && finalSearchResults.length > 0) {
          // Take the first result's position
          const firstResult = finalSearchResults[0];
          // Safe logging of position data
          const safePosition = {
            pageInChapter: firstResult.position.pageInChapter,
            chapterIndex: firstResult.position.chapterIndex
          };
          console.log(`[TEXT-SEARCH] Found text via regular search engine on page ${safePosition.pageInChapter}`);
          setCurrentPage(firstResult.position.pageInChapter);
          return true;
        }
        
        // Show final failure message
        console.log('[TEXT-SEARCH] Exhausted all search methods - text not found in chapter');
        
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
            pageTempDiv.innerHTML = pages[pageIdx].html;
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

    /**
     * Navigate to specific global character offset with fallback options
     * Handles pagination readiness with retry logic and hint optimization
     */
    const goToCharOffset = useCallback(
      async (
        charOffsetInBook: number,
        opts?: { anchorText?: string; chapterIndexHint?: number; pageHintInChapter?: number }
      ): Promise<boolean> => {
        if (!content) return false;

        const clamped = Math.max(0, Math.min(charOffsetInBook, content.totalChars));

        // 1) Find chapter by offsets
        let chapterIndex = content.chapters.findIndex(
          ch => clamped >= ch.startOffset && clamped < ch.endOffset
        );

        if (chapterIndex === -1) {
          chapterIndex = content.chapters.length - 1;
        }

        const chapter = content.chapters[chapterIndex];
        if (!chapter) return false;

        const localOffset = Math.max(0, clamped - chapter.startOffset);

        // 2) Switch chapter if needed
        const isChapterChange = currentChapterIndexRef.current !== chapterIndex;
        if (isChapterChange) {
          setCurrentChapter(chapter);
          onChapterChange?.(chapter);

          // Wait for pagination to complete with proper sequencing
          await new Promise(resolve => setTimeout(resolve, 50));
          await new Promise(resolve => requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve(undefined));
          }));
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        // 3) Scroll mode: approximate by ratio
        if (settings.viewMode === 'scroll') {
          const el = contentRef.current;
          if (el) {
            const ratio = chapter.plainText ? (localOffset / Math.max(1, chapter.plainText.length)) : 0;
            el.scrollTop = ratio * el.scrollHeight;
          }
          setCurrentPage(0);
          return true;
        }

        // 4) Paginated mode: find page with retry logic and hint optimization
        const attemptRestore = async (attempt = 0): Promise<boolean> => {
          const maxAttempts = 3;
          const pages = pagesRef.current;
          
          if (!pages || pages.length === 0) {
            if (attempt < maxAttempts) {
              // Wait and retry with exponential backoff
              const delay = [50, 150, 300][attempt];
              console.log(`[RESTORE] Waiting ${delay}ms for pagination (attempt ${attempt + 1}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              return attemptRestore(attempt + 1);
            }
            console.warn('[RESTORE] Pagination not ready after', maxAttempts, 'attempts');
            setCurrentPage(0);
            return false;
          }

          // 5) Find page using hints first, then range search
          let pageIdx = -1;
          
          // Try page hint first if provided and valid
          if (typeof opts?.pageHintInChapter === 'number' && 
              opts.pageHintInChapter >= 0 && 
              opts.pageHintInChapter < pages.length) {
            const hintedPage = pages[opts.pageHintInChapter];
            if (localOffset >= hintedPage.startChar && localOffset < hintedPage.endChar) {
              pageIdx = opts.pageHintInChapter;
              console.log(`[RESTORE] Using page hint ${opts.pageHintInChapter} (hit)`);
            } else {
              // Check neighboring pages around the hint
              const neighbors = [
                opts.pageHintInChapter - 1,
                opts.pageHintInChapter + 1
              ].filter(i => i >= 0 && i < pages.length);
              
              for (const neighborIdx of neighbors) {
                const neighborPage = pages[neighborIdx];
                if (localOffset >= neighborPage.startChar && localOffset < neighborPage.endChar) {
                  pageIdx = neighborIdx;
                  console.log(`[RESTORE] Using neighbor page ${neighborIdx} near hint ${opts.pageHintInChapter}`);
                  break;
                }
              }
            }
          }

          // Fall back to range search if hint didn't work
          if (pageIdx === -1) {
            pageIdx = pages.findIndex(p => localOffset >= p.startChar && localOffset < p.endChar);
            if (pageIdx === -1) {
              let best = 0;
              for (let i = 0; i < pages.length; i++) if (pages[i].startChar <= localOffset) best = i;
              pageIdx = best;
            }
            console.log(`[RESTORE] Found page ${pageIdx} via range search`);
          }

          // 6) Enhanced anchor fallback with drift compensation
          if (opts?.anchorText && opts.anchorText.trim().length > 10) {
            const normalizedNeedle = canonicalizeForOffsets(opts.anchorText);
            if (normalizedNeedle) {
              const targetPageText = canonicalizeForOffsets(pages[pageIdx]?.text || '');
              if (!targetPageText.includes(normalizedNeedle)) {
                console.log(`[RESTORE] Anchor mismatch on page ${pageIdx}, searching alternatives...`);
                
                // Enhanced search - look in neighboring pages first
                const searchRadius = 3;
                let found = -1;
                
                // Search around the hinted page
                if (typeof opts.pageHintInChapter === 'number') {
                  const start = Math.max(0, opts.pageHintInChapter - searchRadius);
                  const end = Math.min(pages.length - 1, opts.pageHintInChapter + searchRadius);
                  
                  for (let i = start; i <= end; i++) {
                    if (i !== pageIdx) {
                      const searchText = canonicalizeForOffsets(pages[i]?.text || '');
                      if (searchText.includes(normalizedNeedle)) {
                        found = i;
                        console.log(`[RESTORE] Found anchor in neighboring page ${i} (hint radius search)`);
                        break;
                      }
                    }
                  }
                }
                
                // If not found nearby, search globally
                if (found === -1) {
                  found = pages.findIndex(p => 
                    canonicalizeForOffsets(p.text || '').includes(normalizedNeedle)
                  );
                  if (found !== -1) {
                    console.log(`[RESTORE] Found anchor in page ${found} (global search)`);
                  }
                }
                
                if (found !== -1) {
                  pageIdx = found;
                  console.log(`[RESTORE] Anchor fallback moved to page ${found}`);
                } else {
                  console.log(`[RESTORE] Anchor text not found anywhere, staying on page ${pageIdx}`);
                }
              } else {
                console.log(`[RESTORE] Anchor text matched on target page ${pageIdx}`);
              }
            }
          }

          setCurrentPage(Math.max(0, Math.min(pageIdx, pages.length - 1)));
          console.log(`[RESTORE] Successfully restored to page ${pageIdx} at offset ${localOffset}`);
          return true;
        };

        return attemptRestore();
      },
      [content, settings.viewMode, onChapterChange]
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
        goToCharOffset,
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
          
          // Use safe array index for calculation
          const currentArrayIndex = getCurrentChapterArrayIndex();
          
          // Estimate pages in previous chapters + current page
          const currentChapterLength = currentChapter.content.length;
          const charsPerPage = currentChapterLength / totalPages;
          if (charsPerPage <= 0) return 1;
          
          let pagesBeforeCurrent = 0;
          for (let i = 0; i < currentArrayIndex; i++) {
            pagesBeforeCurrent += Math.max(1, Math.ceil(content.chapters[i].content.length / charsPerPage));
          }
          return pagesBeforeCurrent + currentPage + 1; // +1 for 1-based display
        },
      }),
      [nextPage, prevPage, goToPosition, goToChapter, goToChapterAndFindText, goToChapterAtOffset, goToCharOffset, content, search, currentPage, totalPages, currentChapter, getCurrentChapterArrayIndex]
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
    if (loading && !hideInternalLoader) {
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
    
    // When hiding internal loader but still loading, render empty container
    if (loading && hideInternalLoader) {
      return (
        <div
          className="w-full h-full"
          style={{ backgroundColor: themeColors.background }}
        />
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
      : (pagesRef.current.length > 0 ? pagesRef.current[currentPage]?.html : currentChapter?.content) || '';

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
 * Normalize plain text consistently with ReaderEngine
 * Uses canonical form for offset calculations, search form for comparisons
 */
function normalizePlainText(text: string): string {
  return canonicalizeForOffsets(text);
}

/**
 * Paginate HTML content into pages
 * Uses a more accurate approach by rendering full content and splitting by height
 */
function paginateHTML(
  html: string,
  width: number,
  height: number,
  settings: ReaderSettings,
  expectedLen?: number
): PageMapItem[] {
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

  const pages: PageMapItem[] = [];
  
  // Cursor tracks cumulative character count for accurate page mapping
  let cursor = 0;
  
  // Helper function to add page with correct start/end char positions
  const pushPage = (html: string, text: string) => {
    // Canonicalize text for consistency and safety
    const canon = canonicalizeForOffsets(text);
    const startChar = cursor;
    const endChar = cursor + canon.length;
    pages.push({ html, text: canon, startChar, endChar });
    cursor = endChar;
    
    // Dev validation - log if ranges don't look correct
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PAGE-MAP] Page ${pages.length - 1}: start=${startChar}, end=${endChar}, length=${canon.length}`);
    }
  };
  
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
  let currentPagePlainText = '';
  let currentHeight = 0;

  // Measure each element's height in context with proper styles
  const measureElement = (el: Element, isFirst: boolean): { height: number; plainText: string } => {
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
    const elementText = extractStructuredText(el.outerHTML);
    document.body.removeChild(measureDiv);
    
    return { height: elementHeight, plainText: elementText };
  };

  elements.forEach((element, index) => {
    const { height: elementHeight, plainText: elementText } = measureElement(element, currentPageHTML === '');
    
    // If single element is taller than page, we need to include it anyway
    if (elementHeight > height && currentPageHTML === '') {
      // This is a standalone tall element - create its own page
      pushPage(element.outerHTML, elementText);
      return;
    }

    if (currentHeight + elementHeight > height && currentPageHTML) {
      // Start new page with accumulated content
      pushPage(currentPageHTML, currentPagePlainText);
      
      // Boundary spacing fix - ensure proper separation between pages
      if (pages.length > 0 && currentPagePlainText.trim().length > 0 && elementText.trim().length > 0) {
        const lastPage = pages[pages.length - 1];
        // Add space between pages if not already present
        if (!((lastPage.text || '').endsWith(' '))) {
          lastPage.text = (lastPage.text || '') + ' ';
          lastPage.endChar += 1;
          cursor += 1;
        }
      }
      
      currentPageHTML = element.outerHTML;
      currentPagePlainText = elementText;
      currentHeight = elementHeight;
    } else {
      currentPageHTML += element.outerHTML;
      // Add space between blocks to prevent text concatenation
      currentPagePlainText += (currentPagePlainText ? ' ' : '') + elementText;
      currentHeight += elementHeight;
    }
  });

  // Add last page
  if (currentPageHTML) {
    pushPage(currentPageHTML, currentPagePlainText);
  }

  document.body.removeChild(container);
  document.head.removeChild(styleEl);

  // Final validation in development mode
  if (process.env.NODE_ENV === 'development' && pages.length > 0) {
    console.log('[PAGE-MAP] Validation results:');
    console.log('  Pages count:', pages.length);
    console.log('  First page start:', pages[0].startChar);
    console.log('  Last page end:', pages[pages.length - 1].endChar);
    console.log('  Cursor total:', cursor);
    
    // Comprehensive validation: sequential + cover check
    let isValid = true;
    let validationIssues: string[] = [];
    
    // Check 1: First page starts at 0
    if (pages[0].startChar !== 0) {
      validationIssues.push(`First page startChar(${pages[0].startChar}) != 0`);
      isValid = false;
    }
    
    // Check 2: Sequential ranges (no gaps)
    for (let i = 1; i < pages.length; i++) {
      if (pages[i].startChar !== pages[i-1].endChar) {
        validationIssues.push(`Gap between page ${i-1}(end:${pages[i-1].endChar}) and page ${i}(start:${pages[i].startChar})`);
        isValid = false;
      }
    }
    
    // Check 2.5: Text length invariant (endChar - startChar === text.length)
    for (let i = 0; i < pages.length; i++) {
      const expectedLength = pages[i].endChar - pages[i].startChar;
      const actualLength = pages[i].text.length;
      if (expectedLength !== actualLength) {
        validationIssues.push(`Page ${i} length mismatch: expected ${expectedLength}, got ${actualLength}`);
        isValid = false;
      }
    }
    
    // Check 3: Coverage check - last page should end at expected length
    if (typeof expectedLen === 'number') {
      const lastPage = pages[pages.length - 1];
      if (lastPage.endChar !== expectedLen) {
        validationIssues.push(`Last page endChar(${lastPage.endChar}) != expectedLen(${expectedLen})`);
        isValid = false;
      }
    }
    
    // Report validation results
    if (validationIssues.length > 0) {
      console.warn('[PAGE-MAP] Validation FAILED:');
      validationIssues.forEach(issue => console.warn(`  - ${issue}`));
      
      // Length correction if needed
      if (typeof expectedLen === 'number') {
        const lastPage = pages[pages.length - 1];
        if (cursor !== expectedLen) {
          console.warn('[PAGE-MAP] Adjusting last page endChar to match expected length');
          
          if (cursor > expectedLen) {
            // Need to truncate text to match expected length
            // Ensure needLen is never negative
            const needLen = Math.max(0, expectedLen - lastPage.startChar);
            console.log(`[PAGE-MAP] Clamping endChar from ${lastPage.endChar} to ${expectedLen}, truncating text to ${needLen} chars`);
            lastPage.text = lastPage.text.slice(0, needLen);
            lastPage.endChar = expectedLen;
            cursor = expectedLen;
          } else if (cursor < expectedLen) {
            // Need to pad text to match expected length
            // Ensure needLen is never negative
            const needLen = Math.max(0, expectedLen - lastPage.startChar);
            console.log(`[PAGE-MAP] Extending endChar from ${lastPage.endChar} to ${expectedLen}, padding text to ${needLen} chars`);
            lastPage.text = lastPage.text.padEnd(needLen, ' ');
            lastPage.endChar = expectedLen;
            cursor = expectedLen;
          }
        }
      }
      console.log('[PAGE-MAP] ⚠ Page map was adjusted for consistency');
    } else {
      console.log('[PAGE-MAP] ✓ All validation checks passed');
    }
  }

  // Production validation - always ensure proper coverage
  if (pages.length > 0 && typeof expectedLen === 'number') {
    const lastPage = pages[pages.length - 1];
    const delta = Math.abs(cursor - expectedLen);
    
    if (delta > 0) {
      // Log production warnings for persistent mismatches
      if (process.env.NODE_ENV !== 'development') {
        console.warn(`[PAGE-MAP] Production length mismatch detected and corrected:`, {
          actualLength: cursor,
          expectedLength: expectedLen,
          difference: delta,
          relativeDrift: ((delta / expectedLen) * 100).toFixed(2) + '%'
        });
      }
      
      // Enhanced drift handling - if significant drift, enable enhanced restore mode
      if (delta > 50) { // More than 50 characters drift
        console.warn(`[PAGE-MAP] Significant drift detected (${delta} chars), enabling enhanced restore mode`);
        // This could trigger enhanced anchor searching in goToCharOffset
      }
      
      // Silently adjust in production to prevent position drift
      // Ensure needLen is never negative
      const needLen = Math.max(0, expectedLen - lastPage.startChar);
      if (cursor > expectedLen) {
        // Truncate text
        lastPage.text = lastPage.text.slice(0, needLen);
      } else {
        // Pad text
        lastPage.text = lastPage.text.padEnd(needLen, ' ');
      }
      lastPage.endChar = expectedLen;
      cursor = expectedLen;
    }
  }

  return pages.length > 0 ? pages : [{
    html: html,
    text: normalizePlainText(container.textContent || ''),
    startChar: 0,
    endChar: normalizePlainText(container.textContent || '').length,
  }];
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
