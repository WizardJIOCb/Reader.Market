// Shared cache for comments, reviews, and shelves to avoid duplicate API requests
export const dataCache: {
  comments: Record<string, { data: any[], timestamp: number }>;
  reviews: Record<string, { data: any[], timestamp: number }>;
  shelves: { data: any[] | null, timestamp: number };
} = {
  comments: {},
  reviews: {},
  shelves: { data: null, timestamp: 0 }
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

export const setCachedComments = (bookId: string, comments: any[]) => {
  dataCache.comments[bookId] = { data: comments, timestamp: Date.now() };
};

export const setCachedReviews = (bookId: string, reviews: any[]) => {
  dataCache.reviews[bookId] = { data: reviews, timestamp: Date.now() };
};

export const setCachedShelves = (shelves: any[]) => {
  dataCache.shelves = { data: shelves, timestamp: Date.now() };
};

// Check if cached data is stale (older than 30 seconds)
export const isCachedDataStale = (timestamp: number) => {
  return Date.now() - timestamp > 30000; // 30 seconds
};

export const clearCache = (bookId: string) => {
  delete dataCache.comments[bookId];
  delete dataCache.reviews[bookId];
  dataCache.shelves = { data: null, timestamp: 0 };
  // Clear pending requests for this book
  delete pendingRequests[`comments-${bookId}`];
  delete pendingRequests[`reviews-${bookId}`];
};