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
import fontkit from '@pdf-lib/fontkit';
import { parseStringPromise } from 'xml2js';
import { create } from 'xmlbuilder2';

// Flag to track if worker should stop
let shouldStop = false;
let currentAbortController: AbortController | null = null;
let currentGenerationId: string | null = null; // Track current generation for cancellation

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] Received SIGTERM, stopping gracefully...');
  shouldStop = true;
  // Abort any ongoing HTTP request
  if (currentAbortController) {
    currentAbortController.abort();
  }
  // Try to cancel ongoing Ollama generation
  if (currentGenerationId) {
    const apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    cancelOllamaGeneration(apiUrl).catch(console.error);
  }
});

process.on('SIGINT', () => {
  console.log('[Worker] Received SIGINT, stopping gracefully...');
  shouldStop = true;
  // Abort any ongoing HTTP request
  if (currentAbortController) {
    currentAbortController.abort();
  }
  // Try to cancel ongoing Ollama generation
  if (currentGenerationId) {
    const apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    cancelOllamaGeneration(apiUrl).catch(console.error);
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

/**
 * Cancel an ongoing Ollama generation by unloading model
 */
async function cancelOllamaGeneration(apiUrl: string, model?: string): Promise<void> {
  try {
    console.log(`[Worker] Sending model unload requests to Ollama...`);
    
    // Attempt 1: Unload specific model if provided
    if (model) {
      await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: '',
          keep_alive: 0
        }),
        signal: AbortSignal.timeout(3000)
      }).catch(() => {});
    }
    
    // Attempt 2: Force general cleanup
    await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: '',
        prompt: '',
        keep_alive: 0
      }),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
    
    console.log(`[Worker] Sent model unload signals to Ollama`);
  } catch (error) {
    console.error(`[Worker] Failed to unload Ollama model:`, error);
  }
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

CRITICAL INSTRUCTIONS:
- Translate ALL text character-by-character
- Keep URLs, hexadecimal values, and technical IDs unchanged
- DO NOT add explanations, comments, or descriptions
- DO NOT skip any content
- DO NOT interpret or analyze the text
- Output ONLY the translated text

Text to translate:
${text}`;
  
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
          num_predict: -1, // No limit on output tokens
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
    } else if (fileType.includes('fb2') || fileType.includes('fictionbook') || path.extname(originalFilePath).toLowerCase() === '.fb2') {
      console.log(`[Worker] Extracting text from FB2...`);
      try {
        const fb2Content = await fs.promises.readFile(originalFilePath, 'utf-8');
        const parsedXml = await parseStringPromise(fb2Content);
        
        // Extract text from FB2 structure (body -> section -> p)
        const extractTextFromNode = (node: any): string => {
          if (!node) return '';
          
          let text = '';
          
          // Handle text content
          if (typeof node === 'string') {
            return node;
          }
          
          // Handle arrays
          if (Array.isArray(node)) {
            return node.map(extractTextFromNode).join('\n\n');
          }
          
          // Handle objects
          if (typeof node === 'object') {
            // Direct text content
            if (node._) {
              text += node._;
            }
            
            // Recursively process children
            for (const key in node) {
              if (key !== '_' && key !== '$') {
                text += extractTextFromNode(node[key]);
              }
            }
          }
          
          return text;
        };
        
        // Extract from body sections
        const body = parsedXml?.FictionBook?.body || [];
        textToTranslate = extractTextFromNode(body);
        
        console.log(`[Worker] Extracted ${textToTranslate.length} characters from FB2`);
      } catch (fb2Error) {
        console.error(`[Worker] FB2 extraction failed:`, fb2Error);
        throw new Error(`Failed to extract text from FB2: ${fb2Error}`);
      }
    } else {
      throw new Error(`Unsupported file type: ${fileType}. Supported formats: PDF, TXT, FB2`);
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
    
    // If original was PDF, create interleaved PDF with original pages + translated text pages
    if (fileType.includes('pdf') || originalExt.toLowerCase() === '.pdf') {
      console.log(`[Worker] Creating PDF with original pages and translated text...`);
      
      // Load the original PDF
      const originalPdfBuffer = await fs.promises.readFile(originalFilePath);
      const originalPdfDoc = await PDFDocument.load(originalPdfBuffer);
      
      // Create a new PDF document
      const translatedPdfDoc = await PDFDocument.create();
      
      // Register fontkit for custom font support
      translatedPdfDoc.registerFontkit(fontkit);
      
      // Try to embed a Unicode-supporting font
      let font;
      const dejaVuPath = 'C:\\Windows\\Fonts\\DejaVuSans.ttf';
      const arialPath = 'C:\\Windows\\Fonts\\arial.ttf';
      
      try {
        if (fs.existsSync(dejaVuPath)) {
          const fontBytes = await fs.promises.readFile(dejaVuPath);
          font = await translatedPdfDoc.embedFont(fontBytes);
          console.log(`[Worker] Using DejaVuSans font`);
        } else if (fs.existsSync(arialPath)) {
          const fontBytes = await fs.promises.readFile(arialPath);
          font = await translatedPdfDoc.embedFont(fontBytes);
          console.log(`[Worker] Using Arial font`);
        } else {
          font = await translatedPdfDoc.embedFont(StandardFonts.Helvetica);
          console.warn(`[Worker] Using Helvetica`);
        }
      } catch (fontError) {
        console.error(`[Worker] Font error:`, fontError);
        font = await translatedPdfDoc.embedFont(StandardFonts.Helvetica);
      }
      
      const fontSize = 11;
      const lineHeight = fontSize * 1.5;
      const margin = 60;
      
      // Copy all original pages (with images)
      const copiedPages = await translatedPdfDoc.copyPages(originalPdfDoc, originalPdfDoc.getPageIndices());
      
      console.log(`[Worker] Processing ${copiedPages.length} original pages...`);
      
      // Split translated text into paragraphs
      const paragraphs = translatedText.split('\n\n').filter(p => p.trim());
      
      // For each original page, add it, then add translation page(s)
      const textPagesPerOriginal = Math.ceil(paragraphs.length / copiedPages.length);
      let paragraphIndex = 0;
      
      for (let i = 0; i < copiedPages.length; i++) {
        // Add original page with images
        translatedPdfDoc.addPage(copiedPages[i]);
        
        // Create translation page(s) for this section
        const paragraphsForThisPage = paragraphs.slice(
          paragraphIndex,
          Math.min(paragraphIndex + textPagesPerOriginal, paragraphs.length)
        );
        
        if (paragraphsForThisPage.length > 0) {
          let translationPage = translatedPdfDoc.addPage();
          let { width, height } = translationPage.getSize();
          let yPosition = height - margin;
          
          for (const paragraph of paragraphsForThisPage) {
            const maxWidth = width - 2 * margin;
            const words = paragraph.split(' ');
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const textWidth = font.widthOfTextAtSize(testLine, fontSize);
              
              if (textWidth > maxWidth && currentLine) {
                // Draw line
                if (yPosition < margin + lineHeight) {
                  // New page for overflow
                  translationPage = translatedPdfDoc.addPage();
                  yPosition = height - margin;
                }
                
                translationPage.drawText(currentLine, {
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
            if (currentLine) {
              if (yPosition < margin + lineHeight) {
                translationPage = translatedPdfDoc.addPage();
                yPosition = height - margin;
              }
              
              translationPage.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              });
              
              yPosition -= lineHeight;
            }
            
            yPosition -= lineHeight * 0.5;
          }
          
          paragraphIndex += paragraphsForThisPage.length;
        }
      }
      
      // Save PDF
      const pdfBytes = await translatedPdfDoc.save();
      await fs.promises.writeFile(translatedFilePath, pdfBytes);
      console.log(`[Worker] Interleaved PDF saved: ${translatedFilePath}`);
    } else if (fileType.includes('fb2') || fileType.includes('fictionbook') || originalExt.toLowerCase() === '.fb2') {
      // For FB2 files, generate proper FB2 XML with translated text
      console.log(`[Worker] Generating FB2 with translated text...`);
      
      const paragraphs = translatedText.split('\n\n').filter(p => p.trim());
      
      // Create FB2 XML structure
      const fb2Doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('FictionBook', { 
          xmlns: 'http://www.gribuser.ru/xml/fictionbook/2.0',
          'xmlns:l': 'http://www.w3.org/1999/xlink'
        })
          .ele('description')
            .ele('title-info')
              .ele('genre').txt('unknown').up()
              .ele('author')
                .ele('first-name').txt('Unknown').up()
                .ele('last-name').txt('Author').up()
              .up()
              .ele('book-title').txt('Translated').up()
              .ele('lang').txt(targetLanguage).up()
            .up()
          .up()
          .ele('body')
            .ele('section');
      
      // Add all translated paragraphs within a single section
      for (const paragraph of paragraphs) {
        fb2Doc.ele('p').txt(paragraph).up();
      }
      
      const fb2Xml = fb2Doc.end({ prettyPrint: true });
      await fs.promises.writeFile(translatedFilePath, fb2Xml, 'utf-8');
      console.log(`[Worker] FB2 saved: ${translatedFilePath}`);
    } else {
      // For other text files, save as text
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
    
    // Unload Ollama model on error
    try {
      console.log(`[Worker] Unloading Ollama model due to error...`);
      await cancelOllamaGeneration(ollamaUrl, ollamaModel);
    } catch (cleanupError) {
      console.error(`[Worker] Error during Ollama cleanup:`, cleanupError);
    }
    
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
    // Final cleanup: Unload Ollama model
    try {
      console.log(`[Worker] Final Ollama cleanup...`);
      await cancelOllamaGeneration(ollamaUrl, ollamaModel);
    } catch (finalCleanupError) {
      console.error(`[Worker] Error during final Ollama cleanup:`, finalCleanupError);
    }
    
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
