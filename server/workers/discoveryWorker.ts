/**
 * Discovery Worker - runs in a separate process to discover and enrich books
 * 
 * This worker handles:
 * 1. Processing search misses (high priority)
 * 2. Filling the global catalog (low priority)
 * 3. Fetching book metadata from external sources
 * 4. Updating book status in the global catalog
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import axios from 'axios';
import { eq, ne, and, asc, desc, sql } from 'drizzle-orm';
import { 
  globalWorks, 
  discoveryQueue, 
  searchMissLog, 
  editions, 
  workerStats,
  InsertWorkerStat,
  InsertEdition
} from '../../shared/schema';
import * as schema from '../../shared/schema';
import { randomUUID } from 'crypto';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://reader_market_user:reader_market_pass@localhost:5432/reader_market';

// Configuration
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

interface WikidataBookResult {
  book: string;
  bookLabel: string;
  authorLabel?: string;
  publicationYear?: string;
  languageLabel?: string;
}

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    pageCount?: number;
    printType?: string;
    categories?: string[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      smallImage?: string;
      mediumImage?: string;
      largeImage?: string;
      extraLargeImage?: string;
    };
  };
}

class DiscoveryWorker {
  private pool: Pool;
  private db: any;
  private shouldStop: boolean = false;
  private workerStatsId: string | null = null;
  private activeSince: Date | null = null;

  constructor() {
    this.pool = new Pool({ connectionString: DATABASE_URL });
    this.db = drizzle(this.pool, { schema: { globalWorks, discoveryQueue, searchMissLog, editions, workerStats } });
  }

  async initialize() {
    // Register worker in stats table
    const workerStat: InsertWorkerStat = {
      id: randomUUID(),
      workerName: 'discovery_worker',
      totalProcessed: 0,
      totalErrors: 0,
      lastProcessedAt: null,
      activeSince: new Date(),
    };

    const result = await this.db.insert(schema.workerStats).values(workerStat).returning();
    this.workerStatsId = result[0].id;
    this.activeSince = result[0].activeSince;
    console.log('Discovery worker initialized and registered in stats table.');
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async updateWorkerStats(processed: boolean) {
    if (!this.workerStatsId) return;

    const updateData: any = {};
    if (processed) {
      updateData.totalProcessed = sql`${schema.workerStats.totalProcessed} + 1`;
      updateData.lastProcessedAt = new Date();
    } else {
      updateData.totalErrors = sql`${schema.workerStats.totalErrors} + 1`;
    }
    updateData.updatedAt = new Date();

    await this.db.update(schema.workerStats)
      .set(updateData)
      .where(eq(schema.workerStats.id, this.workerStatsId));
  }

  async fetchFromWikidata(query: string): Promise<WikidataBookResult[]> {
    try {
      // Construct a more targeted SPARQL query based on the search query
      const sparqlQuery = `
        SELECT ?book ?bookLabel ?authorLabel ?publicationYear ?languageLabel WHERE {
          SERVICE wikibase:mwapi {
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
            bd:serviceParam mwapi:api "EntitySearch";
            bd:serviceParam mwapi:search "${encodeURIComponent(query)}";
            bd:serviceParam mwapi:language "en";
            ?book wikibase:apiOutputItem mwapi:item.
          }
          ?book wdt:P31 wd:Q571 .        # instance of book
          OPTIONAL { ?book wdt:P50 ?author . }
          OPTIONAL { ?book wdt:P577 ?publicationDate . }
          OPTIONAL { ?book wdt:P407 ?language . }

          BIND(year(?publicationDate) AS ?publicationYear)

          SERVICE wikibase:label {
            bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
          }
        }
        LIMIT 10
      `;

      const response = await axios.get('https://query.wikidata.org/sparql', {
        params: {
          query: sparqlQuery,
          format: 'json'
        },
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'Reader.Market/1.0 (contact@reader.market)'
        },
        timeout: 30000
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
      console.error('Error fetching from Wikidata:', error);
      return [];
    }
  }

  async fetchFromOpenLibrary(query: string): Promise<any[]> {
    try {
      const response = await axios.get('https://openlibrary.org/search.json', {
        params: {
          q: query,
          limit: 10
        },
        headers: {
          'User-Agent': 'Reader.Market/1.0 (contact@reader.market)'
        },
        timeout: 30000
      });

      if (response.data && response.data.docs) {
        return response.data.docs;
      }

      return [];
    } catch (error) {
      console.error('Error fetching from Open Library:', error);
      return [];
    }
  }

  async fetchFromGoogleBooks(query: string): Promise<GoogleBooksVolume[]> {
    if (!GOOGLE_BOOKS_API_KEY) {
      console.warn('Google Books API key not configured, skipping Google Books search');
      return [];
    }

    try {
      const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
        params: {
          q: query,
          maxResults: 10,
          key: GOOGLE_BOOKS_API_KEY
        },
        headers: {
          'User-Agent': 'Reader.Market/1.0 (contact@reader.market)'
        },
        timeout: 30000
      });

      if (response.data && response.data.items) {
        return response.data.items;
      }

      return [];
    } catch (error) {
      console.error('Error fetching from Google Books:', error);
      return [];
    }
  }

  async normalizeAndSaveBook(bookData: any, source: string) {
    // Extract data depending on the source
    let title: string, author: string, year: number | null, language: string | undefined, 
        wikidataQid: string | null, openlibraryWorkId: string | null, isbn10: string | null, 
        isbn13: string | null, publisher: string | null;

    if (source === 'wikidata') {
      title = bookData.bookLabel;
      author = bookData.authorLabel || '';
      year = bookData.publicationYear ? parseInt(bookData.publicationYear) : null;
      language = bookData.languageLabel;
      wikidataQid = this.extractWikidataQid(bookData.book);
      openlibraryWorkId = null;
      isbn10 = null;
      isbn13 = null;
      publisher = null;
    } else if (source === 'openlibrary') {
      title = bookData.title || '';
      author = Array.isArray(bookData.author_name) ? bookData.author_name.join(', ') : bookData.author_name || '';
      year = bookData.first_publish_year ? parseInt(bookData.first_publish_year) : null;
      language = bookData.language?.[0];
      wikidataQid = null;
      openlibraryWorkId = bookData.key ? bookData.key.replace('/works/', '') : null;
      isbn10 = bookData.isbn ? bookData.isbn.find((isbn: string) => isbn.length === 10) || null : null;
      isbn13 = bookData.isbn ? bookData.isbn.find((isbn: string) => isbn.length === 13) || null : null;
      publisher = Array.isArray(bookData.publisher) ? bookData.publisher[0] : bookData.publisher;
    } else if (source === 'google_books') {
      title = bookData.volumeInfo.title || '';
      author = bookData.volumeInfo.authors ? bookData.volumeInfo.authors.join(', ') : '';
      year = bookData.volumeInfo.publishedDate ? parseInt(bookData.volumeInfo.publishedDate.split('-')[0]) : null;
      language = bookData.volumeInfo.language;
      wikidataQid = null;
      openlibraryWorkId = null;
      isbn10 = null;
      isbn13 = null;
      publisher = bookData.volumeInfo.publisher || null;

      // Extract ISBNs from industryIdentifiers
      if (bookData.volumeInfo.industryIdentifiers) {
        for (const id of bookData.volumeInfo.industryIdentifiers) {
          if (id.type === 'ISBN_10') {
            isbn10 = id.identifier;
          } else if (id.type === 'ISBN_13') {
            isbn13 = id.identifier;
          }
        }
      }
    } else {
      // Unknown source
      return null;
    }

    // Check if a similar book already exists in the global works table
    const existingBook = await this.db.select()
      .from(globalWorks)
      .where(and(
        eq(globalWorks.normalizedTitle, this.normalizeTitle(title)),
        eq(globalWorks.authorName, this.normalizeAuthor(author)),
        year !== null ? eq(globalWorks.year, year) : ne(globalWorks.year, -1) // Using -1 as placeholder for null years
      ))
      .limit(1);

    if (existingBook.length > 0) {
      console.log(`Book already exists in global catalog: ${title} by ${author}`);
      return existingBook[0].id;
    }

    // Also check by Wikidata QID or OpenLibrary ID if available
    if (wikidataQid) {
      const byWikidataQid = await this.db.select({ id: globalWorks.id })
        .from(globalWorks)
        .where(eq(globalWorks.wikidataQid, wikidataQid))
        .limit(1);

      if (byWikidataQid.length > 0) {
        console.log(`Book already exists in global catalog (by Wikidata QID): ${wikidataQid}`);
        return byWikidataQid[0].id;
      }
    }

    if (openlibraryWorkId) {
      const byOpenlibraryId = await this.db.select({ id: globalWorks.id })
        .from(globalWorks)
        .where(eq(globalWorks.openlibraryWorkId, openlibraryWorkId))
        .limit(1);

      if (byOpenlibraryId.length > 0) {
        console.log(`Book already exists in global catalog (by OpenLibrary ID): ${openlibraryWorkId}`);
        return byOpenlibraryId[0].id;
      }
    }

    // Insert the new book into global works
    const newBook = await this.db.insert(globalWorks)
      .values({
        title: title,
        normalizedTitle: this.normalizeTitle(title),
        authorName: this.normalizeAuthor(author),
        year: year,
        language: language?.substring(0, 10), // Limit to 10 chars
        wikidataQid: wikidataQid,
        openlibraryWorkId: openlibraryWorkId,
        discovered_at: new Date(),
        discovery_source: source,
        status: 'processed' // Mark as processed since we just found it
      })
      .returning();

    console.log(`Added new book to global catalog: ${title} by ${author}`);

    // If we have ISBN info, add it as an edition
    if (isbn10 || isbn13) {
      const edition: InsertEdition = {
        workId: newBook[0].id,
        isbn10: isbn10,
        isbn13: isbn13,
        publisher: publisher,
        year: year,
        language: language?.substring(0, 10),
        source: source
      };

      await this.db.insert(editions).values(edition);
      console.log(`Added edition for book ${title} with ISBNs: ${isbn10 || isbn13}`);
    }

    return newBook[0].id;
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private normalizeAuthor(author: string): string {
    if (!author) return '';
    return author.trim();
  }

  private extractWikidataQid(uri: string): string | null {
    const match = uri.match(/\/entity\/(Q\d+)$/);
    return match ? match[1] : null;
  }

  async processNextTask(): Promise<boolean> {
    // First try to get a high-priority task (search miss)
    let nextTask = await this.db.select()
      .from(discoveryQueue)
      .where(and(
        eq(discoveryQueue.status, 'pending'),
        eq(discoveryQueue.type, 'user_search')
      ))
      .orderBy(desc(discoveryQueue.priority))
      .limit(1);

    // If no high-priority tasks, try low-priority tasks
    if (nextTask.length === 0) {
      nextTask = await this.db.select()
        .from(discoveryQueue)
        .where(eq(discoveryQueue.status, 'pending'))
        .orderBy(asc(discoveryQueue.createdAt))
        .limit(1);
    }

    if (nextTask.length === 0) {
      console.log('No tasks in discovery queue');
      return false;
    }

    const task = nextTask[0];
    console.log(`Processing discovery task: ${task.query} (type: ${task.type})`);

    try {
      // Mark task as processing
      await this.db.update(discoveryQueue)
        .set({ 
          status: 'processing',
          attempts: sql`${discoveryQueue.attempts} + 1`,
          lastAttemptAt: new Date()
        })
        .where(eq(discoveryQueue.id, task.id));

      // Search in different sources
      let found = false;
      
      // Try Wikidata first
      const wikidataResults = await this.fetchFromWikidata(task.query);
      if (wikidataResults.length > 0) {
        for (const book of wikidataResults) {
          await this.normalizeAndSaveBook(book, 'wikidata');
        }
        found = true;
      }

      // Try Open Library
      const openlibraryResults = await this.fetchFromOpenLibrary(task.query);
      if (openlibraryResults.length > 0) {
        for (const book of openlibraryResults) {
          await this.normalizeAndSaveBook(book, 'openlibrary');
        }
        found = true;
      }

      // Try Google Books
      const googleBooksResults = await this.fetchFromGoogleBooks(task.query);
      if (googleBooksResults.length > 0) {
        for (const book of googleBooksResults) {
          await this.normalizeAndSaveBook(book, 'google_books');
        }
        found = true;
      }

      // Update task status based on results
      await this.db.update(discoveryQueue)
        .set({ 
          status: found ? 'found' : 'failed',
          updatedAt: new Date()
        })
        .where(eq(discoveryQueue.id, task.id));

      // Update worker stats
      await this.updateWorkerStats(found);

      console.log(`Completed discovery task for: ${task.query}, found: ${found}`);
      return true;
    } catch (error) {
      console.error(`Error processing discovery task ${task.query}:`, error);

      // Increment attempts and mark as failed if max retries reached
      const updatedAttempts = task.attempts + 1;
      const status = updatedAttempts >= MAX_RETRIES ? 'failed' : 'pending';

      await this.db.update(discoveryQueue)
        .set({ 
          status: status,
          attempts: updatedAttempts,
          lastAttemptAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(discoveryQueue.id, task.id));

      // Update worker stats
      await this.updateWorkerStats(false);

      return false;
    }
  }

  async addToQueue(query: string, type: 'user_search' | 'global_fill', priority: number = 0) {
    // Check if this query is already in the queue
    const existing = await this.db.select({ id: discoveryQueue.id })
      .from(discoveryQueue)
      .where(and(
        eq(discoveryQueue.query, query),
        eq(discoveryQueue.status, 'pending')
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Query "${query}" already in discovery queue, skipping addition`);
      return;
    }

    // Add to queue
    await this.db.insert(discoveryQueue).values({
      query: query,
      type: type,
      priority: priority,
      status: 'pending'
    });

    console.log(`Added query "${query}" to discovery queue (type: ${type}, priority: ${priority})`);
  }

  async run() {
    console.log('Discovery Worker started...');
    
    await this.initialize();

    // Handle graceful shutdown
    const handleShutdown = async () => {
      console.log('Shutting down Discovery Worker...');
      this.shouldStop = true;
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    while (!this.shouldStop) {
      try {
        const processed = await this.processNextTask();
        if (!processed) {
          // No tasks to process, wait before checking again
          console.log(`No tasks to process, sleeping for ${POLL_INTERVAL_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        console.error('Error in discovery worker main loop:', error);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    await this.cleanup();
  }
}

// Export the class for use in other modules
export { DiscoveryWorker };

// If this script is run directly, start the worker
if (require.main === module) {
  const worker = new DiscoveryWorker();
  worker.run().catch(error => {
    console.error('Discovery Worker failed:', error);
    process.exit(1);
  });
}