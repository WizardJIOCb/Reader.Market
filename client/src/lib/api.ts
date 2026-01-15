// API utility functions using relative paths for production compatibility

const API_BASE_URL = '';

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get auth token from localStorage
  const token = localStorage.getItem('authToken');
  
  return fetch(url, {
    ...options,
    headers: {
      // Only set Content-Type to application/json if it's not a FormData request
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      // Add Authorization header if token exists
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

export const authApi = {
  login: (username: string, password: string) => 
    apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
    
  register: (username: string, password: string, email?: string, fullName?: string) => 
    apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, fullName }),
    }),
};

export const booksApi = {
  getBooksByIds: () => apiCall('/api/books/by-ids'),
  getPopularBooks: () => apiCall('/api/books/popular'),
  getBooksByGenre: (genre: string) => apiCall(`/api/books/genre/${encodeURIComponent(genre)}`),
  getRecentlyReviewed: () => apiCall('/api/books/recently-reviewed'),
  getCurrentlyReading: () => apiCall('/api/books/currently-reading'),
  getNewReleases: () => apiCall('/api/books/new-releases'),
  getBookById: (bookId: string) => apiCall(`/api/books/${bookId}`),
  searchBooks: (query: string, sortBy?: string, sortDirection?: 'asc' | 'desc') => {
    const params = new URLSearchParams({ query: query });
    if (sortBy) params.append('sortBy', sortBy);
    if (sortDirection) params.append('sortDirection', sortDirection);
    return apiCall(`/api/books/search?${params.toString()}`);
  },
  // Use direct backend URL for file uploads to bypass Vite proxy which can corrupt multipart form data
  uploadBook: (formData: FormData) => {
    const token = localStorage.getItem('authToken');
    // In development, bypass Vite proxy for file uploads
    const apiUrl = import.meta.env.DEV 
      ? 'http://localhost:5001/api/books/upload'
      : '/api/books/upload';
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  },
  trackBookView: (bookId: string, viewType: 'card_view' | 'reader_open') => apiCall(`/api/books/${bookId}/track-view`, {
    method: 'POST',
    body: JSON.stringify({ viewType }),
  }),
  getBookStats: (bookId: string) => apiCall(`/api/books/${bookId}/stats`),
  // Use direct backend URL for delete to bypass Vite proxy which can have issues with DELETE requests
  deleteBook: (bookId: string) => {
    const token = localStorage.getItem('authToken');
    // In development, bypass Vite proxy for DELETE requests
    const apiUrl = import.meta.env.DEV 
      ? `http://localhost:5001/api/books/${bookId}`
      : `/api/books/${bookId}`;
    return fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
  },
};

export const shelvesApi = {
  getShelves: () => apiCall('/api/shelves'),
  createShelf: (shelfData: any) => apiCall('/api/shelves', {
    method: 'POST',
    body: JSON.stringify(shelfData),
  }),
  updateShelf: (id: string, shelfData: any) => apiCall(`/api/shelves/${id}`, {
    method: 'PUT',
    body: JSON.stringify(shelfData),
  }),
  deleteShelf: (id: string) => apiCall(`/api/shelves/${id}`, {
    method: 'DELETE',
  }),
  addBookToShelf: (shelfId: string, bookId: string) => apiCall(`/api/shelves/${shelfId}/books/${bookId}`, {
    method: 'POST',
  }),
  removeBookFromShelf: (shelfId: string, bookId: string) => apiCall(`/api/shelves/${shelfId}/books/${bookId}`, {
    method: 'DELETE',
  }),
};

export const reviewsApi = {
  getBookReviews: (bookId: string) => apiCall(`/api/books/${bookId}/reviews`),
  createReview: (bookId: string, reviewData: any) => apiCall(`/api/books/${bookId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  }),
  updateReview: (reviewId: string, reviewData: any) => apiCall(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify(reviewData),
  }),
  deleteReview: (reviewId: string) => apiCall(`/api/reviews/${reviewId}`, {
    method: 'DELETE',
  }),
  // Admin-specific endpoints
  adminUpdateReview: (reviewId: string, reviewData: any) => apiCall(`/api/admin/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify(reviewData),
  }),
  adminDeleteReview: (reviewId: string) => apiCall(`/api/admin/reviews/${reviewId}`, {
    method: 'DELETE',
  }),
};

// Reader API for reading progress, settings, and bookmarks
export const readerApi = {
  // Reading Progress
  getProgress: (bookId: string) => apiCall(`/api/books/${bookId}/reading-progress`),
  
  updateProgress: (bookId: string, data: {
    currentPage?: number;
    totalPages?: number;
    percentage?: number;
    chapterIndex?: number;
  }) => apiCall(`/api/books/${bookId}/reading-progress`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Reader Settings
  getSettings: (bookId: string) => apiCall(`/api/books/${bookId}/reader-settings`),
  
  updateSettings: (bookId: string, settings: {
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    theme?: 'light' | 'dark' | 'sepia';
    margins?: number;
    textAlign?: 'left' | 'justify';
    paragraphIndent?: number;
    viewMode?: 'paginated' | 'scroll';
    showProgressBar?: boolean;
  }) => apiCall(`/api/books/${bookId}/reader-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // Bookmarks
  getBookmarks: (bookId: string) => apiCall(`/api/books/${bookId}/bookmarks`),
  
  createBookmark: (bookId: string, data: {
    title: string;
    chapterIndex?: number;
    percentage?: number;
    selectedText?: string;
    pageInChapter?: number;
  }) => apiCall(`/api/books/${bookId}/bookmarks`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  deleteBookmark: (bookmarkId: string) => apiCall(`/api/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  }),
  
  updateBookmark: (bookmarkId: string, title: string) => apiCall(`/api/bookmarks/${bookmarkId}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  }),
  
  // Book Chat
  getChatMessages: (bookId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return apiCall(`/api/books/${bookId}/chat${query ? '?' + query : ''}`);
  },
  
  getOnlineUsers: (bookId: string) => apiCall(`/api/books/${bookId}/chat/online`),
};

export const commentsApi = {
  getBookComments: (bookId: string) => apiCall(`/api/books/${bookId}/comments`),
  createComment: (bookId: string, commentData: any) => apiCall(`/api/books/${bookId}/comments`, {
    method: 'POST',
    body: JSON.stringify(commentData),
  }),
  updateComment: (commentId: string, commentData: any) => apiCall(`/api/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify(commentData),
  }),
  deleteComment: (commentId: string) => apiCall(`/api/comments/${commentId}`, {
    method: 'DELETE',
  }),
  // Admin-specific endpoints
  adminUpdateComment: (commentId: string, commentData: any) => apiCall(`/api/admin/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify(commentData),
  }),
  adminDeleteComment: (commentId: string) => apiCall(`/api/admin/comments/${commentId}`, {
    method: 'DELETE',
  }),
};

export const messagesApi = {
  // Send a new message
  sendMessage: (recipientId: string, content: string) => apiCall('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId, content }),
  }),
  
  // Get messages with a specific user
  getMessagesWithUser: (userId: string) => apiCall(`/api/messages/${userId}`),
  
  // Get conversations for current user
  getConversations: () => apiCall('/api/conversations'),
  
  // Mark message as read
  markMessageAsRead: (messageId: string) => apiCall(`/api/messages/${messageId}/read`, {
    method: 'PUT',
  }),
  
  // Get unread messages count
  getUnreadCount: () => apiCall('/api/messages/unread-count'),
  
  // Admin-specific endpoints
  adminDeleteMessage: (messageId: string) => apiCall(`/api/admin/messages/${messageId}`, {
    method: 'DELETE',
  }),
};

export const adminBooksApi = {
  getAllBooks: (params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const queryString = queryParams.toString();
    return apiCall(`/api/admin/books${queryString ? '?' + queryString : ''}`);
  },
  
  updateBook: (bookId: string, bookData: FormData) => apiCall(`/api/admin/books/${bookId}`, {
    method: 'PUT',
    body: bookData,
  }),
  
  deleteBook: (bookId: string) => apiCall(`/api/admin/books/${bookId}`, {
    method: 'DELETE',
  }),
};

export const newsReactionsApi = {
  getNewsReactions: (newsId: string) => apiCall(`/api/admin/news/${newsId}/reactions`),
  
  updateNewsReactionCount: (newsId: string, reactionCount: number) => apiCall(`/api/admin/news/${newsId}/reaction-count`, {
    method: 'PUT',
    body: JSON.stringify({ reactionCount }),
  }),
  
  deleteReaction: (reactionId: string) => apiCall(`/api/admin/reactions/${reactionId}`, {
    method: 'DELETE',
  }),
};