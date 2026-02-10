import path from 'path';
import fs from 'fs';

interface BookFiles {
  bookFile?: string;
  coverImage?: string;
}

export class BookFileManager {
  public static readonly BOOKS_DIR = path.join(process.cwd(), 'uploads', 'books');
  public static readonly COVERS_DIR = path.join(process.cwd(), 'uploads', 'covers');

  static {
    // Create directories if they don't exist
    if (!fs.existsSync(this.BOOKS_DIR)) {
      fs.mkdirSync(this.BOOKS_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.COVERS_DIR)) {
      fs.mkdirSync(this.COVERS_DIR, { recursive: true });
    }
  }

  /**
   * Generate standardized filenames based on book ID
   */
  static generateBookFileName(bookId: string, originalFileName: string): string {
    const ext = path.extname(originalFileName);
    return `${bookId}-bookFile${ext}`;
  }

  static generateCoverFileName(bookId: string, originalFileName: string): string {
    const ext = path.extname(originalFileName);
    return `${bookId}-cover${ext}`;
  }

  /**
   * Save book file with standardized naming
   */
  static saveBookFile(bookId: string, fileBuffer: Buffer, originalFileName: string): string {
    const fileName = this.generateBookFileName(bookId, originalFileName);
    const filePath = path.join(this.BOOKS_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    return `/uploads/books/${fileName}`;
  }

  /**
   * Save cover image with standardized naming
   */
  static saveCoverImage(bookId: string, fileBuffer: Buffer, originalFileName: string): string {
    const fileName = this.generateCoverFileName(bookId, originalFileName);
    const filePath = path.join(this.COVERS_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    return `/uploads/covers/${fileName}`;
  }

  /**
   * Move temporary file to standardized location
   */
  static moveBookFileFromTemp(bookId: string, tempFilePath: string, originalFileName: string): string {
    const fileName = this.generateBookFileName(bookId, originalFileName);
    const targetPath = path.join(this.BOOKS_DIR, fileName);
    
    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.renameSync(tempFilePath, targetPath);
    return `/uploads/books/${fileName}`;
  }

  static moveCoverImageFromTemp(bookId: string, tempFilePath: string, originalFileName: string): string {
    const fileName = this.generateCoverFileName(bookId, originalFileName);
    const targetPath = path.join(this.COVERS_DIR, fileName);
    
    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.renameSync(tempFilePath, targetPath);
    return `/uploads/covers/${fileName}`;
  }

  /**
   * Delete book files by book ID
   */
  static deleteBookFiles(bookId: string): void {
    // Delete book file
    const bookFiles = fs.readdirSync(this.BOOKS_DIR);
    const bookFilePattern = new RegExp(`^${bookId}-bookFile\\.`);
    const bookFile = bookFiles.find(file => bookFilePattern.test(file));
    
    if (bookFile) {
      const bookFilePath = path.join(this.BOOKS_DIR, bookFile);
      if (fs.existsSync(bookFilePath)) {
        fs.unlinkSync(bookFilePath);
      }
    }

    // Delete cover image
    const coverFiles = fs.readdirSync(this.COVERS_DIR);
    const coverFilePattern = new RegExp(`^${bookId}-cover\\.`);
    const coverFile = coverFiles.find(file => coverFilePattern.test(file));
    
    if (coverFile) {
      const coverFilePath = path.join(this.COVERS_DIR, coverFile);
      if (fs.existsSync(coverFilePath)) {
        fs.unlinkSync(coverFilePath);
      }
    }
  }

  /**
   * Get file paths for a book by ID
   */
  static getBookFilePaths(bookId: string): BookFiles {
    const result: BookFiles = {};

    // Look for book file
    const bookFiles = fs.readdirSync(this.BOOKS_DIR);
    const bookFilePattern = new RegExp(`^${bookId}-bookFile\\.`);
    const bookFile = bookFiles.find(file => bookFilePattern.test(file));
    
    if (bookFile) {
      result.bookFile = `/uploads/books/${bookFile}`;
    }

    // Look for cover image
    const coverFiles = fs.readdirSync(this.COVERS_DIR);
    const coverFilePattern = new RegExp(`^${bookId}-cover\\.`);
    const coverFile = coverFiles.find(file => coverFilePattern.test(file));
    
    if (coverFile) {
      result.coverImage = `/uploads/covers/${coverFile}`;
    }

    return result;
  }

  /**
   * Check if book file exists
   */
  static bookFileExists(bookId: string): boolean {
    const bookFiles = fs.readdirSync(this.BOOKS_DIR);
    const bookFilePattern = new RegExp(`^${bookId}-bookFile\\.`);
    return bookFiles.some(file => bookFilePattern.test(file));
  }

  /**
   * Check if cover image exists
   */
  static coverImageExists(bookId: string): boolean {
    const coverFiles = fs.readdirSync(this.COVERS_DIR);
    const coverFilePattern = new RegExp(`^${bookId}-cover\\.`);
    return coverFiles.some(file => coverFilePattern.test(file));
  }

  /**
   * Get full path for book file
   */
  static getFullBookFilePath(bookId: string): string | null {
    const bookFiles = fs.readdirSync(this.BOOKS_DIR);
    const bookFilePattern = new RegExp(`^${bookId}-bookFile\\.`);
    const bookFile = bookFiles.find(file => bookFilePattern.test(file));
    
    return bookFile ? path.join(this.BOOKS_DIR, bookFile) : null;
  }

  /**
   * Get full path for cover image
   */
  static getFullCoverImagePath(bookId: string): string | null {
    const coverFiles = fs.readdirSync(this.COVERS_DIR);
    const coverFilePattern = new RegExp(`^${bookId}-cover\\.`);
    const coverFile = coverFiles.find(file => coverFilePattern.test(file));
    
    return coverFile ? path.join(this.COVERS_DIR, coverFile) : null;
  }
}