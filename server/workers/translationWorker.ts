/**
 * Translation Worker - runs in a separate process to avoid blocking the main server
 * 
 * This worker receives translation jobs via IPC and processes them independently
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { bookTranslations, books } from "../../shared/schema";
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
// Use legacy build for Node.js environment
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Flag to track if worker should stop
let shouldStop = false;
let currentAbortController: AbortController | null = null;

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] Received SIGTERM, stopping gracefully...');
  shouldStop = true;
  // Abort any ongoing HTTP request
  if (currentAbortController) {
    currentAbortController.abort();
  }
});

process.on('SIGINT', () => {
  console.log('[Worker] Received SIGINT, stopping gracefully...');
  shouldStop = true;
  // Abort any ongoing HTTP request
  if (currentAbortController) {
    currentAbortController.abort();
  }
});

// Initialize separate database connection for worker
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 5,
});

const db = drizzle(pool);

interface TranslationJob {
  translationId: string;
  bookId: string;
  targetLanguage: string;
  service: string;
  model?: string;
}

// Simple translation service for worker
async function translateText(
  text: string,
  targetLang: string,
  apiUrl: string,
  model: string,
  sourceLang = 'en'
): Promise<string> {
  const languageNames: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
    pt: 'Portuguese',
    it: 'Italian',
  };

  const prompt = `Translate the following text from ${languageNames[sourceLang] || sourceLang} to ${languageNames[targetLang] || targetLang}. 
Only output the translated text, no explanations or additional comments.

Text to translate:
${text}

Translation:`;
  
  // Create new AbortController for this request
  currentAbortController = new AbortController();
  
  try {
    const response = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
        }
      }),
      signal: currentAbortController.signal
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json() as { response: string };
    return data.response.trim();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Translation aborted by user');
    }
    throw error;
  } finally {
    currentAbortController = null;
  }
}

function splitTextIntoChunks(text: string, maxChunkSize = 8000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function updateTranslationStatus(
  translationId: string,
  progress: number,
  step: string,
  details: { currentChunk?: number; totalChunks?: number; message?: string } = {}
) {
  const statusDetails = {
    step,
    currentChunk: details.currentChunk || 0,
    totalChunks: details.totalChunks || 0,
    message: details.message || '',
    updatedAt: new Date().toISOString(),
  };
  
  await db
    .update(bookTranslations)
    .set({ 
      progress,
      statusDetails,
      updatedAt: new Date()
    })
    .where(eq(bookTranslations.id, translationId));
}

async function processTranslation(job: TranslationJob) {
  const { translationId, bookId, targetLanguage, service, model } = job;
  const ollamaUrl = process.env.OLLAMA_API_URL || process.env.OLLAMA_HOST || 'http://localhost:11434';
  const ollamaModel = model || process.env.OLLAMA_MODEL || 'mistral:latest';

  try {
    console.log(`[Worker] Starting translation ${translationId} to ${targetLanguage}`);
    
    // Update status to processing
    await db
      .update(bookTranslations)
      .set({ status: 'processing', progress: 0 })
      .where(eq(bookTranslations.id, translationId));
    
    await updateTranslationStatus(translationId, 0, 'initializing', {
      message: 'Starting translation process...'
    });
    
    // Load book file
    console.log(`[Worker] Loading book file`);
    await updateTranslationStatus(translationId, 2, 'loading_book', {
      message: 'Loading book file...'
    });

    const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (!book) {
      throw new Error('Book not found');
    }
    
    const originalFilePath = path.join(process.cwd(), book.filePath);
    if (!fs.existsSync(originalFilePath)) {
      throw new Error('Original book file not found');
    }
    
    console.log(`[Worker] Reading file: ${originalFilePath}`);
    await updateTranslationStatus(translationId, 3, 'reading_file', {
      message: `Reading file: ${path.basename(originalFilePath)}`
    });

    // Extract text content based on file type
    await updateTranslationStatus(translationId, 5, 'extracting_text', {
      message: 'Extracting text content...'
    });

    let textToTranslate = '';
    const fileType = book.fileType || '';
    
    if (fileType.includes('pdf') || path.extname(originalFilePath).toLowerCase() === '.pdf') {
      console.log(`[Worker] Extracting text from PDF...`);
      try {
        // Read PDF file as buffer
        const pdfBuffer = await fs.promises.readFile(originalFilePath);
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfBuffer),
          useSystemFonts: true,
        });
        
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        console.log(`[Worker] PDF has ${numPages} pages`);
        
        // Extract text from all pages
        const textPages: string[] = [];
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          textPages.push(pageText);
          
          // Update progress during extraction
          if (pageNum % 10 === 0) {
            await updateTranslationStatus(translationId, 3 + Math.floor((pageNum / numPages) * 2), 'extracting_text', {
              message: `Extracting text from PDF page ${pageNum}/${numPages}...`
            });
          }
        }
        
        textToTranslate = textPages.join('\n\n');
        console.log(`[Worker] Extracted ${textToTranslate.length} characters from PDF`);
      } catch (pdfError) {
        console.error(`[Worker] PDF extraction failed:`, pdfError);
        throw new Error(`Failed to extract text from PDF: ${pdfError}`);
      }
    } else if (fileType.includes('text/plain') || path.extname(originalFilePath).toLowerCase() === '.txt') {
      const fileContent = await fs.promises.readFile(originalFilePath, 'utf-8');
      textToTranslate = fileContent;
    } else {
      throw new Error(`Unsupported file type: ${fileType}. Only PDF and TXT files are supported for translation.`);
    }
    
    console.log(`[Worker] Extracted ${textToTranslate.length} characters`);
    
    // Split text into chunks
    await updateTranslationStatus(translationId, 7, 'splitting_text', {
      message: 'Splitting text into chunks...'
    });

    const chunks = splitTextIntoChunks(textToTranslate, 8000);
    console.log(`[Worker] Split into ${chunks.length} chunks`);
    
    // Calculate total characters
    const totalCharacters = textToTranslate.length;
    console.log(`[Worker] Total characters: ${totalCharacters}`);
    
    // Update total chunks and characters in DB
    await db
      .update(bookTranslations)
      .set({ 
        totalChunks: chunks.length,
        totalCharacters: totalCharacters,
        updatedAt: new Date()
      })
      .where(eq(bookTranslations.id, translationId));
    
    await updateTranslationStatus(translationId, 10, 'ready_to_translate', {
      message: `Ready to translate ${chunks.length} chunks`,
      totalChunks: chunks.length,
      currentChunk: 0
    });
    
    // Check if there's a partial translation to resume
    const [currentTranslation] = await db
      .select()
      .from(bookTranslations)
      .where(eq(bookTranslations.id, translationId))
      .limit(1);
    
    const startChunkIndex = currentTranslation.lastCompletedChunk || 0;
    const partialDir = path.join(process.cwd(), 'uploads', 'translations', 'partial');
    if (!fs.existsSync(partialDir)) {
      fs.mkdirSync(partialDir, { recursive: true });
    }
    
    const partialFilePath = path.join(partialDir, `${translationId}.txt`);
    let translatedChunks: string[] = [];
    
    // Resume from partial file if exists
    if (startChunkIndex > 0 && currentTranslation.partialFilePath && fs.existsSync(partialFilePath)) {
      console.log(`[Worker] Resuming from chunk ${startChunkIndex + 1}/${chunks.length}`);
      const partialContent = await fs.promises.readFile(partialFilePath, 'utf-8');
      translatedChunks = partialContent.split('\n---CHUNK-SEPARATOR---\n').filter(c => c.trim());
      console.log(`[Worker] Loaded ${translatedChunks.length} previously translated chunks`);
    } else {
      console.log(`[Worker] Starting fresh translation`);
      // Initialize partial file
      await fs.promises.writeFile(partialFilePath, '', 'utf-8');
      await db
        .update(bookTranslations)
        .set({ 
          partialFilePath: path.relative(process.cwd(), partialFilePath).replace(/\\/g, '/'),
          lastCompletedChunk: 0,
          updatedAt: new Date()
        })
        .where(eq(bookTranslations.id, translationId));
    }
    
    // Translate each chunk (starting from where we left off)
    for (let i = startChunkIndex; i < chunks.length; i++) {
      // Check if worker should stop
      if (shouldStop) {
        console.log(`[Worker] Stopping translation at chunk ${i + 1}/${chunks.length} due to SIGTERM`);
        await updateTranslationStatus(translationId, 10 + Math.floor((i / chunks.length) * 80), 'paused', {
          message: `Paused at chunk ${i + 1} of ${chunks.length}`,
          currentChunk: i + 1,
          totalChunks: chunks.length
        });
        // Close DB connection and exit gracefully
        await pool.end();
        process.exit(0);
      }
      
      console.log(`[Worker] Translating chunk ${i + 1}/${chunks.length}`);
      
      const progress = 10 + Math.floor((i / chunks.length) * 80);
      await updateTranslationStatus(translationId, progress, 'translating', {
        message: `Translating chunk ${i + 1} of ${chunks.length}...`,
        currentChunk: i + 1,
        totalChunks: chunks.length
      });

      try {
        const translatedChunk = await translateText(
          chunks[i],
          targetLanguage,
          ollamaUrl,
          ollamaModel
        );
        translatedChunks.push(translatedChunk);
        
        // Save chunk to partial file immediately
        await fs.promises.appendFile(
          partialFilePath,
          (i > startChunkIndex ? '\n---CHUNK-SEPARATOR---\n' : '') + translatedChunk,
          'utf-8'
        );
        
        // Calculate characters translated
        const charsTranslatedSoFar = chunks.slice(0, i + 1).reduce((sum, chunk) => sum + chunk.length, 0);
        
        // Update last completed chunk and translated characters in DB
        await db
          .update(bookTranslations)
          .set({ 
            lastCompletedChunk: i + 1,
            translatedCharacters: charsTranslatedSoFar,
            updatedAt: new Date()
          })
          .where(eq(bookTranslations.id, translationId));
        
        const progressAfter = 10 + Math.floor(((i + 1) / chunks.length) * 80);
        await updateTranslationStatus(translationId, progressAfter, 'translating', {
          message: `Completed chunk ${i + 1} of ${chunks.length}`,
          currentChunk: i + 1,
          totalChunks: chunks.length
        });
        
        console.log(`[Worker] Chunk ${i + 1}/${chunks.length} saved to partial file`);
      } catch (chunkError) {
        console.error(`[Worker] Error translating chunk ${i + 1}:`, chunkError);
        // Partial file is preserved for resume
        throw new Error(`Translation failed at chunk ${i + 1}: ${chunkError}`);
      }
    }
    
    // Reassemble translated text from all chunks
    await updateTranslationStatus(translationId, 92, 'assembling', {
      message: 'Assembling translated content...'
    });

    const translatedText = translatedChunks.join('\n\n');
    console.log(`[Worker] Translation complete, ${translatedText.length} characters`);
    
    // Save final translated file
    await updateTranslationStatus(translationId, 95, 'saving', {
      message: 'Saving translated file...'
    });

    const timestamp = Date.now();
    const originalExt = path.extname(book.filePath);
    const translationsDir = path.join(process.cwd(), 'uploads', 'translations', bookId);
    
    if (!fs.existsSync(translationsDir)) {
      fs.mkdirSync(translationsDir, { recursive: true });
    }
    
    const translatedFileName = `${targetLanguage}_${timestamp}${originalExt}`;
    const translatedFilePath = path.join(translationsDir, translatedFileName);
    
    // If original was PDF, copy pages and add translated text
    if (fileType.includes('pdf') || originalExt.toLowerCase() === '.pdf') {
      console.log(`[Worker] Copying original PDF pages and adding translated text...`);
      
      // Load the original PDF to copy pages from
      const originalPdfBuffer = await fs.promises.readFile(originalFilePath);
      const originalPdfDoc = await PDFDocument.load(originalPdfBuffer);
      
      // Create a new PDF document
      const translatedPdfDoc = await PDFDocument.create();
      const font = await translatedPdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;
      const lineHeight = fontSize * 1.4;
      const margin = 40;
      
      // Copy all pages from original PDF
      const copiedPages = await translatedPdfDoc.copyPages(originalPdfDoc, originalPdfDoc.getPageIndices());
      copiedPages.forEach(page => translatedPdfDoc.addPage(page));
      
      console.log(`[Worker] Copied ${copiedPages.length} pages from original PDF`);
      
      // Split translated text into paragraphs
      const paragraphs = translatedText.split('\n\n').filter(p => p.trim());
      
      // Add translated text to pages (overlay on top of original)
      const pages = translatedPdfDoc.getPages();
      let pageIndex = 0;
      let yPosition = 0;
      
      if (pages.length > 0) {
        const currentPage = pages[pageIndex];
        const { width, height } = currentPage.getSize();
        yPosition = height - margin;
        
        // Draw semi-transparent white background for text readability
        for (const paragraph of paragraphs) {
          const maxWidth = width - 2 * margin;
          const words = paragraph.split(' ');
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth > maxWidth && currentLine) {
              // Draw current line with white background
              if (yPosition < margin + lineHeight) {
                // Move to next page
                pageIndex++;
                if (pageIndex >= pages.length) break;
                const nextPage = pages[pageIndex];
                const { height: nextHeight } = nextPage.getSize();
                yPosition = nextHeight - margin;
              }
              
              const currentPageToDraw = pages[pageIndex];
              const lineWidth = font.widthOfTextAtSize(currentLine, fontSize);
              
              // Draw white background rectangle
              currentPageToDraw.drawRectangle({
                x: margin - 2,
                y: yPosition - 2,
                width: lineWidth + 4,
                height: lineHeight,
                color: rgb(1, 1, 1),
                opacity: 0.85,
              });
              
              // Draw text
              currentPageToDraw.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              });
              
              yPosition -= lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          
          // Draw remaining line
          if (currentLine && pageIndex < pages.length) {
            if (yPosition < margin + lineHeight) {
              pageIndex++;
              if (pageIndex < pages.length) {
                const nextPage = pages[pageIndex];
                const { height: nextHeight } = nextPage.getSize();
                yPosition = nextHeight - margin;
              }
            }
            
            if (pageIndex < pages.length) {
              const currentPageToDraw = pages[pageIndex];
              const lineWidth = font.widthOfTextAtSize(currentLine, fontSize);
              
              // Draw white background rectangle
              currentPageToDraw.drawRectangle({
                x: margin - 2,
                y: yPosition - 2,
                width: lineWidth + 4,
                height: lineHeight,
                color: rgb(1, 1, 1),
                opacity: 0.85,
              });
              
              // Draw text
              currentPageToDraw.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              });
              
              yPosition -= lineHeight;
            }
          }
          
          // Add paragraph spacing
          yPosition -= lineHeight * 0.3;
        }
      }
      
      // Save PDF
      const pdfBytes = await translatedPdfDoc.save();
      await fs.promises.writeFile(translatedFilePath, pdfBytes);
      console.log(`[Worker] PDF with images and translated text saved to: ${translatedFilePath}`);
    } else {
      // For non-PDF files, save as text
      await fs.promises.writeFile(translatedFilePath, translatedText, 'utf-8');
      console.log(`[Worker] Saved to: ${translatedFilePath}`);
    }
    
    const stats = await fs.promises.stat(translatedFilePath);
    const relativePath = path.relative(process.cwd(), translatedFilePath).replace(/\\/g, '/');
    
    // Mark as completed with file info
    await db
      .update(bookTranslations)
      .set({ 
        status: 'completed',
        progress: 100,
        statusDetails: { step: 'completed', message: 'Translation completed successfully' },
        filePath: relativePath,
        fileSize: stats.size,
        completedAt: new Date()
      })
      .where(eq(bookTranslations.id, translationId));
    
    // Clean up partial file after successful completion
    if (fs.existsSync(partialFilePath)) {
      await fs.promises.unlink(partialFilePath);
      console.log(`[Worker] Cleaned up partial file`);
    }
    
    console.log(`[Worker] Translation ${translationId} completed successfully`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Worker] Translation ${translationId} error:`, error);
    
    // Don't mark as failed if it's resumable - keep partial file
    await db
      .update(bookTranslations)
      .set({ 
        status: 'failed',
        statusDetails: { step: 'failed', message: errorMessage },
        errorMessage: errorMessage
        // Note: partialFilePath and lastCompletedChunk are preserved for resume
      })
      .where(eq(bookTranslations.id, translationId));
    
    // Send error message to parent
    if (process.send) {
      process.send({ type: 'failed', translationId, error: errorMessage });
    }
  } finally {
    // Close database connection and exit
    await pool.end();
    process.exit(0);
  }
}

// Read job from environment variable (set by parent process via spawn)
const jobJson = process.env.TRANSLATION_JOB;
if (jobJson) {
  try {
    const job = JSON.parse(jobJson) as TranslationJob;
    console.log(`[Worker] Starting job from env:`, job);
    processTranslation(job);
  } catch (e) {
    console.error('[Worker] Failed to parse TRANSLATION_JOB:', e);
    process.exit(1);
  }
} else {
  console.error('[Worker] No TRANSLATION_JOB environment variable found');
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Unhandled rejection:', reason);
  process.exit(1);
});
