/**
 * Advanced pagination utilities using character index tracking
 * This approach stores the start character index and measures content dynamically
 */

interface PageCache {
  startIndices: number[];
  currentConfigKey: string;
}

/**
 * Generate a configuration key based on current settings
 */
export function getConfigKey(fontSize: number, lineHeight: number, fontFamily: string, containerWidth: number, containerHeight: number): string {
  return `${fontSize}|${lineHeight}|${fontFamily}|${containerWidth}x${containerHeight}`;
}

/**
 * Measure how much text fits in the container starting from a character index
 * @param text Full text content
 * @param startIndex Character index to start measuring from
 * @param container HTMLElement to measure in
 * @returns End index of text that fits
 */
export function measurePage(text: string, startIndex: number, container: HTMLElement): number {
  // Use a windowed approach for performance with large texts
  const WINDOW_SIZE = 20000; // 20k characters window
  const windowText = text.slice(startIndex, Math.min(startIndex + WINDOW_SIZE, text.length));
  
  if (windowText.length === 0) {
    return startIndex;
  }
  
  let low = 0;
  let high = windowText.length;
  let bestFit = 0;
  
  // Binary search to find maximum text that fits
  while (low <= high) {
    const mid = Math.ceil((low + high) / 2);
    const testText = windowText.slice(0, mid);
    
    // Set content and measure
    container.textContent = testText;
    
    // Check if it fits using scrollHeight as described
    if (container.scrollHeight <= container.clientHeight) {
      bestFit = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  // Adjust to word boundary if possible
  let endIndex = startIndex + bestFit;
  
  // Don't break words if we can avoid it (unless we're at the very end)
  if (endIndex < text.length && bestFit > 0) {
    const textSlice = windowText.slice(0, bestFit);
    const lastSpace = textSlice.lastIndexOf(' ');
    
    // If there's a space reasonably close to the end, break there
    if (lastSpace > 0) { // Found a space
      endIndex = startIndex + lastSpace;
    }
  }
  
  return endIndex;
}

/**
 * Paginate content using character indices
 * @param text Full text content
 * @param container HTMLElement to measure in
 * @param startCharIndex Starting character index
 * @returns Array of page start indices
 */
export function paginateByCharIndex(
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
    const nextPageStart = measurePage(text, currentIndex, container);
    
    // If we didn't advance or got stuck, break to prevent infinite loop
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
 * Save page cache to localStorage
 */
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