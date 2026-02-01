/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (!text) return text;
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitizes user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;
  
  // First escape HTML characters
  let sanitized = escapeHtml(input);
  
  // Then remove any potentially dangerous patterns
  sanitized = sanitized.replace(/<(script|object|embed|iframe|frame|frameset|meta|link|style)(\s[^>]*)?>/gi, '&lt;$1$2&gt;');
  sanitized = sanitized.replace(/<\/(script|object|embed|iframe|frame|frameset|meta|link|style)>/gi, '&lt;/$1&gt;');
  
  return sanitized;
}

/**
 * Sanitizes comment content specifically
 */
export function sanitizeCommentContent(content: string): string {
  if (!content) return content;
  
  // First sanitize the content
  let sanitized = sanitizeInput(content);
  
  // Additional checks for comment-specific patterns
  // Remove any remaining script-like content
  sanitized = sanitized.replace(/<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

/**
 * Sanitizes user-generated content while preserving basic formatting
 */
export function sanitizeUserContent(content: string): string {
  if (!content) return content;
  
  // First escape HTML characters
  let sanitized = escapeHtml(content);
  
  // Then allow some basic formatting tags but still remove dangerous content
  sanitized = sanitized.replace(/<(script|object|embed|iframe|frame|frameset|meta|link|style)(\s[^>]*)?>/gi, '&lt;$1$2&gt;');
  sanitized = sanitized.replace(/<\/(script|object|embed|iframe|frame|frameset|meta|link|style)>/gi, '&lt;/$1&gt;');
  
  // Remove javascript and other dangerous protocols in href attributes
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/href\s*=\s*["']vbscript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');
  
  return sanitized;
}