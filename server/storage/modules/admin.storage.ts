import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, books, articles, bookChatMessages, bookmarkCollections, articleCategories, comments, reviews, bookmarks, readingStatistics, readingProgress, bookViewStatistics, shelfBooks, reactions } from '@shared/schema';
import { eq, desc, asc, sql, and, or, ilike, count } from 'drizzle-orm';

export interface AdminStorage {
  // Book admin operations
  updateBookAdmin(id: string, bookData: any): Promise<any>;
  deleteBookAdmin(id: string): Promise<boolean>;
  getAllBooksWithUploader(limit: number, offset: number, search?: string, sortBy?: string, sortOrder?: string): Promise<{books: any[], total: number}>;

  // Chat message admin operations
  deleteBookChatMessage(id: string, userId: string, isAdminOrModer?: boolean): Promise<boolean>;

  // Article admin operations
  deleteArticleByAdmin(id: string): Promise<boolean>;
  getAllArticlesForAdmin(page: number, limit: number, status?: string): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }>;

  // User admin operations
  updateUserAccessLevel(userId: string, accessLevel: string): Promise<boolean>;
  getAllUsersForAdmin(): Promise<any[]>;

  // Collection admin operations
  getAllCollectionsForAdmin(): Promise<any[]>;
  createCollectionForAdmin(data: any): Promise<any>;
  updateCollectionForAdmin(id: string, data: any): Promise<any>;
  deleteCollectionForAdmin(id: string): Promise<boolean>;

  // Category admin operations
  getAllArticleCategoriesForAdmin(): Promise<any[]>;
  createArticleCategoryForAdmin(data: any): Promise<any>;
  updateArticleCategoryForAdmin(id: string, data: any): Promise<any>;
  deleteArticleCategoryForAdmin(id: string): Promise<boolean>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;
}

export class AdminStorageImpl implements AdminStorage {
  constructor(private db: NodePgDatabase<any>) {}

  async updateBookAdmin(id: string, bookData: any): Promise<any> {
    try {
      const updateData: any = {
        ...bookData,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const result = await this.db.update(books)
        .set(updateData)
        .where(eq(books.id, id))
        .returning();

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      console.error("Error updating book (admin):", error);
      throw error;
    }
  }

  async deleteBookAdmin(id: string): Promise<boolean> {
    try {
      // Delete in the correct order to respect foreign key constraints
      
      // 1. Delete reactions on comments and reviews for this book
      const bookComments = await this.db.select({ id: comments.id }).from(comments).where(eq(comments.bookId, id));
      const bookReviews = await this.db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookId, id));
      
      const commentIds = bookComments.map(c => c.id);
      const reviewIds = bookReviews.map(r => r.id);

      if (commentIds.length > 0) {
        await this.db.delete(reactions).where(sql`${reactions.commentId} IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      if (reviewIds.length > 0) {
        await this.db.delete(reactions).where(sql`${reactions.reviewId} IN (${sql.join(reviewIds.map(id => sql`${id}`), sql`, `)})`);
      }

      // 2. Delete comments
      await this.db.delete(comments).where(eq(comments.bookId, id));

      // 3. Delete reviews
      await this.db.delete(reviews).where(eq(reviews.bookId, id));

      // 4. Delete bookmarks
      await this.db.delete(bookmarks).where(eq(bookmarks.bookId, id));

      // 5. Delete reading statistics
      await this.db.delete(readingStatistics).where(eq(readingStatistics.bookId, id));

      // 6. Delete reading progress
      await this.db.delete(readingProgress).where(eq(readingProgress.bookId, id));

      // 7. Delete book view statistics
      await this.db.delete(bookViewStatistics).where(eq(bookViewStatistics.bookId, id));

      // 8. Delete shelf associations
      await this.db.delete(shelfBooks).where(eq(shelfBooks.bookId, id));

      // 9. Finally delete the book itself
      const result = await this.db.delete(books).where(eq(books.id, id)).returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting book (admin):", error);
      throw error;
    }
  }

  async getAllBooksWithUploader(limit: number, offset: number, search?: string, sortBy?: string, sortOrder?: string): Promise<{books: any[], total: number}> {
    try {
      // First get the total count
      let totalCountQuery = this.db.select({ total: count() }).from(books);
      if (search) {
        totalCountQuery = totalCountQuery.where(ilike(books.title, `%${search}%`));
      }
      const totalCountResult = await totalCountQuery;
      const totalCount = totalCountResult[0]?.total || 0;

      // Then get the actual records
      let query = this.db
        .select({
          id: books.id,
          title: books.title,
          author: books.author,
          uploader: users.username,
          uploaderFullName: users.fullName,
          uploadedAt: books.uploadedAt,
          coverImageUrl: books.coverImageUrl,
          isActive: books.isActive,
          genre: books.genre,
          publishedYear: books.publishedYear,
          rating: sql<number>`CAST(${books.rating} AS REAL)`.as('rating'),
          fileSize: books.fileSize
        })
        .from(books)
        .leftJoin(users, eq(books.userId, users.id));

      if (search) {
        query = query.where(ilike(books.title, `%${search}%`));
      }

      // Apply sorting
      switch (sortBy) {
        case 'title':
          query = query.orderBy(sortOrder === 'desc' ? desc(books.title) : asc(books.title));
          break;
        case 'author':
          query = query.orderBy(sortOrder === 'desc' ? desc(books.author) : asc(books.author));
          break;
        case 'uploadedAt':
        default:
          query = query.orderBy(sortOrder === 'desc' ? desc(books.uploadedAt) : asc(books.uploadedAt));
          break;
      }

      const results = await query.limit(limit).offset(offset);

      return {
        books: results,
        total: totalCount
      };
    } catch (error) {
      console.error("Error getting books with uploader info:", error);
      throw error;
    }
  }

  async deleteBookChatMessage(id: string, userId: string, isAdminOrModer: boolean = false): Promise<boolean> {
    try {
      // Soft delete - allow if user owns the message OR if user is admin/moder
      const whereClause = isAdminOrModer 
        ? eq(bookChatMessages.id, id)
        : and(
            eq(bookChatMessages.id, id),
            eq(bookChatMessages.userId, userId)
          );
      
      const result = await this.db
        .update(bookChatMessages)
        .set({ deletedAt: new Date() })
        .where(whereClause)
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting book chat message:", error);
      return false;
    }
  }

  async deleteArticleByAdmin(id: string): Promise<boolean> {
    try {
      // Admin can delete any article without ownership check
      const result = await this.db.delete(articles)
        .where(eq(articles.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting article by admin:", error);
      return false;
    }
  }

  async getAllArticlesForAdmin(page: number, limit: number, status?: string): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // First get the total count
      let totalCountQuery = this.db.select({ total: count() }).from(articles);
      if (status) {
        totalCountQuery = totalCountQuery.where(eq(articles.status, status));
      }
      const totalCountResult = await totalCountQuery;
      const totalCount = Number(totalCountResult[0]?.total) || 0;

      // Then get the actual records
      let query = this.db.select({
        id: articles.id,
        authorUserId: articles.authorUserId,
        section: articles.section,
        format: articles.format,
        status: articles.status,
        lang: articles.lang,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        coverImageUrl: articles.coverImageUrl,
        contentJson: articles.contentJson,
        searchText: articles.searchText,
        views: articles.views,
        commentsCount: articles.commentsCount,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.id));
      
      if (status) {
        query = query.where(eq(articles.status, status));
      }
      
      // Order by creation date
      query = query.orderBy(desc(articles.createdAt));
      
      const articlesResult = await query.limit(limit).offset(offset);
      
      // Transform the data to match the expected format
      const transformedArticles = articlesResult.map(item => ({
        id: item.id,
        authorUserId: item.authorUserId,
        section: item.section,
        format: item.format,
        status: item.status,
        lang: item.lang,
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        coverImageUrl: item.coverImageUrl,
        contentJson: item.contentJson,
        searchText: item.searchText,
        views: item.views,
        commentsCount: item.commentsCount,
        publishedAt: item.publishedAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: {
          username: item.username || 'Unknown',
          fullName: item.fullName || null,
          avatarUrl: item.avatarUrl || null
        }
      }));
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        articles: transformedArticles,
        total: totalCount,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error("Error getting all articles for admin:", error);
      throw error;
    }
  }

  async updateUserAccessLevel(userId: string, accessLevel: string): Promise<boolean> {
    try {
      const validLevels = ['user', 'moder', 'admin'];
      if (!validLevels.includes(accessLevel)) {
        throw new Error(`Invalid access level: ${accessLevel}`);
      }

      const result = await this.db
        .update(users)
        .set({ accessLevel })
        .where(eq(users.id, userId))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error updating user access level:", error);
      return false;
    }
  }

  async getAllUsersForAdmin(): Promise<any[]> {
    try {
      const usersList = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          accessLevel: users.accessLevel,
          isBlocked: users.isBlocked,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          profileRating: users.profileRating
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      return usersList;
    } catch (error) {
      console.error("Error getting all users for admin:", error);
      throw error;
    }
  }

  async getAllCollectionsForAdmin(): Promise<any[]> {
    try {
      const collections = await this.db
        .select({
          id: bookmarkCollections.id,
          userId: bookmarkCollections.userId,
          name: bookmarkCollections.name,
          description: bookmarkCollections.description,
          color: bookmarkCollections.color,
          isPublic: bookmarkCollections.isPublic,
          coverImageUrl: bookmarkCollections.coverImageUrl,
          viewCount: bookmarkCollections.viewCount,
          createdAt: bookmarkCollections.createdAt,
          updatedAt: bookmarkCollections.updatedAt,
          userName: users.username
        })
        .from(bookmarkCollections)
        .leftJoin(users, eq(bookmarkCollections.userId, users.id))
        .orderBy(desc(bookmarkCollections.createdAt));

      return collections;
    } catch (error) {
      console.error("Error getting all collections for admin:", error);
      throw error;
    }
  }

  async createCollectionForAdmin(data: any): Promise<any> {
    try {
      const [collection] = await this.db
        .insert(bookmarkCollections)
        .values({
          name: data.name,
          description: data.description || null,
          color: data.color || null,
          isPublic: data.isPublic || false,
          coverImageUrl: data.coverImageUrl || null,
          userId: data.userId
        })
        .returning();

      return collection;
    } catch (error) {
      console.error("Error creating collection for admin:", error);
      throw error;
    }
  }

  async updateCollectionForAdmin(id: string, data: any): Promise<any> {
    try {
      const updateData: any = {
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        isPublic: data.isPublic || false,
        coverImageUrl: data.coverImageUrl || null
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const [updatedCollection] = await this.db
        .update(bookmarkCollections)
        .set(updateData)
        .where(eq(bookmarkCollections.id, id))
        .returning();

      return updatedCollection;
    } catch (error) {
      console.error("Error updating collection for admin:", error);
      throw error;
    }
  }

  async deleteCollectionForAdmin(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(bookmarkCollections)
        .where(eq(bookmarkCollections.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting collection for admin:", error);
      return false;
    }
  }

  async getAllArticleCategoriesForAdmin(): Promise<any[]> {
    try {
      const categories = await this.db
        .select({
          id: articleCategories.id,
          parentId: articleCategories.parentId,
          title: articleCategories.title,
          titleEn: articleCategories.titleEn,
          description: articleCategories.description,
          descriptionEn: articleCategories.descriptionEn,
          slug: articleCategories.slug,
          sortOrder: articleCategories.sortOrder,
          createdAt: articleCategories.createdAt,
          updatedAt: articleCategories.updatedAt
        })
        .from(articleCategories)
        .orderBy(asc(articleCategories.sortOrder));

      return categories;
    } catch (error) {
      console.error("Error getting all article categories for admin:", error);
      throw error;
    }
  }

  async createArticleCategoryForAdmin(data: any): Promise<any> {
    try {
      const [category] = await this.db
        .insert(articleCategories)
        .values({
          parentId: data.parentId || null,
          title: data.title,
          titleEn: data.titleEn || null,
          description: data.description || null,
          descriptionEn: data.descriptionEn || null,
          slug: data.slug,
          sortOrder: data.sortOrder || 0
        })
        .returning();

      return category;
    } catch (error) {
      console.error("Error creating article category for admin:", error);
      throw error;
    }
  }

  async updateArticleCategoryForAdmin(id: string, data: any): Promise<any> {
    try {
      const updateData: any = {
        parentId: data.parentId || null,
        title: data.title,
        titleEn: data.titleEn || null,
        description: data.description || null,
        descriptionEn: data.descriptionEn || null,
        slug: data.slug,
        sortOrder: data.sortOrder || 0
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const [updatedCategory] = await this.db
        .update(articleCategories)
        .set(updateData)
        .where(eq(articleCategories.id, id))
        .returning();

      return updatedCategory;
    } catch (error) {
      console.error("Error updating article category for admin:", error);
      throw error;
    }
  }

  async deleteArticleCategoryForAdmin(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(articleCategories)
        .where(eq(articleCategories.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting article category for admin:", error);
      return false;
    }
  }

  async getDashboardStats(): Promise<any> {
    try {
      // Get user count
      const [userCountResult] = await this.db
        .select({ count: count() })
        .from(users);

      // Get book count
      const [bookCountResult] = await this.db
        .select({ count: count() })
        .from(books);

      // Get article count
      const [articleCountResult] = await this.db
        .select({ count: count() })
        .from(articles);

      // Get active users in last 24 hours
      const [activeUsersResult] = await this.db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.lastLoginAt} > NOW() - INTERVAL '1 day'`);

      return {
        totalUsers: userCountResult.count,
        totalBooks: bookCountResult.count,
        totalArticles: articleCountResult.count,
        activeUsersToday: activeUsersResult.count,
        timestamp: new Date()
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }
}

// Factory function to create AdminStorage instance
export function createAdminStorage(db: NodePgDatabase<any>): AdminStorage {
  return new AdminStorageImpl(db);
}
