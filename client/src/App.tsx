import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BookSplashProvider } from "@/lib/bookSplashContext";
import NotFound from "@/pages/not-found";
import Library from "@/pages/Library";
import AboutPage from "@/pages/AboutPage";
import LandingPage from "@/pages/LandingPage";
import OldLandingPage from "@/pages/OldLandingPage";
import Reader from "@/pages/Reader";
import Shelves from "@/pages/Shelves";
import Profile from "@/pages/Profile";
import SearchPage from "@/pages/Search";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import BookDetail from "@/pages/BookDetail";
import AddBook from "@/pages/AddBook";
import AdminDashboard from "@/components/AdminDashboard";
import UserManagement from "@/pages/UserManagement";
import Messages from "@/pages/Messages";
import NewsDetailPage from "@/pages/NewsDetailPage";
import NewsListPage from "@/pages/NewsListPage";
import StreamPage from "@/pages/StreamPage";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useEffect } from "react";
import { initializeSocket, disconnectSocket } from "@/lib/socket";
import { useTranslation } from "react-i18next";
import { apiCall } from "@/lib/api";
function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/early" component={LandingPage} />
      <Route path="/landing" component={OldLandingPage} />
      <Route path="/home" component={Library} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/shelves" component={Shelves} />
      <Route path="/add-book" component={AddBook} />
      <Route path="/search" component={SearchPage} />
      <Route path="/stream" component={StreamPage} />
      <Route path="/book/:bookId" component={BookDetail} />
      <Route path="/read/:bookId/:chapterId" component={Reader} />
      <Route path="/news" component={NewsListPage} />
      <Route path="/news/:id" component={NewsDetailPage} />
      <Route path="/messages" component={Messages} />
      <Route path="/profile/:userId?" component={Profile} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  
  // Handle language parameter from URL - must run BEFORE other effects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get('lang');
    
    console.log('[Language] URL lang param:', langParam);
    console.log('[Language] Current i18n language:', i18n.language);
    console.log('[Language] localStorage i18nextLng:', localStorage.getItem('i18nextLng'));
    
    if (langParam && (langParam === 'ru' || langParam === 'en')) {
      console.log('[Language] Valid lang param detected:', langParam);
      
      // Check if i18n has already loaded with this language
      if (i18n.language !== langParam) {
        console.log('[Language] Language mismatch, i18n.language:', i18n.language, 'param:', langParam);
        
        // Save to localStorage FIRST (i18next uses 'i18nextLng' key)
        localStorage.setItem('i18nextLng', langParam);
        localStorage.setItem('language', langParam);
        
        // Save to user profile if authenticated
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          apiCall('/api/user/preferences', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ language: langParam }),
          }).catch((error) => {
            console.error('Failed to save language preference:', error);
          });
        }
        
        // Reload page to apply language change
        console.log('[Language] Reloading page to apply language change');
        window.location.reload();
      } else {
        console.log('[Language] Language already correct:', langParam);
      }
    }
  }, []); // Empty dependency array - run only once on mount
  
  // Track page views in Yandex Metrika on route change
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ym) {
      (window as any).ym(106177065, 'hit', window.location.pathname);
    }
  }, [location]);
  
  // Check if current page is reader or messages (don't show footer on these pages)
  const isReaderPage = location.startsWith('/read/');
  const isMessagesPage = location.startsWith('/messages');
  
  // Initialize WebSocket connection (works for both authenticated and unauthenticated users)
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    // Initialize socket with token if available, or without token for guest access
    initializeSocket(token || undefined);
    
    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BookSplashProvider>
          <div className="flex flex-col min-h-screen">
            <Toaster />
            <Navbar />
            <main className="flex-1">
              <Router />
            </main>
            {!isReaderPage && !isMessagesPage && <Footer />}
          </div>
        </BookSplashProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;