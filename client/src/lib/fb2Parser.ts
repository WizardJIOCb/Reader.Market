/**
 * Utility functions for parsing FB2 (FictionBook 2) files
 */

interface FB2Chapter {
  id: number;
  title: string;
  content: string;
}

interface FB2Metadata {
  title: string;
  author: string;
  description?: string;
  genre?: string;
  lang?: string;
  date?: string;
}

export interface FB2ParsedData {
  metadata: FB2Metadata;
  chapters: FB2Chapter[];
}

/**
 * Parse an FB2 file content and extract chapters
 * @param fb2Content The raw XML content of the FB2 file
 * @returns Parsed data with metadata and chapters
 */
export function parseFB2(fb2Content: string): FB2ParsedData {
  // Create a DOM parser to parse the XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(fb2Content, 'text/xml');
  
  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse FB2 file: ' + parserError.textContent);
  }
  
  // Extract metadata
  const metadata: FB2Metadata = {
    title: '',
    author: ''
  };
  
  // Get title
  const titleInfo = doc.querySelector('title-info');
  if (titleInfo) {
    const titleElement = titleInfo.querySelector('book-title');
    metadata.title = titleElement ? titleElement.textContent || '' : '';
    
    // Get author
    const authorElement = titleInfo.querySelector('author');
    if (authorElement) {
      const firstName = authorElement.querySelector('first-name')?.textContent || '';
      const lastName = authorElement.querySelector('last-name')?.textContent || '';
      metadata.author = `${firstName} ${lastName}`.trim();
    }
    
    // Get description
    const annotation = titleInfo.querySelector('annotation');
    if (annotation) {
      metadata.description = annotation.textContent?.trim() || '';
    }
    
    // Get genre
    const genre = titleInfo.querySelector('genre');
    if (genre) {
      metadata.genre = genre.textContent || '';
    }
    
    // Get language
    const lang = titleInfo.querySelector('lang');
    if (lang) {
      metadata.lang = lang.textContent || '';
    }
    
    // Get date
    const date = titleInfo.querySelector('date');
    if (date) {
      metadata.date = date.getAttribute('value') || date.textContent || '';
    }
  }
  
  // Extract chapters from body sections
  const chapters: FB2Chapter[] = [];
  const body = doc.querySelector('body');
  
  if (body) {
    // Get all sections (chapters)
    const sections = body.querySelectorAll('section');
    
    sections.forEach((section, index) => {
      // Get chapter title
      let title = `Chapter ${index + 1}`;
      const titleElement = section.querySelector('title');
      if (titleElement) {
        const titleParagraphs = titleElement.querySelectorAll('p');
        if (titleParagraphs.length > 0) {
          title = Array.from(titleParagraphs)
            .map(p => p.textContent?.trim() || '')
            .filter(text => text.length > 0)
            .join(' - ') || title;
        }
      }
      
      // Get chapter content
      let content = '';
      const contentElements = Array.from(section.children);
      
      contentElements.forEach(element => {
        // Skip title elements as we've already extracted the title
        if (element.tagName.toLowerCase() === 'title') {
          return;
        }
        
        // Process paragraphs
        if (element.tagName.toLowerCase() === 'p') {
          content += `<p>${element.innerHTML || element.textContent || ''}</p>`;
        }
        // Process epigraphs
        else if (element.tagName.toLowerCase() === 'epigraph') {
          content += `<div class="epigraph">${element.innerHTML || element.textContent || ''}</div>`;
        }
        // Process poems
        else if (element.tagName.toLowerCase() === 'poem') {
          content += `<div class="poem">${element.innerHTML || element.textContent || ''}</div>`;
        }
        // Process citations
        else if (element.tagName.toLowerCase() === 'cite') {
          content += `<blockquote class="citation">${element.innerHTML || element.textContent || ''}</blockquote>`;
        }
        // Process empty lines
        else if (element.tagName.toLowerCase() === 'empty-line') {
          content += '<br/>';
        }
      });
      
      chapters.push({
        id: index + 1,
        title,
        content
      });
    });
  }
  
  // If no chapters found, try to extract content from the whole body
  if (chapters.length === 0 && body) {
    let content = '';
    const bodyChildren = Array.from(body.children);
    
    bodyChildren.forEach(element => {
      // Skip title and description elements
      if (element.tagName.toLowerCase() === 'title' || element.tagName.toLowerCase() === 'description') {
        return;
      }
      
      // Process paragraphs
      if (element.tagName.toLowerCase() === 'p') {
        content += `<p>${element.innerHTML || element.textContent || ''}</p>`;
      }
      // Process sections
      else if (element.tagName.toLowerCase() === 'section') {
        const sectionContent = Array.from(element.children).map(child => {
          if (child.tagName.toLowerCase() === 'p') {
            return `<p>${child.innerHTML || child.textContent || ''}</p>`;
          }
          return '';
        }).join('');
        content += sectionContent;
      }
    });
    
    chapters.push({
      id: 1,
      title: metadata.title || 'Main Content',
      content
    });
  }
  
  return {
    metadata,
    chapters
  };
}

/**
 * Load and parse an FB2 file from a URL
 * @param url The URL to the FB2 file
 * @returns Promise resolving to parsed FB2 data
 */
export async function loadFB2File(url: string): Promise<FB2ParsedData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load FB2 file: ${response.status} ${response.statusText}`);
    }
    
    const fb2Content = await response.text();
    return parseFB2(fb2Content);
  } catch (error) {
    console.error('Error loading FB2 file:', error);
    throw error;
  }
}