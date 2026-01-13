import { useEffect } from 'react';

/**
 * Hook to track page views for navigation logging
 * Makes a single GET request to the page-specific endpoint
 * which triggers server-side logging via middleware
 */
export function usePageView(page: 'home' | 'stream' | 'search' | 'shelves' | 'messages') {
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Use direct backend URL in development to bypass Vite proxy
    const apiUrl = import.meta.env.DEV 
      ? `http://localhost:5001/api/page-view/${page}`
      : `/api/page-view/${page}`;

    console.log(`[PageView] Tracking page view: ${page}`);

    // Make GET request to trigger middleware logging
    fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => {
        if (response.ok) {
          console.log(`[PageView] Successfully logged ${page} view`);
        } else {
          console.error(`[PageView] Failed to log ${page} view:`, response.status);
        }
      })
      .catch(error => {
        console.error(`[PageView] Failed to log ${page} view:`, error);
      });
  }, []); // Run once on mount
}
