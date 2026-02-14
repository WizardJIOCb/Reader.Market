import { db } from '../db';
import { books, articles, users, comments, reviews, news } from '@shared/schema';
import { eq, and, or, desc, asc, sql, count, ilike, like } from 'drizzle-orm';

export interface SearchServiceInterface {
  // Global search
  globalSearch(query: string, userId?: string, limit?: number, offset?: number): Promise<any>;
  searchBooks(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchArticles(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchUsers(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchComments(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchReviews(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchNews(query: string, limit?: number, offset?: number): Promise<any[]>;
  searchBooksCount(query: string): Promise<number>;
  searchArticlesCount(query: string): Promise<number>;
  searchUsersCount(query: string): Promise<number>;
}

export function createSearchService() {
  return {
    // Global search across all entities
    async globalSearch(query: string, userId?: string, limit: number = 10, offset: number = 0) {
      try {
        // Search in different entities and combine results
        const searchResults = {
          books: await this.searchBooks(query, Math.floor(limit / 3), offset),
          articles: await this.searchArticles(query, Math.floor(limit / 3), offset),
          users: await this.searchUsers(query, Math.floor(limit / 3), offset)
        };

        // Also include counts for each type
        const counts = {
          books: await this.searchBooksCount(query),
          articles: await this.searchArticlesCount(query),
          users: await this.searchUsersCount(query)
        };

        return {
          results: searchResults,
          counts,
          query,
          totalResults: Object.values(counts).reduce((sum, count) => sum + count, 0)
        };
      } catch (error) {
        console.error('Error in global search:', error);
        throw error;
      }
    },

    async searchBooks(query: string, limit: number = 10, offset: number = 0) {
      try {
        const searchPattern = `%${query}%`;
        
        const booksResult = await db
          .select({
            id: books.id,
            title: books.title,
            author: books.author,
            description: books.description,
            coverImageUrl: books.coverImageUrl,
            videoCoverUrl: books.videoCoverUrl,
            filePath: books.filePath,
            fileSize: books.fileSize,
            fileType: books.fileType,
            language: books.language,
            genre: books.genre,
            publishedYear: books.publishedYear,
            rating: books.rating,
            userId: books.userId,
            uploadedAt: books.uploadedAt,
            publishedAt: books.publishedAt,
            isActive: books.isActive,
            createdAt: books.createdAt,
            updatedAt: books.updatedAt
          })
          .from(books)
          .where(or(
            ilike(books.title, searchPattern),
            ilike(books.author, searchPattern),
            ilike(books.description, searchPattern),
            ilike(books.genre, searchPattern)
          ))
          .orderBy(desc(books.rating))
          .limit(limit)
          .offset(offset);

        return booksResult;
      } catch (error) {
        console.error('Error searching books:', error);
        throw error;
      }
    },

    async searchArticles(query: string, limit: number = 10, offset: number = 0) {
      try {
        const searchPattern = `%${query}%`;
        
        // Since we don't have articles table in the schema in this context, we'll return empty for now
        // In a real implementation, this would query the articles table
        return [];
      } catch (error) {
        console.error('Error searching articles:', error);
        throw error;
      }
    },

    async searchUsers(query: string, limit: number = 10, offset: number = 0) {
      try {
        const searchPattern = `%${query}%`;
        
        const usersResult = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            email: users.email,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            accessLevel: users.accessLevel,
            profileRating: users.profileRating,
            profileViewCount: users.profileViewCount,
            language: users.language,
            lastLoginAt: users.lastLoginAt,
            lastActivityAt: users.lastActivityAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
          })
          .from(users)
          .where(or(
            ilike(users.username, searchPattern),
            ilike(users.fullName, searchPattern),
            ilike(users.bio, searchPattern)
          ))
          .orderBy(desc(users.profileViewCount))
          .limit(limit)
          .offset(offset);

        return usersResult;
      } catch (error) {
        console.error('Error searching users:', error);
        throw error;
      }
    },

    async searchComments(query: string, limit: number = 10, offset: number = 0) {
      try {
        // Since we don't have comments table in the schema in this context, we'll return empty
        // In a real implementation, this would query the comments table
        return [];
      } catch (error) {
        console.error('Error searching comments:', error);
        throw error;
      }
    },

    async searchReviews(query: string, limit: number = 10, offset: number = 0) {
      try {
        // Since we don't have reviews table in the schema in this context, we'll return empty
        // In a real implementation, this would query the reviews table
        return [];
      } catch (error) {
        console.error('Error searching reviews:', error);
        throw error;
      }
    },

    async searchNews(query: string, limit: number = 10, offset: number = 0) {
      try {
        // Since we don't have news table in the schema in this context, we'll return empty
        // In a real implementation, this would query the news table
        return [];
      } catch (error) {
        console.error('Error searching news:', error);
        throw error;
      }
    },

    // Helper methods to get counts
    async searchBooksCount(query: string) {
      try {
        const searchPattern = `%${query}%`;
        
        const [result] = await db
          .select({ count: count(books.id) })
          .from(books)
          .where(or(
            ilike(books.title, searchPattern),
            ilike(books.author, searchPattern),
            ilike(books.description, searchPattern),
            ilike(books.genre, searchPattern)
          ));

        return Number(result.count);
      } catch (error) {
        console.error('Error counting search books:', error);
        throw error;
      }
    },

    async searchArticlesCount(query: string) {
      try {
        // Placeholder implementation
        return 0;
      } catch (error) {
        console.error('Error counting search articles:', error);
        throw error;
      }
    },

    async searchUsersCount(query: string) {
      try {
        const searchPattern = `%${query}%`;
        
        const [result] = await db
          .select({ count: count(users.id) })
          .from(users)
          .where(or(
            ilike(users.username, searchPattern),
            ilike(users.fullName, searchPattern),
            ilike(users.bio, searchPattern)
          ));

        return Number(result.count);
      } catch (error) {
        console.error('Error counting search users:', error);
        throw error;
      }
    }
  } as SearchServiceInterface;
}