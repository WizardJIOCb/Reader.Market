import { Switch, Route } from "wouter";
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
import { Navbar } from "@/components/Navbar";

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
      <Route path="/profile/:userId?" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Navbar />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;