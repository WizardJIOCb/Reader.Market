/**
 * Application Configuration
 * Provides environment-aware base URLs for API calls and file access
 */

/**
 * API Base URL
 * - Development: http://localhost:5001 (backend runs on separate port)
 * - Production: empty string (same origin, nginx proxies all requests)
 */
export const API_BASE_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:5001' 
  : '';

/**
 * Helper function to construct full URL for file access
 * @param path - Relative path (e.g., /uploads/file.jpg)
 * @returns Full URL for file access
 */
export function getFileUrl(path: string): string {
  // If already an absolute URL or blob URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  
  // For relative paths, prepend base URL
  return `${API_BASE_URL}${path}`;
}

/**
 * Helper function to construct full URL for API calls
 * @param endpoint - API endpoint (e.g., /api/books)
 * @returns Full URL for API call
 */
export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}
