import path from 'path';

/**
 * Validates that a given file path is within allowed directories
 * Prevents directory traversal attacks (e.g., ../../../../etc/passwd)
 */
export function isPathTraversalSafe(filePath: string, allowedBasePaths: string[]): boolean {
  try {
    // Normalize the path to resolve .. and . components
    const normalizedPath = path.normalize(filePath);
    
    // Check if the normalized path starts with any of the allowed base paths
    return allowedBasePaths.some(allowedPath => {
      const normalizedAllowedPath = path.normalize(allowedPath);
      return normalizedPath.startsWith(normalizedAllowedPath);
    });
  } catch (error) {
    console.error('Path validation error:', error);
    return false;
  }
}

/**
 * Creates a secure file path that prevents directory traversal
 */
export function createSecurePath(baseDir: string, relativePath: string): string {
  // Sanitize the relative path to remove dangerous components
  const sanitizedRelativePath = sanitizePath(relativePath);
  
  // Join the base directory with the sanitized relative path
  const joinedPath = path.join(baseDir, sanitizedRelativePath);
  
  // Normalize the resulting path
  const normalizedPath = path.normalize(joinedPath);
  
  // Verify that the final path is within the base directory
  const normalizedBaseDir = path.normalize(baseDir);
  if (!normalizedPath.startsWith(normalizedBaseDir)) {
    throw new Error('Path traversal detected: resulting path is outside the allowed directory');
  }
  
  return normalizedPath;
}

/**
 * Sanitizes a path string to remove potentially dangerous components
 */
export function sanitizePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  // Remove null bytes and other control characters
  let cleanPath = inputPath.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Remove any .. sequences that might be used for traversal
  cleanPath = cleanPath.replace(/\.{2}[/\\]/g, '');
  
  // Remove leading ../ or ..\ sequences
  cleanPath = cleanPath.replace(/^(\.\.[\/\\])+/, '');
  
  // Replace any remaining .. sequences with a safe placeholder
  cleanPath = cleanPath.replace(/\.{2}/g, '_DOT_DOT_');
  
  // Get the final path component (filename) to ensure it's safe
  const finalComponent = path.basename(cleanPath);
  if (finalComponent === '..' || finalComponent === '.') {
    throw new Error('Invalid path component: cannot use . or .. as a filename');
  }
  
  return cleanPath;
}

/**
 * Validates that a path is safe for file operations
 */
export function validateFilePath(filePath: string, allowedDirectories: string[]): { isValid: boolean; sanitizedPath?: string; error?: string } {
  try {
    // Sanitize the path first
    const sanitizedPath = sanitizePath(filePath);
    
    // Check if the sanitized path is within allowed directories
    if (!isPathTraversalSafe(sanitizedPath, allowedDirectories)) {
      return {
        isValid: false,
        error: `Path '${sanitizedPath}' is not within allowed directories: ${allowedDirectories.join(', ')}`
      };
    }
    
    // Additional checks
    const pathComponents = sanitizedPath.split(/[\/\\]/);
    for (const component of pathComponents) {
      if (component === '..' || component === '.') {
        return {
          isValid: false,
          error: `Path contains invalid component: ${component}`
        };
      }
    }
    
    return {
      isValid: true,
      sanitizedPath: sanitizedPath
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Path validation failed: ${error.message}`
    };
  }
}

/**
 * Checks if a path is a child of a parent directory
 */
export function isChildPath(parentDir: string, childPath: string): boolean {
  const parent = path.resolve(parentDir);
  const child = path.resolve(childPath);
  
  // Ensure the child path is within the parent directory
  const relative = path.relative(parent, child);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}