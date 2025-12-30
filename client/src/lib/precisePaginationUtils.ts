/**
 * Precise pagination utilities that follow the exact measurement technique
 * described for optimal text fitting in reading applications
 */

/**
 * Measure exactly how much text fits in a container with fixed dimensions
 * @param text Full text content
 * @param startIndex Character index to start measuring from
 * @param container HTMLElement with fixed dimensions and overflow: hidden
 * @returns End index of text that fits exactly
 */
export function measurePagePrecisely(text: string, startIndex: number, container: HTMLElement): number {
  // Use a reasonable window size for binary search
  const WINDOW_SIZE = 20000; // 20k characters should be enough for most pages
  const windowText = text.slice(startIndex, Math.min(startIndex + WINDOW_SIZE, text.length));
  
  if (windowText.length === 0) {
    return startIndex;
  }
  
  let low = 0;
  let high = windowText.length;
  let bestFit = 0;
  
  // Binary search to find the maximum text that fits
  while (low <= high) {
    const mid = Math.ceil((low + high) / 2);
    const testText = windowText.slice(0, mid);
    
    // Set content and measure
    container.textContent = testText;
    
    // Check if it fits using scrollHeight as the definitive measure
    if (container.scrollHeight <= container.clientHeight) {
      bestFit = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  // Adjust to word boundary if possible
  let endIndex = startIndex + bestFit;
  
  // Don't break words if we can avoid it
  if (endIndex < text.length && bestFit > 0) {
    const textSlice = windowText.slice(0, bestFit);
    const lastSpace = textSlice.lastIndexOf(' ');
    
    // If there's a space, break there instead
    if (lastSpace > 0) {
      endIndex = startIndex + lastSpace;
    }
  }
  
  return endIndex;
}

/**
 * Paginate content using precise measurement technique
 * @param text Full text content
 * @param container HTMLElement with fixed dimensions matching display area
 * @param startCharIndex Starting character index
 * @returns Array of page start indices
 */
export function paginatePrecisely(
  text: string, 
  container: HTMLElement, 
  startCharIndex: number = 0
): number[] {
  const pageStarts: number[] = [startCharIndex];
  let currentIndex = startCharIndex;
  
  // Limit iterations to prevent infinite loops
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000;
  
  while (currentIndex < text.length && iterationCount < MAX_ITERATIONS) {
    const nextPageStart = measurePagePrecisely(text, currentIndex, container);
    
    // If we didn't advance, break to prevent infinite loop
    if (nextPageStart <= currentIndex) {
      // Force advance by at least one character to prevent stuck loop
      currentIndex = Math.min(currentIndex + 1, text.length);
    } else {
      currentIndex = nextPageStart;
    }
    
    // Only add if we have more content
    if (currentIndex < text.length) {
      pageStarts.push(currentIndex);
    }
    
    iterationCount++;
  }
  
  return pageStarts;
}

/**
 * Get text content for a specific page
 * @param text Full text content
 * @param startIndex Start character index of page
 * @param endIndex End character index of page
 * @returns Text content for the page
 */
export function getPageContent(text: string, startIndex: number, endIndex: number): string {
  return text.slice(startIndex, endIndex);
}

/**
 * Generate a configuration key based on current settings
 */
export function getConfigKey(fontSize: number, lineHeight: number, fontFamily: string, containerWidth: number, containerHeight: number): string {
  return `${fontSize}|${lineHeight}|${fontFamily}|${containerWidth}x${containerHeight}`;
}

/**
 * Save page cache to localStorage
 */
export interface PageCache {
  startIndices: number[];
  currentConfigKey: string;
}

export function savePageCache(bookId: string, chapterId: string, cache: PageCache): void {
  try {
    localStorage.setItem(`pageCache_${bookId}_${chapterId}`, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save page cache:', e);
  }
}

/**
 * Load page cache from localStorage
 */
export function loadPageCache(bookId: string, chapterId: string): PageCache | null {
  try {
    const cached = localStorage.getItem(`pageCache_${bookId}_${chapterId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.warn('Failed to load page cache:', e);
    return null;
  }
}

/**
 * Clear page cache
 */
export function clearPageCache(bookId: string, chapterId: string): void {
  try {
    localStorage.removeItem(`pageCache_${bookId}_${chapterId}`);
  } catch (e) {
    console.warn('Failed to clear page cache:', e);
  }
}

/**
 * Save character position to localStorage
 */
export function saveCharPosition(bookId: string, chapterId: string, charIndex: number): void {
  try {
    localStorage.setItem(`charPosition_${bookId}_${chapterId}`, charIndex.toString());
  } catch (e) {
    console.warn('Failed to save character position:', e);
  }
}

/**
 * Load character position from localStorage
 */
export function loadCharPosition(bookId: string, chapterId: string): number | null {
  try {
    const saved = localStorage.getItem(`charPosition_${bookId}_${chapterId}`);
    return saved ? parseInt(saved, 10) : null;
  } catch (e) {
    console.warn('Failed to load character position:', e);
    return null;
  }
}