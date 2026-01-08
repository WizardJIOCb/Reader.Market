import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useEffect } from "react";
import { initializeSocket, disconnectSocket } from "@/lib/socket";

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
      <Route path="/book/:bookId" component={BookDetail} />
      <Route path="/read/:bookId/:chapterId" component={Reader} />
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
  
  // Check if current page is reader or messages (don't show footer on these pages)
  const isReaderPage = location.startsWith('/read/');
  const isMessagesPage = location.startsWith('/messages');
  
  // Initialize WebSocket connection when user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      initializeSocket(token);
    }
    
    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col min-h-screen">
          <Toaster />
          <Navbar />
          <main className="flex-1">
            <Router />
          </main>
          {!isReaderPage && !isMessagesPage && <Footer />}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;