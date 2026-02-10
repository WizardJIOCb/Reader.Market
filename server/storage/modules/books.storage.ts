import { eq, and, desc, asc, sql, ilike, count } from "drizzle-orm";
import { books, comments, reviews, shelfBooks, readingProgress } from "@shared/schema";
import type { DB } from "../db";
import { BookFileManager } from "../../utils/book-file-manager";
import path from "path";
import fs from "fs";

export function createBooksStorage(db: DB) {
  return {
    async createBook(bookData: any): Promise<any> {
      try {
        // Check if a book with the same title already exists (regardless of author)
        const existingBook = await db.select()
          .from(books)
          .where(eq(books.title, bookData.title))
          .limit(1);
        
        if (existingBook.length > 0) {
          throw new Error(`A book with title "${bookData.title}" already exists`);
        }
        
        const result = await db.insert(books).values(bookData).returning();
        const createdBook = result[0];
        
        // Rename uploaded files to use the book ID as the filename
        if (createdBook.filePath) {
          try {
            // Extract the actual filename from the stored path
            const originalFilename = path.basename(createdBook.filePath);
            const uploadDir = path.dirname(createdBook.filePath).replace(/^\//, ''); // Remove leading slash
            const tempFilePath = path.join(process.cwd(), uploadDir, originalFilename);
            
            console.log(`Attempting to rename book file:`);
            console.log(`  - Book ID: ${createdBook.id}`);
            console.log(`  - Original path: ${createdBook.filePath}`);
            console.log(`  - Temp file path: ${tempFilePath}`);
            console.log(`  - File exists at temp path: ${fs.existsSync(tempFilePath)}`);
            
            // Move the book file to use the book ID in the filename
            const newFilePath = BookFileManager.moveBookFileFromTemp(
              createdBook.id,
              tempFilePath,
              originalFilename
            );
            
            console.log(`  - New file path: ${newFilePath}`);
            
            // Update the database record with the new file path
            const updateResult = await db.update(books)
              .set({ filePath: newFilePath })
              .where(eq(books.id, createdBook.id))
              .returning();
            
            createdBook.filePath = updateResult[0].filePath;
          } catch (fileError) {
            console.error("Error renaming book file:", fileError);
            // Continue with original file path if renaming fails
          }
        }
        
        if (createdBook.coverImageUrl) {
          try {
            // Extract the actual filename from the stored path
            const originalFilename = path.basename(createdBook.coverImageUrl);
            const uploadDir = path.dirname(createdBook.coverImageUrl).replace(/^\//, ''); // Remove leading slash
            const tempFilePath = path.join(process.cwd(), uploadDir, originalFilename);
            
            console.log(`Attempting to rename cover image:`);
            console.log(`  - Book ID: ${createdBook.id}`);
            console.log(`  - Original path: ${createdBook.coverImageUrl}`);
            console.log(`  - Temp file path: ${tempFilePath}`);
            console.log(`  - File exists at temp path: ${fs.existsSync(tempFilePath)}`);
            
            // Move the cover image to use the book ID in the filename
            const newCoverPath = BookFileManager.moveCoverImageFromTemp(
              createdBook.id,
              tempFilePath,
              originalFilename
            );
            
            console.log(`  - New cover path: ${newCoverPath}`);
            
            // Update the database record with the new cover image path
            const updateResult = await db.update(books)
              .set({ coverImageUrl: newCoverPath })
              .where(eq(books.id, createdBook.id))
              .returning();
            
            createdBook.coverImageUrl = updateResult[0].coverImageUrl;
          } catch (fileError) {
            console.error("Error renaming cover image:", fileError);
            // Continue with original cover path if renaming fails
          }
        }
        
        return createdBook;
      } catch (error) {
        console.error("Error creating book:", error);
        throw error;
      }
    },

    async getBook(id: string, userId?: string): Promise<any | undefined> {
      try {
        console.log(`Getting book with ID: ${id}`);
        const result = await db.select().from(books).where(eq(books.id, id));
        console.log(`Database result for book ${id}:`, result[0]);
        if (result[0]) {
          // Get comment count using Drizzle ORM
          const commentCountResult = await db.select({ count: count() })
            .from(comments)
            .where(eq(comments.bookId, result[0].id));
          
          // Get review count using Drizzle ORM
          const reviewCountResult = await db.select({ count: count() })
            .from(reviews)
            .where(eq(reviews.bookId, result[0].id));
          
          // Get the latest comment or review date
          const latestComments = await db.select({ createdAt: comments.createdAt })
            .from(comments)
            .where(eq(comments.bookId, result[0].id))
            .limit(1)
            .orderBy(desc(comments.createdAt));
            
          const latestReviews = await db.select({ createdAt: reviews.createdAt })
            .from(reviews)
            .where(eq(reviews.bookId, result[0].id))
            .limit(1)
            .orderBy(desc(reviews.createdAt));
            
          const latestDate = [
            latestComments[0]?.createdAt,
            latestReviews[0]?.createdAt
          ].filter(Boolean)
           .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
          
          const latestActivityResult = [{ latest_date: latestDate }];
          
          // Get shelf count using Drizzle ORM
          const shelfCountResult = await db.select({ count: count() })
            .from(shelfBooks)
            .where(eq(shelfBooks.bookId, result[0].id));
          
          // Format dates for the frontend
          const formattedBook = {
            ...result[0],
            rating: result[0].rating !== null && result[0].rating !== undefined ? 
              (typeof result[0].rating === 'number' ? result[0].rating : parseFloat(result[0].rating.toString())) : 
              null,
            uploadedAt: result[0].uploadedAt ? result[0].uploadedAt.toISOString() : null,
            publishedAt: result[0].publishedAt ? result[0].publishedAt.toISOString() : null,
            createdAt: result[0].createdAt.toISOString(),
            updatedAt: result[0].updatedAt.toISOString(),
            commentCount: commentCountResult[0]?.count || 0,
            reviewCount: reviewCountResult[0]?.count || 0,
            shelfCount: shelfCountResult[0]?.count || 0,
            lastActivityDate: latestActivityResult[0]?.latest_date ? new Date(latestActivityResult[0].latest_date).toISOString() : null,
          };
          console.log(`Formatted book ${id}:`, formattedBook);
          return formattedBook;
        }
        return result[0];
      } catch (error) {
        console.error("Error getting book:", error);
        return undefined;
      }
    },

    async searchBooks(query: string, sortBy?: string, sortDirection: 'asc' | 'desc' = 'desc'): Promise<any[]> {
      try {
        let result;
        if (query && query.trim() !== '') {
          // First, perform a search based on the query across multiple fields, sorted by rating (descending, nulls last)
          const escapedQuery = query.replace(/[%_]/g, '\\$&');
          const searchPattern = '%' + escapedQuery + '%';
          result = await db.select().from(books).where(
            sql`is_active = true AND (title ILIKE ${searchPattern} OR author ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR genre ILIKE ${searchPattern})`
          ).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
        } else {
          // If no query, return all active books
          result = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`);
        }
        return result;
      } catch (error) {
        console.error("Error searching books:", error);
        return [];
      }
    },

    async deleteBook(id: string, userId: string): Promise<boolean> {
      try {
        // First, get the book to check ownership and get file paths
        const bookResult = await db.select().from(books).where(eq(books.id, id));
        const book = bookResult[0];
        
        if (!book) {
          return false; // Book not found
        }
        
        // Check if the user owns this book
        if (book.userId !== userId) {
          throw new Error("Unauthorized: You can only delete books you uploaded");
        }
        
        // Perform the deletion
        const result = await db.delete(books).where(eq(books.id, id));
        
        // Delete associated files after successful DB deletion
        if (result.rowCount && result.rowCount > 0) {
          try {
            BookFileManager.deleteBookFiles(id);
          } catch (fileError) {
            console.error("Error deleting book files:", fileError);
            // Don't fail the operation if file deletion fails
          }
        }
        
        return (result.rowCount || 0) > 0;
      } catch (error) {
        console.error("Error deleting book:", error);
        throw error;
      }
    },

    async getPopularBooks(sortBy?: string, limit: number = 6): Promise<any[]> {
      try {
        console.log('Fetching popular books');
        
        // Get active books sorted by rating (descending, nulls last), limit to 20
        // Use SQL to ensure null ratings appear last
        const booksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(limit * 2);
        console.log('Found', booksResult.length, 'books before adding counts');
        
        // Format the results and add counts
        const formattedResults = [];
        for (const book of booksResult) {
          try {
            console.log('Processing book:', book.id);
            
            // Get comment count using Drizzle ORM
            const commentCountResult = await db.select({ count: count() })
              .from(comments)
              .where(eq(comments.bookId, book.id));
            
            // Get review count using Drizzle ORM
            const reviewCountResult = await db.select({ count: count() })
              .from(reviews)
              .where(eq(reviews.bookId, book.id));
            
            // Get shelf count using Drizzle ORM
            const shelfCountResult = await db.select({ count: count() })
              .from(shelfBooks)
              .where(eq(shelfBooks.bookId, book.id));
            
            console.log('Counts for book', book.id, ': comments=', commentCountResult[0]?.count || 0, 
                       'reviews=', reviewCountResult[0]?.count || 0, 
                       'shelves=', shelfCountResult[0]?.count || 0);
            
            formattedResults.push({
              ...book,
              rating: book.rating !== null && book.rating !== undefined ? 
                (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
                null,
              uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
              publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
              createdAt: book.createdAt.toISOString(),
              updatedAt: book.updatedAt.toISOString(),
              commentCount: commentCountResult[0]?.count || 0,
              reviewCount: reviewCountResult[0]?.count || 0,
              shelfCount: shelfCountResult[0]?.count || 0,
            });
          } catch (innerError) {
            console.error("Error processing individual book:", book.id, innerError);
            // Add the book with default count values if there's an error processing it
            formattedResults.push({
              ...book,
              rating: book.rating !== null && book.rating !== undefined ? 
                (typeof book.rating === 'number' ? book.rating : parseFloat(book.rating.toString())) : 
                null,
              uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
              publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
              createdAt: book.createdAt.toISOString(),
              updatedAt: book.updatedAt.toISOString(),
              commentCount: 0,
              reviewCount: 0,
              shelfCount: 0,
            });
          }
        }
        
        console.log('Returning', formattedResults.length, 'books from getPopularBooks');
        return formattedResults;
      } catch (error) {
        console.error("Error getting popular books:", error);
        return [];
      }
    },

    async getBooksByGenre(genre: string, sortBy?: string): Promise<any[]> {
      try {
        console.log('Fetching books by genre:', genre);
        
        // Get active books filtered by genre and sorted by rating (descending, nulls last)
        const booksResult = await db.select().from(books).where(sql`is_active = true AND LOWER(genre) LIKE LOWER('%' || ${genre} || '%')`).orderBy(sql`rating DESC NULLS LAST, created_at DESC`).limit(20);
        
        // Format the results
        const formattedResults = booksResult.map(book => ({
          ...book,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString(),
        }));
        
        return formattedResults;
      } catch (error) {
        console.error("Error getting books by genre:", error);
        return [];
      }
    },

    async getRecentlyReviewedBooks(sortBy?: string): Promise<any[]> {
      try {
        console.log('Fetching recently reviewed books');
        
        // Get books that have recent reviews (within last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // First get recent reviews
        const recentReviews = await db.select({
          bookId: reviews.bookId,
          createdAt: reviews.createdAt
        })
        .from(reviews)
        .where(sql`created_at > ${thirtyDaysAgo.toISOString()}`)
        .orderBy(desc(reviews.createdAt))
        .limit(20);

        // Extract unique book IDs from recent reviews
        const uniqueBookIds = Array.from(new Set(recentReviews.map(review => review.bookId)));
        const bookIds = uniqueBookIds;
        
        if (bookIds.length === 0) {
          return [];
        }

        // Get the book details for these IDs
        const booksResult = await db.select().from(books).where(
          sql`id = ANY(ARRAY[${sql.join(bookIds.map(id => sql`${id}`), sql`, `)}]::text[])`
        );

        // Format the results
        const formattedResults = booksResult.map(book => ({
          ...book,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString(),
        }));

        return formattedResults;
      } catch (error) {
        console.error("Error getting recently reviewed books:", error);
        return [];
      }
    },

    async getCurrentUserBooks(userId: string): Promise<any[]> {
      try {
        console.log('Fetching current user books for user ID:', userId);
        
        // Get books that the user is currently reading (have reading progress)
        const readingProgressRecords = await db.select({
          bookId: readingProgress.bookId,
          percentage: readingProgress.percentage,
          currentPage: readingProgress.currentPage,
          totalPages: readingProgress.totalPages,
          lastReadAt: readingProgress.lastReadAt
        })
        .from(readingProgress)
        .where(eq(readingProgress.userId, userId))
        .orderBy(desc(readingProgress.lastReadAt))
        .limit(20);

        // Extract book IDs from reading progress records
        const bookIds = readingProgressRecords.map(record => record.bookId);
        
        if (bookIds.length === 0) {
          return [];
        }

        // Get the book details for these IDs
        const booksResult = await db.select().from(books).where(
          sql`id = ANY(ARRAY[${sql.join(bookIds.map(id => sql`${id}`), sql`, `)}]::text[])`
        );

        // Combine book data with reading progress
        const resultWithProgress = booksResult.map(book => {
          const progress = readingProgressRecords.find(pr => pr.bookId === book.id);
          return {
            ...book,
            readingProgress: progress,
            uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
            publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
            createdAt: book.createdAt.toISOString(),
            updatedAt: book.updatedAt.toISOString(),
          };
        });

        // Sort by last read date (most recent first)
        resultWithProgress.sort((a, b) => {
          if (!a.readingProgress?.lastReadAt) return 1;
          if (!b.readingProgress?.lastReadAt) return -1;
          return new Date(b.readingProgress.lastReadAt).getTime() - new Date(a.readingProgress.lastReadAt).getTime();
        });

        return resultWithProgress;
      } catch (error) {
        console.error("Error getting current user books:", error);
        return [];
      }
    },

    async getNewReleases(sortBy?: string): Promise<any[]> {
      try {
        console.log('Fetching new releases');
        
        // Get active books sorted by created date (descending) - showing newest additions to our system first
        const booksResult = await db.select().from(books).where(sql`is_active = true`).orderBy(desc(books.createdAt)).limit(20);
        console.log('Books result from database:', booksResult.length);
        
        // Format the results
        const formattedResults = booksResult.map(book => ({
          ...book,
          uploadedAt: book.uploadedAt ? book.uploadedAt.toISOString() : null,
          publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
          createdAt: book.createdAt.toISOString(),
          updatedAt: book.updatedAt.toISOString(),
        }));
        
        return formattedResults;
      } catch (error) {
        console.error("Error getting new releases:", error);
        return [];
      }
    },
  };
}

export type BooksStorage = ReturnType<typeof createBooksStorage>;