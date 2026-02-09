#!/usr/bin/env node

/**
 * Bootstrap Script for Global Catalog
 * 
 * This script populates the global_works table with books from Wikidata
 * as part of the initial global catalog creation.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { 
  globalWorks, 
  bootstrapProgress, 
  InsertGlobalWork, 
  InsertBootstrapProgress 
} from '../shared/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://reader_market_user:reader_market_pass@localhost:5432/reader_market';
const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

// Configuration
const BATCH_SIZE = 1000; // Process 1000 records at a time
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests to respect rate limits

interface WikidataBook {
  book: string;
  bookLabel: string;
  authorLabel?: string;
  publicationYear?: string;
  languageLabel?: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWikidataBatch(lastProcessedQid: string = '', offset: number = 0): Promise<WikidataBook[]> {
  try {
    // Construct the SPARQL query
    let query = `
      SELECT ?book ?bookLabel ?authorLabel ?publicationYear ?languageLabel WHERE {
        ?book wdt:P31 wd:Q571 .        # instance of book
        OPTIONAL { ?book wdt:P50 ?author . }
        OPTIONAL { ?book wdt:P577 ?publicationDate . }
        OPTIONAL { ?book wdt:P407 ?language . }

        BIND(year(?publicationDate) AS ?publicationYear)

        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
        }
      `;
    
    // Add ordering and limits
    if (lastProcessedQid) {
      query += `FILTER(?book > <${lastProcessedQid}>) `;
    }
    
    query += `
      ORDER BY ?book
      OFFSET ${offset}
      LIMIT ${BATCH_SIZE}
    `;

    console.log(`Fetching Wikidata batch with query: ${query.substring(0, 100)}...`);

    const response = await axios.get(WIKIDATA_SPARQL_ENDPOINT, {
      params: {
        query: query,
        format: 'json'
      },
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Reader.Market/1.0 (contact@reader.market)'
      },
      timeout: 30000 // 30 second timeout
    });

    if (response.data && response.data.results && response.data.results.bindings) {
      return response.data.results.bindings.map((binding: any) => ({
        book: binding.book.value,
        bookLabel: binding.bookLabel.value,
        authorLabel: binding.authorLabel?.value,
        publicationYear: binding.publicationYear?.value,
        languageLabel: binding.languageLabel?.value
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching data from Wikidata:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      console.error('Response headers:', error.response?.headers);
    }
    throw error;
  }
}

function normalizeTitle(title: string): string {
  // Convert to lowercase and normalize whitespace
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeAuthor(author: string): string {
  // Normalize author name
  if (!author) return '';
  return author.trim();
}

function parseYear(yearStr: string | undefined): number | null {
  if (!yearStr) return null;
  
  // Extract year from the string (could be "1995-01-01" or "1995")
  const yearMatch = yearStr.match(/^\d{4}/);
  if (yearMatch) {
    const yearNum = parseInt(yearMatch[0]);
    if (!isNaN(yearNum) && yearNum > 0 && yearNum <= new Date().getFullYear()) {
      return yearNum;
    }
  }
  
  return null;
}

function extractWikidataQid(uri: string): string | null {
  // Extract QID from Wikidata URI (e.g., "http://www.wikidata.org/entity/Q12345" -> "Q12345")
  const match = uri.match(/\/entity\/(Q\d+)$/);
  return match ? match[1] : null;
}

async function insertBooks(books: WikidataBook[], db: any) {
  if (books.length === 0) return;

  const inserts: InsertGlobalWork[] = [];

  for (const book of books) {
    const wikidataQid = extractWikidataQid(book.book);
    if (!wikidataQid) {
      console.warn(`Skipping book without valid QID: ${book.book}`);
      continue;
    }

    // Check if this book already exists in the database
    const existingBook = await db.select({ id: globalWorks.id })
      .from(globalWorks)
      .where(eq(globalWorks.wikidataQid, wikidataQid))
      .limit(1);

    if (existingBook.length > 0) {
      console.log(`Book with QID ${wikidataQid} already exists, skipping...`);
      continue;
    }

    // Also check for duplicate by title + author + year
    const normalizedTitle = normalizeTitle(book.bookLabel);
    const authorName = normalizeAuthor(book.authorLabel || '');
    const year = parseYear(book.publicationYear);

    const existingByTitle = await db.select({ id: globalWorks.id })
      .from(globalWorks)
      .where(
        and(
          eq(globalWorks.normalizedTitle, normalizedTitle),
          eq(globalWorks.authorName, authorName),
          year !== null ? eq(globalWorks.year, year) : isNotNull(globalWorks.year)
        )
      )
      .limit(1);

    if (existingByTitle.length > 0) {
      console.log(`Book with title "${book.bookLabel}", author "${authorName}" already exists, skipping...`);
      continue;
    }

    // Prepare the insert object
    const insertObj: InsertGlobalWork = {
      id: uuidv4(),
      title: book.bookLabel,
      normalizedTitle: normalizedTitle,
      authorName: authorName,
      year: year,
      language: book.languageLabel ? book.languageLabel.substring(0, 10) : undefined, // Limit to 10 chars
      wikidataQid: wikidataQid,
      openlibraryWorkId: null,
      status: 'pending',
      bootstrap_source: 'wikidata',
      bootstrap_at: new Date(),
      externalIds: {}
    };

    inserts.push(insertObj);
  }

  if (inserts.length > 0) {
    console.log(`Inserting ${inserts.length} books into global_works...`);
    await db.insert(globalWorks).values(inserts);
    console.log(`Successfully inserted ${inserts.length} books.`);
  }
}

async function updateBootstrapProgress(db: any, batchIdentifier: string, recordsProcessed: number, source: string, status: string, metadata?: any) {
  const progressRecord: InsertBootstrapProgress = {
    id: uuidv4(),
    batchIdentifier: batchIdentifier,
    source: source,
    recordsProcessed: recordsProcessed,
    status: status,
    startedAt: new Date(),
    metadata: metadata || {}
  };

  await db.insert(bootstrapProgress).values(progressRecord);
}

async function getLatestBootstrapProgress(db: any): Promise<any> {
  const result = await db.select()
    .from(bootstrapProgress)
    .orderBy(desc(bootstrapProgress.startedAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

async function main() {
  console.log('Starting bootstrap of global books from Wikidata...');

  // Check if discovery worker is running (should not be during bootstrap)
  if (process.env.DISABLE_WORKER_CHECK !== 'true') {
    console.log('Checking if discovery worker is running...');
    // In a real implementation, you might check a lock file or database flag here
    console.log('Ensure discovery worker is stopped before proceeding.');
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema: { globalWorks, bootstrapProgress } });

  // Get the last processed QID from the bootstrap progress table
  const lastProgress = await getLatestBootstrapProgress(db);
  let lastProcessedQid = lastProgress?.batchIdentifier || '';
  let offset = 0;
  let totalProcessed = 0;
  let batchNumber = 0;

  try {
    
    if (lastProcessedQid) {
      console.log(`Resuming from last processed QID: ${lastProcessedQid}`);
      offset = 0; // Reset offset when resuming with a QID filter
    }

    console.log('Starting to fetch and process books from Wikidata...');
    
    while (true) {
      batchNumber++;
      console.log(`Processing batch #${batchNumber} (offset: ${offset})...`);
      
      const books = await fetchWikidataBatch(lastProcessedQid, offset);
      
      if (books.length === 0) {
        console.log('No more books to process. Finished!');
        break;
      }

      console.log(`Fetched ${books.length} books from Wikidata batch #${batchNumber}`);

      // Insert the books into the database
      await insertBooks(books, db);
      
      // Update progress
      totalProcessed += books.length;
      const lastBook = books[books.length - 1];
      lastProcessedQid = lastBook.book;
      
      await updateBootstrapProgress(
        db, 
        lastProcessedQid, 
        books.length, 
        'wikidata', 
        'completed', 
        { batchNumber, offset }
      );

      console.log(`Processed batch #${batchNumber}, total so far: ${totalProcessed} books`);

      // Add delay to respect rate limits
      await delay(DELAY_BETWEEN_REQUESTS);

      // If we got a full batch, increment offset for pagination
      // If the lastProcessedQid is being used, we don't need offset
      if (lastProcessedQid) {
        offset = 0; // Continue with QID-based filtering
      } else {
        offset += BATCH_SIZE; // Use offset-based pagination
      }
    }

    console.log(`Bootstrap completed! Total books processed: ${totalProcessed}`);
    
    // Mark the overall bootstrap as completed
    await updateBootstrapProgress(
      db, 
      'bootstrap_complete', 
      totalProcessed, 
      'wikidata', 
      'completed', 
      { final: true, totalProcessed }
    );
    
  } catch (error) {
    console.error('Error during bootstrap process:', error);
    
    // Record failure in progress table
    await updateBootstrapProgress(
      db, 
      lastProcessedQid || 'bootstrap_error_unknown', 
      0, 
      'wikidata', 
      'failed', 
      { error: error.message }
    );
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Bootstrap script failed:', error);
    process.exit(1);
  });
}

export { main as bootstrapGlobalBooks };