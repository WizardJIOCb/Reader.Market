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
  searchBooks: (query: string) => apiCall(`/api/books/search?query=${encodeURIComponent(query)}`),
  uploadBook: (formData: FormData) => apiCall('/api/books/upload', {
    method: 'POST',
    body: formData,
  }),
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
};