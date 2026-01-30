/**
 * ReaderEngine - Book parsing and content management
 * 
 * Supports: FB2, EPUB, TXT, PDF, with fallback for other formats
 */

import {
  BookContent,
  BookFormat,
  Chapter,
  Position,
  SearchResult,
  BookMetadata,
} from './types';
import * as pdfjsLib from 'pdfjs-dist';
import { canonicalizeForOffsets, extractStructuredText } from './textNormalization';

// Configure PDF.js worker - use CDN for reliable cross-environment support
if (typeof window !== 'undefined') {
  // Use CDN version to avoid MIME type and bundling issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export class ReaderEngine {
  private content: BookContent | null = null;
  private currentPosition: Position | null = null;

  /**
   * Apply canonical text normalization to ensure consistent offset calculations
   * across ReaderEngine and ReaderCore
   */
  private canonicalizeOffsets(content: BookContent): BookContent {
    let offset = 0;

    // Ensure chapter.index always equals array position (invariant guarantee)
    const chapters = content.chapters.map((ch, i) => {
      const plain = canonicalizeForOffsets(ch.plainText ?? '');
      const charCount = plain.length;

      const next = {
        ...ch,
        // Force index to match array position
        index: i,
        plainText: plain,
        charCount,
        startOffset: offset,
        endOffset: offset + charCount,
      };

      offset += charCount;
      return next;
    });

    return { ...content, chapters, totalChars: offset };
  }

  /**
   * Load and parse a book from URL
   */
  async loadBook(url: string, fileType: string): Promise<BookContent> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch book: ${response.status} ${response.statusText}`);
    }

    // Use actual Content-Type from response for better detection (especially for translations)
    const contentType = response.headers.get('content-type') || fileType;
    const format = this.detectFormat(url, contentType);

    let content: BookContent;

    switch (format) {
      case 'fb2':
        const fb2Text = await response.text();
        content = this.parseFB2(fb2Text);
        break;
      case 'txt':
        const txtText = await response.text();
        content = this.parseTXT(txtText);
        break;
      case 'epub':
        const epubBlob = await response.blob();
        content = await this.parseEPUB(epubBlob);
        break;
      case 'pdf':
        const pdfBlob = await response.blob();
        content = await this.parsePDF(pdfBlob);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Apply canonical text normalization for consistent offset calculations
    content = this.canonicalizeOffsets(content);

    this.content = content;
    this.currentPosition = this.createInitialPosition();
    
    return content;
  }

  /**
   * Detect book format from URL and MIME type
   */
  private detectFormat(url: string, mimeType: string): BookFormat {
    const urlLower = url.toLowerCase();
    
    if (urlLower.endsWith('.fb2') || mimeType.includes('fictionbook') || mimeType.includes('application/x-fictionbook')) {
      return 'fb2';
    }
    if (urlLower.endsWith('.epub') || mimeType.includes('epub')) {
      return 'epub';
    }
    if (urlLower.endsWith('.txt') || mimeType.includes('text/plain')) {
      return 'txt';
    }
    if (urlLower.endsWith('.pdf') || mimeType.includes('pdf')) {
      return 'pdf';
    }
    if (urlLower.endsWith('.mobi')) {
      return 'mobi';
    }
    if (urlLower.endsWith('.azw3')) {
      return 'azw3';
    }
    
    return 'unknown';
  }

  /**
   * Parse FB2 (FictionBook) format
   */
  private parseFB2(xmlContent: string): BookContent {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn('XML parsing error, attempting to clean content');
      // Try to clean and re-parse
      const cleanedContent = this.cleanFB2Content(xmlContent);
      return this.parseFB2Fallback(cleanedContent);
    }

    // Extract metadata
    const titleInfo = doc.querySelector('title-info');
    const title = titleInfo?.querySelector('book-title')?.textContent || 'Untitled';
    const author = this.extractFB2Author(titleInfo);
    const description = titleInfo?.querySelector('annotation')?.textContent?.trim() || '';
    const language = titleInfo?.querySelector('lang')?.textContent || undefined;
    const genre = titleInfo?.querySelector('genre')?.textContent || undefined;

    // Extract cover image
    const coverImage = this.extractFB2Cover(doc);

    // Extract chapters from body
    const chapters = this.extractFB2Chapters(doc);

    const totalChars = chapters.reduce((sum, ch) => sum + ch.charCount, 0);

    return {
      title,
      author,
      description,
      coverImage,
      chapters,
      totalChars,
      metadata: {
        format: 'fb2',
        language,
        genre,
      },
    };
  }

  /**
   * Extract author from FB2 title-info
   */
  private extractFB2Author(titleInfo: Element | null): string {
    if (!titleInfo) return 'Unknown Author';
    
    const authorEl = titleInfo.querySelector('author');
    if (!authorEl) return 'Unknown Author';

    const firstName = authorEl.querySelector('first-name')?.textContent || '';
    const middleName = authorEl.querySelector('middle-name')?.textContent || '';
    const lastName = authorEl.querySelector('last-name')?.textContent || '';

    return [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Unknown Author';
  }

  /**
   * Extract cover image from FB2
   */
  private extractFB2Cover(doc: Document): string | undefined {
    // Find coverpage image reference
    const coverpage = doc.querySelector('coverpage image');
    if (!coverpage) return undefined;

    const href = coverpage.getAttribute('l:href') || coverpage.getAttribute('xlink:href');
    if (!href) return undefined;

    const imageId = href.replace('#', '');
    const binary = doc.querySelector(`binary[id="${imageId}"]`);
    if (!binary) return undefined;

    const contentType = binary.getAttribute('content-type') || 'image/jpeg';
    const base64 = binary.textContent?.trim();
    if (!base64) return undefined;

    return `data:${contentType};base64,${base64}`;
  }

  /**
   * Extract chapters from FB2 body
   */
  private extractFB2Chapters(doc: Document): Chapter[] {
    const body = doc.querySelector('body');
    if (!body) {
      return [{
        index: 0,
        title: 'Content',
        content: '<p>Unable to parse book content</p>',
        plainText: 'Unable to parse book content',
        charCount: 0,
        startOffset: 0,
        endOffset: 0,
      }];
    }

    const chapters: Chapter[] = [];
    const sections = body.querySelectorAll(':scope > section');
    
    let currentOffset = 0;

    if (sections.length === 0) {
      // No sections, treat entire body as one chapter
      const { html, text } = this.convertFB2ElementToHTML(body);
      chapters.push({
        index: 0,
        title: 'Content',
        content: html,
        plainText: text,
        charCount: text.length,
        startOffset: 0,
        endOffset: text.length,
      });
    } else {
      sections.forEach((section, index) => {
        const titleEl = section.querySelector(':scope > title');
        const title = titleEl?.textContent?.trim() || `Chapter ${index + 1}`;
        
        // Remove title from section before converting
        if (titleEl) {
          titleEl.remove();
        }

        const { html, text } = this.convertFB2ElementToHTML(section);
        
        chapters.push({
          index,
          title,
          content: html,
          plainText: text,
          charCount: text.length,
          startOffset: currentOffset,
          endOffset: currentOffset + text.length,
        });

        currentOffset += text.length;
      });
    }

    return chapters;
  }

  /**
   * Convert FB2 element to HTML
   */
  private convertFB2ElementToHTML(element: Element): { html: string; text: string } {
    let html = '';
    let text = '';

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent || '';
        text += nodeText;
        html += this.escapeHTML(nodeText);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case 'p':
          html += '<p>';
          el.childNodes.forEach(processNode);
          html += '</p>';
          text += '\n\n';  // Add double newline for paragraph separation
          break;
        case 'empty-line':
          html += '<br/>';
          text += '\n';
          break;
        case 'strong':
          html += '<strong>';
          el.childNodes.forEach(processNode);
          html += '</strong>';
          break;
        case 'emphasis':
          html += '<em>';
          el.childNodes.forEach(processNode);
          html += '</em>';
          break;
        case 'strikethrough':
          html += '<s>';
          el.childNodes.forEach(processNode);
          html += '</s>';
          break;
        case 'subtitle':
          html += '<h3>';
          el.childNodes.forEach(processNode);
          html += '</h3>';
          text += '\n\n';
          break;
        case 'title':
          html += '<h2>';
          el.childNodes.forEach(processNode);
          html += '</h2>';
          text += '\n\n';
          break;
        case 'epigraph':
          html += '<blockquote class="epigraph">';
          el.childNodes.forEach(processNode);
          html += '</blockquote>';
          break;
        case 'cite':
          html += '<blockquote>';
          el.childNodes.forEach(processNode);
          html += '</blockquote>';
          break;
        case 'poem':
        case 'stanza':
          html += '<div class="poem">';
          el.childNodes.forEach(processNode);
          html += '</div>';
          break;
        case 'v': // verse line
          html += '<p class="verse">';
          el.childNodes.forEach(processNode);
          html += '</p>';
          text += '\n';
          break;
        case 'a':
          const href = el.getAttribute('l:href') || el.getAttribute('xlink:href') || '#';
          html += `<a href="${href}">`;
          el.childNodes.forEach(processNode);
          html += '</a>';
          break;
        case 'image':
          // Skip inline images for now
          break;
        case 'section':
          el.childNodes.forEach(processNode);
          break;
        default:
          el.childNodes.forEach(processNode);
      }
    };

    element.childNodes.forEach(processNode);

    return { html, text: text.trim() };
  }

  /**
   * Clean FB2 content for fallback parsing
   */
  private cleanFB2Content(content: string): string {
    // Remove XML declaration and DOCTYPE
    let cleaned = content.replace(/<\?xml[^?]*\?>/gi, '');
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');
    
    // Fix common encoding issues
    cleaned = cleaned.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
    
    return cleaned;
  }

  /**
   * Fallback FB2 parser using regex
   */
  private parseFB2Fallback(content: string): BookContent {
    // Extract title
    const titleMatch = content.match(/<book-title>([\s\S]*?)<\/book-title>/i);
    const title = titleMatch ? this.stripTags(titleMatch[1]).trim() : 'Untitled';

    // Extract author
    const authorMatch = content.match(/<author>([\s\S]*?)<\/author>/i);
    let author = 'Unknown Author';
    if (authorMatch) {
      const firstNameMatch = authorMatch[1].match(/<first-name>(.*?)<\/first-name>/i);
      const lastNameMatch = authorMatch[1].match(/<last-name>(.*?)<\/last-name>/i);
      author = [
        firstNameMatch ? firstNameMatch[1] : '',
        lastNameMatch ? lastNameMatch[1] : ''
      ].filter(Boolean).join(' ') || 'Unknown Author';
    }

    // Extract body content
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : content;

    // Convert to plain text and HTML
    const plainText = this.stripTags(bodyContent)
      .replace(/\s+/g, ' ')
      .trim();

    const html = this.fb2ToHTMLSimple(bodyContent);

    const chapter: Chapter = {
      index: 0,
      title: 'Content',
      content: html,
      plainText,
      charCount: plainText.length,
      startOffset: 0,
      endOffset: plainText.length,
    };

    return {
      title,
      author,
      chapters: [chapter],
      totalChars: plainText.length,
      metadata: {
        format: 'fb2',
      },
    };
  }

  /**
   * Simple FB2 to HTML conversion
   */
  private fb2ToHTMLSimple(content: string): string {
    let html = content;
    
    // Replace FB2 tags with HTML equivalents
    html = html.replace(/<p>/gi, '<p>');
    html = html.replace(/<\/p>/gi, '</p>');
    html = html.replace(/<empty-line\s*\/?>/gi, '<br/>');
    html = html.replace(/<emphasis>/gi, '<em>');
    html = html.replace(/<\/emphasis>/gi, '</em>');
    html = html.replace(/<strong>/gi, '<strong>');
    html = html.replace(/<\/strong>/gi, '</strong>');
    html = html.replace(/<title>/gi, '<h2>');
    html = html.replace(/<\/title>/gi, '</h2>');
    html = html.replace(/<subtitle>/gi, '<h3>');
    html = html.replace(/<\/subtitle>/gi, '</h3>');
    
    // Remove other FB2-specific tags
    html = html.replace(/<section[^>]*>/gi, '<div>');
    html = html.replace(/<\/section>/gi, '</div>');
    html = html.replace(/<[^>]+>/g, (match) => {
      // Keep only allowed HTML tags
      if (/^<\/?(p|br|em|strong|h[1-6]|div|blockquote|a|span|s|u)[^>]*>$/i.test(match)) {
        return match;
      }
      return '';
    });

    return html;
  }

  /**
   * Parse plain text format
   */
  private parseTXT(content: string): BookContent {
    // Split into paragraphs (double newlines)
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    // Try to detect title from first line
    const firstLine = content.trim().split('\n')[0];
    const title = firstLine.length < 100 ? firstLine : 'Untitled';

    // Create HTML content
    const html = paragraphs.map(p => `<p>${this.escapeHTML(p.trim())}</p>`).join('\n');
    const plainText = content;

    const chapter: Chapter = {
      index: 0,
      title: 'Content',
      content: html,
      plainText,
      charCount: plainText.length,
      startOffset: 0,
      endOffset: plainText.length,
    };

    return {
      title,
      author: 'Unknown Author',
      chapters: [chapter],
      totalChars: plainText.length,
      metadata: {
        format: 'txt',
      },
    };
  }

  /**
   * Parse PDF format using PDF.js
   */
  private async parsePDF(blob: Blob): Promise<BookContent> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const numPages = pdf.numPages;
      let allContent = '';
      let allPlainText = '';

      // Extract text and images from all pages continuously
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        
        // Extract text content
        const textContent = await page.getTextContent();
        const textItems = textContent.items as any[];
        
        let pageText = '';
        for (const item of textItems) {
          if ('str' in item && item.str) {
            const text = item.str;
            pageText += text + ' ';
          }
        }
        
        // Extract images from the page
        const operatorList = await page.getOperatorList();
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render the page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          
          // Check if page has images by looking for image operations
          const hasImages = operatorList.fnArray.some((fn: number) => 
            fn === pdfjsLib.OPS.paintImageXObject || 
            fn === pdfjsLib.OPS.paintJpegXObject ||
            fn === pdfjsLib.OPS.paintInlineImageXObject
          );
          
          // If page has images, capture the entire page as image
          if (hasImages) {
            const imageDataUrl = canvas.toDataURL('image/png');
            allContent += `<div class="pdf-page-image" style="margin: 20px auto; text-align: center; display: flex; justify-content: center;">
              <img src="${imageDataUrl}" alt="Page ${pageNum}" style="max-width: 100%; height: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); object-fit: contain;" />
            </div>\n`;
          }
        }
        
        // Add text content
        if (pageText.trim()) {
          // Split into paragraphs by double newlines or significant breaks
          const paragraphs = pageText.split(/\s{3,}/).filter(p => p.trim().length > 20);
          
          if (paragraphs.length > 0) {
            for (const para of paragraphs) {
              const cleanPara = para.trim();
              if (cleanPara) {
                allContent += `<p>${this.escapeHTML(cleanPara)}</p>\n`;
                allPlainText += cleanPara + '\n\n';
              }
            }
          } else {
            // If no clear paragraphs, just add as one block
            const cleanText = pageText.trim();
            if (cleanText) {
              allContent += `<p>${this.escapeHTML(cleanText)}</p>\n`;
              allPlainText += cleanText + '\n\n';
            }
          }
        }
      }

      // Get metadata
      const metadata = await pdf.getMetadata();
      const info = metadata.info as any;
      
      const title = info?.Title || 'Untitled PDF';
      const author = info?.Author || 'Unknown Author';
      const description = info?.Subject || undefined;

      // Create one continuous chapter with all content
      const chapters: Chapter[] = [{
        index: 0,
        title: title,
        content: allContent || '<p>No text content found in PDF</p>',
        plainText: allPlainText.trim(),
        charCount: allPlainText.length,
        startOffset: 0,
        endOffset: allPlainText.length,
      }];

      return {
        title,
        author,
        description,
        chapters,
        totalChars: allPlainText.length,
        metadata: {
          format: 'pdf',
          pageCount: numPages,
        },
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse EPUB format
   * Note: Requires epub.js library for full support
   */
  private async parseEPUB(blob: Blob): Promise<BookContent> {
    // Basic EPUB parsing using JSZip
    // For full EPUB support, consider using epub.js
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(blob);
      
      // Find container.xml
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('Invalid EPUB: missing container.xml');
      }
      
      const containerXml = await containerFile.async('string');
      const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
      
      // Get OPF file path
      const rootfileEl = containerDoc.querySelector('rootfile');
      const opfPath = rootfileEl?.getAttribute('full-path');
      if (!opfPath) {
        throw new Error('Invalid EPUB: missing OPF path');
      }

      // Read OPF file
      const opfFile = zip.file(opfPath);
      if (!opfFile) {
        throw new Error('Invalid EPUB: missing OPF file');
      }
      
      const opfXml = await opfFile.async('string');
      const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');
      
      // Extract metadata
      const title = opfDoc.querySelector('title')?.textContent || 'Untitled';
      const author = opfDoc.querySelector('creator')?.textContent || 'Unknown Author';
      const language = opfDoc.querySelector('language')?.textContent || undefined;
      const description = opfDoc.querySelector('description')?.textContent || undefined;

      // Get spine items (reading order)
      const spine = opfDoc.querySelectorAll('spine itemref');
      const manifest = opfDoc.querySelectorAll('manifest item');
      
      // Create manifest map
      const manifestMap = new Map<string, { href: string; mediaType: string }>();
      manifest.forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        if (id && href) {
          manifestMap.set(id, { href, mediaType: mediaType || '' });
        }
      });

      // Get base directory of OPF
      const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

      // Read content files in spine order
      const chapters: Chapter[] = [];
      let currentOffset = 0;
      let chapterIdx = 0; // Dense sequential index

      for (let i = 0; i < spine.length; i++) {
        const itemRef = spine[i];
        const idref = itemRef.getAttribute('idref');
        if (!idref) continue;

        const manifestItem = manifestMap.get(idref);
        if (!manifestItem || !manifestItem.mediaType.includes('html')) continue;

        const contentPath = opfDir + manifestItem.href;
        const contentFile = zip.file(contentPath);
        if (!contentFile) continue;

        const htmlContent = await contentFile.async('string');
        // Pass chapterIdx instead of spine index i
        const { title: chapterTitle, html, text } = this.parseEPUBChapter(htmlContent, chapterIdx);

        chapters.push({
          // Use dense sequential index
          index: chapterIdx,
          title: chapterTitle,
          content: html,
          plainText: text,
          charCount: text.length,
          startOffset: currentOffset,
          endOffset: currentOffset + text.length,
        });

        currentOffset += text.length;
        chapterIdx++; // Increment dense index
      }

      if (chapters.length === 0) {
        throw new Error('No readable content found in EPUB');
      }

      const totalChars = chapters.reduce((sum, ch) => sum + ch.charCount, 0);

      return {
        title,
        author,
        description,
        chapters,
        totalChars,
        metadata: {
          format: 'epub',
          language,
        },
      };
    } catch (error) {
      console.error('EPUB parsing error:', error);
      throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a single EPUB chapter
   */
  private parseEPUBChapter(htmlContent: string, index: number): { title: string; html: string; text: string } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Try to find title
    const titleEl = doc.querySelector('h1, h2, title');
    const title = titleEl?.textContent?.trim() || `Chapter ${index + 1}`;

    // Get body content
    const body = doc.body;
    let html = body?.innerHTML || '';

    // IMPORTANT: Clean HTML first
    html = this.cleanEPUBHTML(html);
    
    // IMPORTANT: Extract text FROM the cleaned HTML (same as ReaderCore does)
    let text = '';
    if (typeof document !== 'undefined') {
      text = extractStructuredText(html); // already canonicalizes internally
    } else {
      // fallback for environments without DOM
      text = canonicalizeForOffsets(this.stripTags(html));
    }

    return { title, html, text };
  }

  /**
   * Clean EPUB HTML
   */
  private cleanEPUBHTML(html: string): string {
    // Remove script tags
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove style tags (keep inline styles)
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    // Clean up whitespace
    html = html.replace(/\s+/g, ' ');
    
    return html.trim();
  }

  /**
   * Get current book content
   */
  getContent(): BookContent | null {
    return this.content;
  }

  /**
   * Get chapter by index
   */
  getChapter(index: number): Chapter | null {
    if (!this.content || index < 0 || index >= this.content.chapters.length) {
      return null;
    }
    return this.content.chapters[index];
  }

  /**
   * Get total number of chapters
   */
  getTotalChapters(): number {
    return this.content?.chapters.length || 0;
  }

  /**
   * Get current position
   */
  getPosition(): Position | null {
    return this.currentPosition;
  }

  /**
   * Set current position
   */
  setPosition(position: Position): void {
    this.currentPosition = position;
  }

  /**
   * Create initial position
   */
  private createInitialPosition(): Position {
    return {
      charOffset: 0,
      chapterIndex: 0,
      pageInChapter: 0,
      totalPagesInChapter: 1,
      percentage: 0,
    };
  }

  /**
   * Calculate position from character offset
   */
  calculatePosition(charOffset: number): Position | null {
    if (!this.content) return null;

    let currentOffset = 0;
    for (let i = 0; i < this.content.chapters.length; i++) {
      const chapter = this.content.chapters[i];
      if (charOffset < currentOffset + chapter.charCount) {
        const percentage = (charOffset / this.content.totalChars) * 100;
        return {
          charOffset,
          chapterIndex: i,
          pageInChapter: 0, // Will be calculated by UI
          totalPagesInChapter: 1,
          percentage,
        };
      }
      currentOffset += chapter.charCount;
    }

    // At the end
    return {
      charOffset: this.content.totalChars,
      chapterIndex: this.content.chapters.length - 1,
      pageInChapter: 0,
      totalPagesInChapter: 1,
      percentage: 100,
    };
  }

  /**
   * Search text in book
   */
  searchText(query: string, maxResults: number = 50): SearchResult[] {
    if (!this.content || !query.trim()) return [];

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const contextLength = 50;

    for (const chapter of this.content.chapters) {
      const textLower = chapter.plainText.toLowerCase();
      let startIndex = 0;

      while (startIndex < textLower.length && results.length < maxResults) {
        const matchIndex = textLower.indexOf(queryLower, startIndex);
        if (matchIndex === -1) break;

        const contextStart = Math.max(0, matchIndex - contextLength);
        const contextEnd = Math.min(chapter.plainText.length, matchIndex + query.length + contextLength);
        const context = chapter.plainText.substring(contextStart, contextEnd);
        const matchedText = chapter.plainText.substring(matchIndex, matchIndex + query.length);

        const charOffset = chapter.startOffset + matchIndex;
        const position = this.calculatePosition(charOffset);

        if (position) {
          results.push({
            chapterIndex: chapter.index,
            charOffset: matchIndex,
            matchedText,
            context: (contextStart > 0 ? '...' : '') + context + (contextEnd < chapter.plainText.length ? '...' : ''),
            position,
          });
        }

        startIndex = matchIndex + 1;
      }
    }

    return results;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Strip HTML tags
   */
  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Destroy engine and free resources
   */
  destroy(): void {
    this.content = null;
    this.currentPosition = null;
  }
}

// Export singleton factory
let engineInstance: ReaderEngine | null = null;

export function getReaderEngine(): ReaderEngine {
  if (!engineInstance) {
    engineInstance = new ReaderEngine();
  }
  return engineInstance;
}

export function createReaderEngine(): ReaderEngine {
  return new ReaderEngine();
}
