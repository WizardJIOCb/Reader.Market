/**
 * Exact pagination utilities that follow the precise measurement technique
 * described for optimal text fitting in reading applications
 */

/**
 * Measure exactly how much text fits in a container with fixed dimensions
 * Following the exact algorithm:
 * 1. Render text in container with fixed height (viewport height minus UI) and overflow: hidden
 * 2. Take a large chunk of text starting from start index
 * 3. Insert into container
 * 4. Use binary search to find maximum length where container.scrollHeight <= container.clientHeight
 * 5. Return end = start + len as page boundary
 * 
 * @param text Full text content
 * @param startIndex Character index to start measuring from
 * @param container HTMLElement with fixed dimensions and overflow: hidden
 * @returns End index of text that fits exactly
 */
export async function measurePageExactly(text: string, startIndex: number, container: HTMLElement): Promise<number> {
  // Use a reasonable window size for binary search - large enough for most pages
  const WINDOW_SIZE = 100000; // 100k characters to ensure we have enough text for large pages
  const windowText = text.slice(startIndex, Math.min(startIndex + WINDOW_SIZE, text.length));
  
  // If no text, return start index
  if (windowText.length === 0) {
    return startIndex;
  }
  
  let low = 0;
  let high = windowText.length;
  let bestFit = 0;
  
  // Binary search to find the maximum text that fits exactly
  while (low <= high) {
    const mid = Math.ceil((low + high) / 2);
    const testText = windowText.slice(0, mid);
    
    // Set content and measure - this is the key step
    // Clear previous content and set new content
    container.innerHTML = '';
    container.innerHTML = testText;
    
    // Force a reflow to ensure accurate measurement
    container.offsetHeight;
    
    // Wait for fonts to load if document.fonts is available
    if (document.fonts) {
      try {
        // Small delay to allow fonts to load
        await document.fonts.ready;
      } catch (e) {
        // Ignore font loading errors
      }
    }
    
    // Additional delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // The definitive test: container.scrollHeight <= container.clientHeight
    // This measures the actual rendered content height vs container height
    if (container.scrollHeight <= container.clientHeight) {
      bestFit = mid;
      low = mid + 1; // Try to fit more
    } else {
      high = mid - 1; // Too much, reduce
    }
  }
  
  // Calculate the end index in the original text
  const endIndex = startIndex + bestFit;
  
  // Adjust to word boundary if possible to avoid cutting words in the middle
  if (endIndex < text.length && bestFit > 0) {
    const textSlice = windowText.slice(0, bestFit);
    // Look for the last space to break at word boundary
    const lastSpace = textSlice.lastIndexOf(' ');
    
    // If we found a space and it's not too close to the beginning, break there
    if (lastSpace > 10) { // At least 10 chars into the text
      return startIndex + lastSpace;
    }
  }
  
  // Ensure we don't return the same index as start (prevent infinite loops)
  if (endIndex <= startIndex && text.length > startIndex) {
    return Math.min(startIndex + 1, text.length);
  }
  
  return endIndex;
}

/**
 * Paginate content using the exact measurement technique
 * @param text Full text content
 * @param container HTMLElement with fixed dimensions matching display area exactly
 * @param startCharIndex Starting character index (default: 0)
 * @returns Array of page start indices
 */
export async function paginateExactly(
  text: string, 
  container: HTMLElement, 
  startCharIndex: number = 0
): Promise<number[]> {
  // Initialize with the first page start
  const pageStarts: number[] = [startCharIndex];
  let currentIndex = startCharIndex;
  
  // Limit iterations to prevent infinite loops
  let iterationCount = 0;
  const MAX_ITERATIONS = 100; // Limit for initial pagination
  
  // Continue until we've processed all text or hit iteration limit
  while (currentIndex < text.length && iterationCount < MAX_ITERATIONS) {
    // Measure exactly how much text fits starting from current position
    const nextPageStart = await measurePageExactly(text, currentIndex, container);
    
    // Safety check to prevent infinite loops
    if (nextPageStart <= currentIndex) {
      // Force advance by at least one character
      currentIndex = Math.min(currentIndex + 1, text.length);
    } else {
      // Advance to the next page start
      currentIndex = nextPageStart;
    }
    
    // Add the next page start if we have more content
    if (currentIndex < text.length) {
      // Avoid duplicate entries
      if (pageStarts[pageStarts.length - 1] !== currentIndex) {
        pageStarts.push(currentIndex);
      }
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