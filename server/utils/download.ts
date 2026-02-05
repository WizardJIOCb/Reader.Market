import fs from "fs";
import path from "path";
import https from "https";

// Utility function to download files from external URLs with redirect support
export function downloadFileFromUrl(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function downloadWithRedirect(currentUrl: string) {
      https.get(currentUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`Following redirect to: ${redirectUrl}`);
            downloadWithRedirect(redirectUrl);
          } else {
            reject(new Error(`Redirect without location header: ${response.statusCode}`));
          }
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded file to: ${destPath}`);
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(destPath, () => {}); // Delete the file async
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    }
    
    downloadWithRedirect(url);
  });
}

// Utility function to get file extension from URL
export function getFileExtensionFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const ext = path.extname(pathname);
    if (ext) return ext.toLowerCase();
    
    // Some URLs don't have extensions in the path but we can infer from content
    if (url.includes('gutenberg')) return '.txt';
    if (url.includes('openlibrary')) return '.pdf';
    if (url.includes('googleapis')) return '.pdf';
    if (url.includes('archive.org')) return '.epub';
    
    return '.bin'; // default binary extension
  } catch {
    return '.bin';
  }
}

// Utility function to get image extension from URL
export function getImageExtensionFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const ext = path.extname(pathname);
    if (ext && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext.toLowerCase())) {
      return ext.toLowerCase();
    }
  } catch {}
  
  // Try to infer from URL patterns
  if (url.includes('covers.openlibrary.org')) return '.jpg';
  if (url.includes('gutendex.com') || url.includes('archive.org')) return '.jpg';
  
  return '.jpg'; // default image extension
}