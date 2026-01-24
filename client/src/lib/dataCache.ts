// Shared cache for comments, reviews, shelves, user profiles, and user reviews to avoid duplicate API requests
export const dataCache: {
  comments: Record<string, { data: any[], timestamp: number }>;
  reviews: Record<string, { data: any[], timestamp: number }>;
  shelves: { data: any[] | null, timestamp: number };
  userProfiles: Record<string, { data: any, timestamp: number }>;
  userReviews: Record<string, { data: any, timestamp: number }>;
} = {
  comments: {},
  reviews: {},
  shelves: { data: null, timestamp: 0 },
  userProfiles: {},
  userReviews: {}
};

// Track pending requests to avoid duplicate requests
const pendingRequests: Record<string, Promise<any> | null> = {};

// Helper to get a unique key for requests
const getRequestKey = (type: string, id?: string) => {
  return id ? `${type}-${id}` : type;
};

// Helper to track pending requests
export const trackPendingRequest = (type: string, id: string | undefined, promise: Promise<any>) => {
  const key = getRequestKey(type, id);
  pendingRequests[key] = promise;
  return promise.finally(() => {
    pendingRequests[key] = null;
  });
};

// Helper to get pending request for user reviews
export const getPendingUserReviewRequest = (bookId: string, userId: string) => {
  const key = `user-review-${bookId}-${userId}`;
  return pendingRequests[key];
};

// Helper to track pending user review request
export const trackPendingUserReviewRequest = (bookId: string, userId: string, promise: Promise<any>) => {
  const key = `user-review-${bookId}-${userId}`;
  pendingRequests[key] = promise;
  return promise.finally(() => {
    pendingRequests[key] = null;
  });
};

// Helper to get pending request
export const getPendingRequest = (type: string, id?: string) => {
  const key = getRequestKey(type, id);
  return pendingRequests[key];
};

// Utility functions to manage the cache
export const getCachedComments = (bookId: string) => {
  const cached = dataCache.comments[bookId];
  return cached ? cached.data : undefined;
};

export const getCachedReviews = (bookId: string) => {
  const cached = dataCache.reviews[bookId];
  return cached ? cached.data : undefined;
};

export const getCachedShelves = () => {
  return dataCache.shelves.data;
};

export const getCachedUserProfile = (userId: string) => {
  const cached = dataCache.userProfiles[userId];
  return cached ? cached.data : undefined;
};

export const getCachedUserReview = (bookId: string, userId: string) => {
  const key = `${bookId}-${userId}`;
  const cached = dataCache.userReviews[key];
  return cached ? cached.data : undefined;
};

export const setCachedComments = (bookId: string, comments: any[]) => {
  dataCache.comments[bookId] = { data: comments, timestamp: Date.now() };
};

export const setCachedReviews = (bookId: string, reviews: any[]) => {
  dataCache.reviews[bookId] = { data: reviews, timestamp: Date.now() };
};

export const setCachedShelves = (shelves: any[]) => {
  dataCache.shelves = { data: shelves, timestamp: Date.now() };
};

export const setCachedUserProfile = (userId: string, profile: any) => {
  dataCache.userProfiles[userId] = { data: profile, timestamp: Date.now() };
};

export const setCachedUserReview = (bookId: string, userId: string, review: any) => {
  const key = `${bookId}-${userId}`;
  dataCache.userReviews[key] = { data: review, timestamp: Date.now() };
};

// Check if cached data is stale (older than 30 seconds)
export const isCachedDataStale = (timestamp: number) => {
  return Date.now() - timestamp > 30000; // 30 seconds
};

// Check if user profile cache is stale (longer timeout for user profiles)
export const isUserProfileStale = (timestamp: number) => {
  return Date.now() - timestamp > 300000; // 5 minutes for user profiles
};

// Check if user review cache is stale
export const isUserReviewStale = (timestamp: number) => {
  return Date.now() - timestamp > 180000; // 3 minutes for user reviews
};

export const clearCache = (bookId: string) => {
  delete dataCache.comments[bookId];
  delete dataCache.reviews[bookId];
  dataCache.shelves = { data: null, timestamp: 0 };
  // Clear pending requests for this book
  delete pendingRequests[`comments-${bookId}`];
  delete pendingRequests[`reviews-${bookId}`];
  // Clear user reviews for this book
  clearUserReviewCache(bookId);
};

// Clear user profile cache (useful for logout or profile updates)
export const clearUserProfileCache = (userId?: string) => {
  if (userId) {
    delete dataCache.userProfiles[userId];
    delete pendingRequests[`users-${userId}`];
  } else {
    // Clear all user profiles
    dataCache.userProfiles = {};
    Object.keys(pendingRequests).forEach(key => {
      if (key.startsWith('users-')) {
        delete pendingRequests[key];
      }
    });
  }
};

// Clear user review cache
export const clearUserReviewCache = (bookId?: string, userId?: string) => {
  if (bookId && userId) {
    const key = `${bookId}-${userId}`;
    delete dataCache.userReviews[key];
    delete pendingRequests[`user-review-${key}`];
  } else if (bookId) {
    // Clear all reviews for a specific book
    Object.keys(dataCache.userReviews).forEach(key => {
      if (key.startsWith(`${bookId}-`)) {
        delete dataCache.userReviews[key];
      }
    });
    Object.keys(pendingRequests).forEach(key => {
      if (key.startsWith(`user-review-${bookId}-`)) {
        delete pendingRequests[key];
      }
    });
  } else {
    // Clear all user reviews
    dataCache.userReviews = {};
    Object.keys(pendingRequests).forEach(key => {
      if (key.startsWith('user-review-')) {
        delete pendingRequests[key];
      }
    });
  }
};

// Export all cache functions
export { pendingRequests, getRequestKey };