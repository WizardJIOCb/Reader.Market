/**
 * Text normalization utilities for consistent offset calculation
 */

/**
 * Canonicalize text for offset calculations (no lowercase)
 * Used by both ReaderEngine and ReaderCore for consistent coordinate system
 */
export function canonicalizeForOffsets(text: string): string {
  return (text ?? '')
    .replace(/[\s\u00a0]+/g, ' ') // all whitespace/nbsp -> single space
    .trim();
}

/**
 * Normalize text for search operations (with lowercase)
 * Used for anchor text comparison and searching
 */
export function normalizeForSearch(text: string): string {
  return canonicalizeForOffsets(text).toLowerCase();
}

// Enhanced text extraction that handles complex markup consistently
// This version is designed to match exactly what ReaderEngine does
export function extractStructuredText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get all block-level elements in order
  const blocks = Array.from(tempDiv.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre'));
  
  if (blocks.length === 0) {
    return canonicalizeForOffsets(tempDiv.textContent || '');
  }
  
  const parts: string[] = [];
  for (const el of blocks) {
    const t = canonicalizeForOffsets(el.textContent || '');
    if (t) parts.push(t);
  }
  
  return canonicalizeForOffsets(parts.join(' '));
}