import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BookSplashProvider } from "@/lib/bookSplashContext";
import { StreamNotificationsProvider } from "@/lib/streamNotifications";
import { MessageNotificationProvider } from "@/components/MessageNotificationProvider";
import { WebSocketDebugger } from "@/components/WebSocketDebugger";
import { useAuth } from "@/lib/auth";
import { frontendLogger } from "@/lib/frontendLogger";
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
import AuthCallback from "@/pages/AuthCallback";
import BookDetail from "@/pages/BookDetail";
import AddBook from "@/pages/AddBook";
import AdminDashboard from "@/components/AdminDashboard";
import UserManagement from "@/pages/UserManagement";
import RatingSystemSettings from "@/pages/RatingSystemSettings";
import UserRatingSystemSettings from "@/pages/UserRatingSystemSettings";
import Messages from "@/pages/Messages";
import NewsDetailPage from "@/pages/NewsDetailPage";
import NewsListPage from "@/pages/NewsListPage";
import StreamPage from "@/pages/StreamPage";
import PublicUsers from "@/pages/PublicUsers";
import { BookmarkCollectionsPage } from "@/pages/BookmarkCollectionsPage";
import { CreateCollectionPage } from "@/pages/CreateCollectionPage";
import { CollectionDetailPage } from "@/pages/CollectionDetailPage";
import { EditCollectionPage } from "@/pages/EditCollectionPage";
import { ArticlesPage } from "@/pages/ArticlesPage";
import { ArticleDetailPage } from "@/pages/ArticleDetailPage";
import { ArticleEditorPage } from "@/pages/ArticleEditorPage";
import { ReadLaterPage } from "@/pages/ReadLaterPage";
import { AdminArticlesPage } from "@/pages/admin/AdminArticlesPage";
import { AdminCategoriesPage } from "@/pages/admin/AdminCategoriesPage";
import GitHistoryPage from "@/pages/GitHistoryPage";
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
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/shelves" component={Shelves} />
      <Route path="/add-book" component={AddBook} />
      <Route path="/search" component={SearchPage} />
      <Route path="/stream" component={StreamPage} />
      <Route path="/users" component={PublicUsers} />
      <Route path="/book/:bookId" component={BookDetail} />
      <Route path="/read/:bookId/:chapterId" component={Reader} />
      <Route path="/news" component={NewsListPage} />
      <Route path="/news/:id" component={NewsDetailPage} />
      <Route path="/messages" component={Messages} />
      <Route path="/collections" component={BookmarkCollectionsPage} />
      <Route path="/collections/create" component={CreateCollectionPage} />
      <Route path="/collections/:id" component={CollectionDetailPage} />
      <Route path="/collections/:id/edit" component={EditCollectionPage} />
      <Route path="/articles" component={ArticlesPage} />
      <Route path="/articles/new" component={ArticleEditorPage} />
      <Route path="/articles/edit/:slug" component={ArticleEditorPage} />
      <Route path="/articles/read-later" component={ReadLaterPage} />
      <Route path="/articles/:slug" component={ArticleDetailPage} />
      <Route path="/profile/:userId?" component={Profile} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/admin/articles" component={AdminArticlesPage} />
      <Route path="/admin/articles/categories" component={AdminCategoriesPage} />
      <Route path="/admin/rating-system" component={RatingSystemSettings} />
      <Route path="/admin/user-rating-system" component={UserRatingSystemSettings} />
      <Route path="/git-to-gpt" component={GitHistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  
  // Debug logging for message notifications
  useEffect(() => {
    
    
    
    
  }, [user, isLoading]);
  
  // Initialize frontend logger
  useEffect(() => {
    // Logger is initialized when imported, but we can add app-specific initialization here
    frontendLogger.info('app', 'Application started', {
      location: window.location.href,
      userAgent: navigator.userAgent
    });
  }, []);
  
  // Handle language parameter from URL - must run BEFORE other effects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get('lang');
    
    if (langParam && (langParam === 'ru' || langParam === 'en')) {
      // Check if i18n has already loaded with this language
      if (i18n.language !== langParam) {
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
        window.location.reload();
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
          <StreamNotificationsProvider key={`stream-${user?.id || 'no-user'}`} currentUserId={user?.id}>
            {/* Message notification provider wraps entire app */}
            <MessageNotificationProvider key={`msg-${user?.id || 'no-user'}`} currentUserId={user?.id}>
              <WebSocketDebugger />
              <div className="flex flex-col min-h-screen">
                <Toaster />
                <Navbar />
                <main className="flex-1 pt-14">
                  <Router />
                </main>
                {!isReaderPage && !isMessagesPage && <Footer />}
              </div>
            </MessageNotificationProvider>
          </StreamNotificationsProvider>
        </BookSplashProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;