// Global cache for reading progress to avoid duplicate requests
class ReadingProgressCache {
  private cache: Record<string, any> = {};
  private pendingRequests: Map<string, Promise<any>> = new Map();

  // Get cached progress or fetch if not cached
  async getProgress(bookId: string, userId: string, fetchFunction: () => Promise<any>): Promise<any> {
    const cacheKey = `${userId}-${bookId}`;
    
    // Return cached value if exists
    if (this.cache[cacheKey] !== undefined) {
      return this.cache[cacheKey];
    }
    
    // Return pending request if exists
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }
    
    // Create new request
    const requestPromise = fetchFunction().then(data => {
      // Cache the result
      this.cache[cacheKey] = data;
      // Remove from pending
      this.pendingRequests.delete(cacheKey);
      return data;
    }).catch(error => {
      // Remove from pending on error
      this.pendingRequests.delete(cacheKey);
      throw error;
    });
    
    // Store pending request
    this.pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  // Get user progress with caching (for comments section)
  async getUserProgress(bookId: string, userId: string, fetchFunction: () => Promise<any>): Promise<any> {
    return this.getProgress(bookId, userId, fetchFunction);
  }

  // Clear cache for specific user/book
  clearEntry(userId: string, bookId: string) {
    const cacheKey = `${userId}-${bookId}`;
    delete this.cache[cacheKey];
    this.pendingRequests.delete(cacheKey);
  }

  // Clear all cache
  clearAll() {
    this.cache = {};
    this.pendingRequests.clear();
  }

  // Clear cache for specific user
  clearUserCache(userId: string) {
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(`${userId}-`)) {
        delete this.cache[key];
      }
    });
    
    this.pendingRequests.forEach((_, key) => {
      if (key.startsWith(`${userId}-`)) {
        this.pendingRequests.delete(key);
      }
    });
  }
}

// Export singleton instance
export const readingProgressCache = new ReadingProgressCache();