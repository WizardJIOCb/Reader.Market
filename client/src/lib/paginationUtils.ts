/**
 * Utility functions for paginating book content
 */

/**
 * Split HTML content into pages that fit within the viewport height
 * @param content HTML content to paginate
 * @param maxHeight Maximum height for each page (in pixels)
 * @returns Array of paginated content segments
 */
export function paginateContent(content: string, maxHeight: number = window.innerHeight * 0.6): string[] {
  // Create a temporary element to measure content
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.top = '-9999px';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '600px'; // Typical reading width
  tempDiv.style.fontSize = '18px'; // Default font size
  tempDiv.style.lineHeight = '1.6'; // Default line height
  tempDiv.style.fontFamily = 'Georgia, serif'; // Typical reading font
  tempDiv.style.padding = '20px';
  tempDiv.style.boxSizing = 'border-box';
  tempDiv.style.overflow = 'hidden'; // Prevent scrolling
  document.body.appendChild(tempDiv);
  
  try {
    // Parse the HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const body = doc.body;
    
    const pages: string[] = [];
    let currentPageContent = '';
    
    // Process each child element
    const children = Array.from(body.children);
    
    for (const child of children) {
      // Clone the element to avoid modifying the original
      const clonedChild = child.cloneNode(true) as HTMLElement;
      
      // Test if element fits on current page
      const testContent = currentPageContent + clonedChild.outerHTML;
      tempDiv.innerHTML = testContent;
      
      if (tempDiv.scrollHeight <= maxHeight) {
        // Element fits, add to current page
        currentPageContent = testContent;
      } else {
        // Element doesn't fit, save current page and start new one
        if (currentPageContent) {
          pages.push(currentPageContent);
          currentPageContent = '';
        }
        
        // Test if the element itself fits on a new page
        tempDiv.innerHTML = clonedChild.outerHTML;
        if (tempDiv.scrollHeight <= maxHeight) {
          // Element fits on new page
          currentPageContent = clonedChild.outerHTML;
        } else {
          // Element is too large, we need to split it
          const splitPages = _splitLargeElement(clonedChild, maxHeight, tempDiv);
          
          // Add all split pages
          pages.push(...splitPages);
        }
      }
    }
    
    // Add the last page if it has content
    if (currentPageContent) {
      pages.push(currentPageContent);
    }
    
    return pages;
  } catch (error) {
    console.error('Error paginating content:', error);
    // Fallback: split by paragraphs if HTML parsing fails
    const paragraphs = content.split('</p>');
    const pages: string[] = [];
    let currentPage = '';
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        const fullParagraph = paragraph + '</p>';
        if ((currentPage + fullParagraph).length > 2000) { // Rough estimate
          pages.push(currentPage);
          currentPage = fullParagraph;
        } else {
          currentPage += fullParagraph;
        }
      }
    }
    
    if (currentPage) {
      pages.push(currentPage);
    }
    
    return pages;
  } finally {
    // Clean up
    if (tempDiv.parentNode) {
      document.body.removeChild(tempDiv);
    }
  }
}

/**
 * Add element to pages, handling page breaks
 * @param pages Array of pages to add to
 * @param element HTML element to add
 * @param maxHeight Maximum height for each page
 * @param tempDiv Temporary div for measurements
 */
function _splitLargeElement(element: HTMLElement, maxHeight: number, tempDiv: HTMLDivElement): string[] {
  const pages: string[] = [];
  
  // Get the text content
  const textContent = element.textContent || element.innerText || '';
  
  // If no text content, just return the element
  if (!textContent) {
    pages.push(element.outerHTML);
    return pages;
  }
  
  // Clone the element structure without text
  const elementClone = element.cloneNode(false) as HTMLElement; // Clone without children
  
  // Copy attributes
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    elementClone.setAttribute(attr.name, attr.value);
  }
  
  // Split text into chunks that fit
  let currentIndex = 0;
  
  while (currentIndex < textContent.length) {
    // Binary search to find the maximum text that fits
    let low = currentIndex;
    let high = textContent.length;
    let bestFitIndex = currentIndex;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testText = textContent.substring(currentIndex, mid);
      
      // Skip if empty
      if (!testText.trim()) {
        low = mid + 1;
        continue;
      }
      
      // Create test element
      const testElement = elementClone.cloneNode(false) as HTMLElement;
      testElement.textContent = testText;
      
      // Measure
      tempDiv.innerHTML = '';
      tempDiv.appendChild(testElement);
      
      if (tempDiv.scrollHeight <= maxHeight) {
        bestFitIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    // If we couldn't fit even one character, force at least one
    if (bestFitIndex === currentIndex) {
      bestFitIndex = Math.min(currentIndex + 1, textContent.length);
    }
    
    // If we've reached the end, break
    if (bestFitIndex >= textContent.length) {
      bestFitIndex = textContent.length;
    }
    
    // Add the fitted text as a page
    const fittedText = textContent.substring(currentIndex, bestFitIndex);
    if (fittedText.trim()) {
      const pageElement = elementClone.cloneNode(false) as HTMLElement;
      pageElement.textContent = fittedText;
      pages.push(pageElement.outerHTML);
    }
    
    // Move to next chunk
    currentIndex = bestFitIndex;
    
    // If we've reached the end, break
    if (currentIndex >= textContent.length) {
      break;
    }
  }
  
  return pages;
}

/**
 * Split a large element across multiple pages
 * @param pages Array of pages to add to
 * @param element HTML element to split
 * @param maxHeight Maximum height for each page
 * @param tempDiv Temporary div for measurements
 */
function _splitLargeElementToPages(pages: string[], element: HTMLElement, maxHeight: number, tempDiv: HTMLDivElement): void {
  // Get text content
  const textContent = element.textContent || element.innerText || '';
  
  // If no text content, just add the element
  if (!textContent) {
    pages.push(element.outerHTML);
    return;
  }
  
  // Create base element structure without text
  const baseElement = element.cloneNode(true) as HTMLElement;
  baseElement.textContent = '';
  
  // Binary search to find optimal text split
  let start = 0;
  let end = textContent.length;
  
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    const testText = textContent.substring(0, mid);
    
    // Create test element
    const testElement = baseElement.cloneNode(true) as HTMLElement;
    testElement.textContent = testText;
    
    // Measure
    tempDiv.innerHTML = '';
    tempDiv.appendChild(testElement);
    
    if (tempDiv.scrollHeight <= maxHeight) {
      start = mid + 1;
    } else {
      end = mid;
    }
  }
  
  // Add the fitted portion to current page
  const fittedText = textContent.substring(0, start - 1);
  const remainingText = textContent.substring(start - 1);
  
  // Add fitted portion to current page
  if (fittedText.trim()) {
    const fittedElement = baseElement.cloneNode(true) as HTMLElement;
    fittedElement.textContent = fittedText;
    pages.push(fittedElement.outerHTML);
  }
  
  // Recursively handle remaining text if significant
  if (remainingText.trim().length > 50) {
    const remainingElement = baseElement.cloneNode(true) as HTMLElement;
    remainingElement.textContent = remainingText;
    _splitLargeElementToPages(pages, remainingElement, maxHeight, tempDiv);
  } else if (remainingText.trim()) {
    const remainingElement = baseElement.cloneNode(true) as HTMLElement;
    remainingElement.textContent = remainingText;
    pages.push(remainingElement.outerHTML);
  }
}

/**
 * Get the reading position identifier for the current page
 * @param content HTML content of the page
 * @returns Position identifier (first few characters of the content)
 */
export function getPagePositionIdentifier(content: string): string {
  // Extract text content and get first few characters
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  // Remove extra whitespace and get first 20 characters
  const cleanText = textContent.replace(/\s+/g, ' ').trim();
  return cleanText.substring(0, 20);
}

/**
 * Find the page index for a given position identifier
 * @param pages Array of paginated content
 * @param positionIdentifier Position identifier to find
 * @returns Page index or -1 if not found
 */
export function findPageByPosition(pages: string[], positionIdentifier: string): number {
  for (let i = 0; i < pages.length; i++) {
    const pagePosition = getPagePositionIdentifier(pages[i]);
    if (pagePosition.startsWith(positionIdentifier)) {
      return i;
    }
  }
  return -1;
}