import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { articles, articleCategories, articleTags, articleTagLinks, articleBooks, articleViews, articleReadLater, users } from '@shared/schema';
import { eq, and, or, desc, asc, sql, ilike } from 'drizzle-orm';
import { db } from '../db';

export interface ArticlesServiceInterface {
  // Article operations
  getArticles(limit: number, offset: number, category?: string, author?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', searchQuery?: string, currentUserId?: string): Promise<any[]>;
  getArticlesCount(category?: string, author?: string, searchQuery?: string): Promise<number>;
  getArticleById(id: string): Promise<any | null>;
  getArticleByIdentifier(identifier: string, currentUserId?: string): Promise<any | null>;
  createArticle(articleData: any): Promise<any>;
  updateArticle(id: string, articleData: any): Promise<any>;
  deleteArticle(id: string): Promise<void>;
  publishArticle(id: string): Promise<any>;
  registerArticleView(id: string, userId?: string): Promise<void>;

  // Article comment operations
  incrementArticleCommentCount(articleId: string): Promise<void>;

  // Article Categories operations
  getArticleCategories(): Promise<any[]>;
  getArticleCategoryById(id: string): Promise<any | null>;
  createArticleCategory(categoryData: any): Promise<any>;
  updateArticleCategory(id: string, categoryData: any): Promise<any>;
  deleteArticleCategory(id: string): Promise<void>;
}

export class ArticlesService implements ArticlesServiceInterface {
  constructor(private database: NodePgDatabase<any> = db) {}

  async getArticles(limit: number, offset: number, category?: string, author?: string, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc', searchQuery?: string, currentUserId?: string): Promise<any[]> {
    try {
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Error getting articles:', error);
      throw error;
    }
  }

  async getArticlesCount(category?: string, author?: string, searchQuery?: string): Promise<number> {
    try {
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      console.error('Error getting articles count:', error);
      throw error;
    }
  }

  async getArticleById(id: string): Promise<any | null> {
    try {
      const result = await this.database
        .select()
        .from(articles)
        .where(eq(articles.id, id));
      
      if (result.length === 0) {
        return null;
      }
      
      const article = result[0];
      
      // Get author info separately
      const authorResult = await this.database
        .select({ id: users.id, username: users.username, fullName: users.fullName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, article.authorUserId));
      
      return {
        ...article,
        likes: article.likes || 0,
        bookmarkCount: article.bookmarkCount || 0,
        author: authorResult[0] || null
      };
    } catch (error) {
      console.error('Error getting article by ID:', error);
      throw error;
    }
  }

  async getArticleByIdentifier(identifier: string, currentUserId?: string): Promise<any | null> {
    try {
      // Could be either ID or slug
      const result = await this.database
        .select()
        .from(articles)
        .where(or(eq(articles.id, identifier), eq(articles.slug, identifier)));
      
      if (result.length === 0) {
        return null;
      }
      
      const article = result[0];
      
      // Get author info separately
      const authorResult = await this.database
        .select({ id: users.id, username: users.username, fullName: users.fullName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, article.authorUserId));
      
      return {
        ...article,
        likes: article.likes || 0,
        bookmarkCount: article.bookmarkCount || 0,
        author: authorResult[0] || null
      };
    } catch (error) {
      console.error('Error getting article by identifier:', error);
      throw error;
    }
  }

  async createArticle(articleData: any): Promise<any> {
    try {
      const result = await this.database
        .insert(articles)
        .values(articleData)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating article:', error);
      throw error;
    }
  }

  async updateArticle(id: string, articleData: any): Promise<any> {
    try {
      const result = await this.database
        .update(articles)
        .set(articleData)
        .where(eq(articles.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating article:', error);
      throw error;
    }
  }

  async deleteArticle(id: string): Promise<void> {
    try {
      await this.database
        .delete(articles)
        .where(eq(articles.id, id));
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  }

  async publishArticle(id: string): Promise<any> {
    try {
      const result = await this.database
        .update(articles)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(articles.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error publishing article:', error);
      throw error;
    }
  }

  async registerArticleView(id: string, userId?: string): Promise<void> {
    try {
      // Increment the view count
      await this.database
        .update(articles)
        .set({ views: sql`${articles.views} + 1` })
        .where(eq(articles.id, id));
      
      // If userId is provided, record the view in articleViews table to prevent duplicates
      if (userId) {
        await this.database
          .insert(articleViews)
          .values({ articleId: id, userId })
          .onConflictDoNothing(); // Skip insert if there's a conflict (user already viewed)
      }
    } catch (error) {
      console.error('Error registering article view:', error);
      throw error;
    }
  }

  async getArticleCategories(): Promise<any[]> {
    try {
      const result = await this.database
        .select()
        .from(articleCategories);
      
      return result;
    } catch (error) {
      console.error('Error getting article categories:', error);
      throw error;
    }
  }

  async getArticleCategoryById(id: string): Promise<any | null> {
    try {
      const result = await this.database
        .select()
        .from(articleCategories)
        .where(eq(articleCategories.id, id));
      
      if (result.length === 0) {
        return null;
      }
      
      return result[0];
    } catch (error) {
      console.error('Error getting article category by ID:', error);
      throw error;
    }
  }

  async createArticleCategory(categoryData: any): Promise<any> {
    try {
      const result = await this.database
        .insert(articleCategories)
        .values(categoryData)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating article category:', error);
      throw error;
    }
  }

  async updateArticleCategory(id: string, categoryData: any): Promise<any> {
    try {
      const result = await this.database
        .update(articleCategories)
        .set(categoryData)
        .where(eq(articleCategories.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating article category:', error);
      throw error;
    }
  }

  async deleteArticleCategory(id: string): Promise<void> {
    try {
      await this.database
        .delete(articleCategories)
        .where(eq(articleCategories.id, id));
    } catch (error) {
      console.error('Error deleting article category:', error);
      throw error;
    }
  }

  // Article Comments operations
  async getArticleComments(articleId: string, currentUserId?: string, limit: number = 50, offset: number = 0, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc'): Promise<any[]> {
    try {
      // Since we have a separate comments storage, we could call it here
      // But for now, we'll return an empty array as the route uses comments storage directly
      // In a full implementation, this would aggregate comments for the article
      return [];
    } catch (error) {
      console.error('Error getting article comments:', error);
      throw error;
    }
  }

  async getArticleCommentsCount(articleId: string): Promise<number> {
    try {
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      console.error('Error getting article comments count:', error);
      throw error;
    }
  }

  async createArticleComment(commentData: any): Promise<any> {
    try {
      // Since we have a separate comments storage, delegate to it
      // In a full implementation, this would create a comment specifically for an article
      return commentData;
    } catch (error) {
      console.error('Error creating article comment:', error);
      throw error;
    }
  }

  // Article Reactions operations
  async getArticleReactions(articleId: string, currentUserId?: string): Promise<any[]> {
    try {
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Error getting article reactions:', error);
      throw error;
    }
  }

  async getArticleReactionsDetail(articleId: string, currentUserId?: string): Promise<any> {
    try {
      // For now, return empty object as placeholder
      return {};
    } catch (error) {
      console.error('Error getting article reactions detail:', error);
      throw error;
    }
  }

  // Read Later operations
  async addArticleToReadLater(articleId: string, userId: string): Promise<void> {
    try {
      // Check if already exists
      const existing = await this.database
        .select()
        .from(articleReadLater)
        .where(and(eq(articleReadLater.articleId, articleId), eq(articleReadLater.userId, userId)));
      
      if (existing.length === 0) {
        await this.database
          .insert(articleReadLater)
          .values({ articleId, userId });
      }
    } catch (error) {
      console.error('Error adding article to read later:', error);
      throw error;
    }
  }

  async removeArticleFromReadLater(articleId: string, userId: string): Promise<void> {
    try {
      await this.database
        .delete(articleReadLater)
        .where(and(eq(articleReadLater.articleId, articleId), eq(articleReadLater.userId, userId)));
    } catch (error) {
      console.error('Error removing article from read later:', error);
      throw error;
    }
  }

  async getUserReadLaterArticles(userId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const result = await this.database
        .select({ articles: articles })
        .from(articleReadLater)
        .innerJoin(articles, eq(articles.id, articleReadLater.articleId))
        .where(eq(articleReadLater.userId, userId))
        .orderBy(desc(articles.createdAt))
        .limit(limit)
        .offset(offset);
      
      return result.map(item => item.articles);
    } catch (error) {
      console.error('Error getting user read later articles:', error);
      throw error;
    }
  }

  async getUserReadLaterArticlesCount(userId: string): Promise<number> {
    try {
      const result = await this.database
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(articleReadLater)
        .where(eq(articleReadLater.userId, userId));
      
      return Number(result[0].count);
    } catch (error) {
      console.error('Error getting user read later articles count:', error);
      throw error;
    }
  }

  // Article-Book relations
  async getBooksInArticle(articleId: string): Promise<any[]> {
    try {
      const result = await this.database
        .select()
        .from(articleBooks)
        .where(eq(articleBooks.articleId, articleId));
      
      return result;
    } catch (error) {
      console.error('Error getting books in article:', error);
      throw error;
    }
  }

  async addBookToArticle(articleId: string, bookId: string): Promise<void> {
    try {
      await this.database
        .insert(articleBooks)
        .values({ articleId, bookId, role: 'in_list' });
    } catch (error) {
      console.error('Error adding book to article:', error);
      throw error;
    }
  }

  async removeBookFromArticle(articleId: string, bookId: string): Promise<void> {
    try {
      await this.database
        .delete(articleBooks)
        .where(and(eq(articleBooks.articleId, articleId), eq(articleBooks.bookId, bookId)));
    } catch (error) {
      console.error('Error removing book from article:', error);
      throw error;
    }
  }

  // Increment comment count for an article
  async incrementArticleCommentCount(articleId: string): Promise<void> {
    try {
      await this.database
        .update(articles)
        .set({ commentsCount: sql`${articles.commentsCount} + 1` })
        .where(eq(articles.id, articleId));
    } catch (error) {
      console.error('Error incrementing article comment count:', error);
      throw error;
    }
  }
}

export const createArticlesService = (database: NodePgDatabase<any> = db) => new ArticlesService(database);