import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { mockBookmarks, Bookmark } from '@/lib/mockData';
import { EnhancedBookReader } from '@/components/ebook-reader/EnhancedBookReader';
import { AISidebar } from '@/components/AISidebar';
import { BookmarksPanel } from '@/components/BookmarksPanel';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft, ArrowRight, Type } from 'lucide-react';
import { Link } from 'wouter';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { booksApi } from '@/lib/api';

// Define the Book interface to match our database schema
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  genre?: string;
  publishedYear?: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
  cardViewCount?: number;
  readerOpenCount?: number;
}

export default function Reader() {
  const [match, params] = useRoute('/read/:bookId/:position');
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(mockBookmarks);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Ref for the EnhancedBookReader component
  const readerRef = useRef<any>(null);
  
  // Ref for stable toast function reference
  const toastRef = useRef(toast);
  
  // State for book data
  const [book, setBook] = useState<Book | null>(null);
  const [bookUrl, setBookUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const bookId = params?.bookId || '';
  
  // Position can be either a page number, position identifier, or character index
  const positionParam = params?.position || '';
  
  // Update bookUrl when book data changes
  useEffect(() => {
    if (book && book.filePath) {
      // For FB2 files, we don't need to encode slashes as they should be preserved
      const url = `/${book.filePath}`;
      console.log('Setting bookUrl to:', url);
      setBookUrl(url);
    } else {
      setBookUrl('');
    }
  }, [book]);
  
  // Log when bookUrl changes
  useEffect(() => {
    console.log('Book URL updated:', bookUrl);
  }, [bookUrl]);
  
  // Ref to track if reader open has already been tracked for current book
  const readerOpenTrackedRef = useRef<Set<string>>(new Set());
  
  // Ref to track if a fetch is currently in progress for a book
  const readerFetchInProgressRef = useRef<Set<string>>(new Set());
  
  // Ref to track the previous bookId to know when it changes
  const prevBookIdRef = useRef<string | null>(null);
  
  // Update toast ref when toast changes
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  // Fetch book data
  useEffect(() => {
    // Check if the bookId has changed and reset tracking if it has
    if (prevBookIdRef.current !== bookId) {
      // New book is being accessed, reset tracking for the new book
      readerOpenTrackedRef.current.delete(bookId);
      prevBookIdRef.current = bookId;
    }
    
    const fetchBook = async () => {
      if (!bookId) return;
      
      // Prevent duplicate fetches for the same book
      if (readerFetchInProgressRef.current.has(bookId)) {
        return; // Already fetching this book, skip
      }
      
      // Mark that we're now fetching this book
      readerFetchInProgressRef.current.add(bookId);
      
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // Fetch book data
        const bookResponse = await booksApi.getBookById(bookId);
        
        if (!bookResponse.ok) {
          throw new Error('Failed to fetch book data');
        }
        
        const bookData = await bookResponse.json();
        console.log('Book data received:', bookData);
        setBook(bookData);
        
        // Track reader open (when user opens book in reader) only if not already tracked
        if (!readerOpenTrackedRef.current.has(bookId)) {
          readerOpenTrackedRef.current.add(bookId);
          try {
            const trackResponse = await fetch(`/api/books/${bookId}/track-view`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ viewType: 'reader_open' }),
            });
            
            if (!trackResponse.ok) {
              console.error('Failed to track reader open:', await trackResponse.json());
            }
          } catch (trackErr) {
            console.error('Error tracking reader open:', trackErr);
          }
        }
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        toastRef.current({
          title: "Ошибка",
          description: "Не удалось загрузить данные книги",
          variant: "destructive",
        });
      } finally {
        // Remove from in-progress tracking after completion
        readerFetchInProgressRef.current.delete(bookId);
        setLoading(false);
      }
    };
    
    fetchBook();
    
    // Cleanup function to remove book from in-progress tracking when component unmounts or bookId changes
    return () => {
      readerFetchInProgressRef.current.delete(bookId);
    };
  }, [bookId]);
  
  const handleNext = async () => {
    // With Foliate.js, navigation is handled by the reader component
    // In a real implementation, we would call the reader's next page method
    console.log('Next page requested');
    // Notify the reader component to navigate to next page
    if (readerRef.current) {
      readerRef.current.nextPage();
    }
  };
  
  const handlePrev = async () => {
    // With Foliate.js, navigation is handled by the reader component
    // In a real implementation, we would call the reader's previous page method
    console.log('Previous page requested');
    // Notify the reader component to navigate to previous page
    if (readerRef.current) {
      readerRef.current.prevPage();
    }
  };
  
  const handleAddBookmark = (title: string) => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      bookId: parseInt(bookId),
      chapterId: 1, // Simplified for now
      title,
      createdAt: new Date()
    };
    setBookmarks([newBookmark, ...bookmarks]);
  };
  
  const handleRemoveBookmark = (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };
  
  const handleNavigateToBookmark = (chapterId: number) => {
    // For bookmarks, we'll still use page numbers for simplicity
    setLocation(`/read/${bookId}/${chapterId}`);
  };
  
  // Show loading indicator but still render the reader component to prevent unmounting
  if (loading) {
    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Main Content Area */}
        <main className={`flex-grow overflow-hidden`} style={{ maxHeight: 'calc(100vh - 80px)' }}>
          <div className="h-full overflow-hidden">
            <EnhancedBookReader 
              ref={readerRef}
              bookId={bookId}
              bookUrl={''} // Pass empty string while loading
              fileType={''}
              initialLocation={positionParam}
              fontSize={fontSize}
              onProgressUpdate={(progress) => console.log('Progress:', progress)}
              onBookmarkAdded={handleAddBookmark}
              onTextSelected={(text) => console.log('Selected text:', text)}
              onNext={handleNext}
              onPrev={handlePrev}
              hasPrev={true}
              hasNext={true}
            />
          </div>
        </main>
        
        {/* Show loading overlay */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading book data...</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we prepare your book</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Error Loading Book</h2>
          <p className="text-muted-foreground mb-4">{error || 'Failed to load book data'}</p>
          <Link href="/library">
            <Button>Return to Library</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // Construct the book URL for Foliate.js only when we have book data
  console.log('=== READER PAGE URL CONSTRUCTION ===');
  console.log('Book filePath:', book.filePath);
  console.log('Book fileType:', book.fileType);
  console.log('Constructed bookUrl:', bookUrl);
  console.log('Book URL ends with .fb2:', bookUrl?.endsWith('.fb2'));
  console.log('=== READER PAGE URL CONSTRUCTION END ===');
  
  return (
    <div className="h-screen bg-background transition-colors duration-500 flex flex-col overflow-hidden">
      {/* Main Content Area - pt-16 removed since we're using the main navbar */}
      <main className={`flex-grow overflow-hidden transition-all duration-500 ease-in-out ${isSidebarOpen ? 'pr-0 md:pr-[400px]' : ''}`} style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="h-full overflow-hidden">
          {/* Always render the reader component to prevent unmounting/remounting issues */}
          <EnhancedBookReader 
            ref={readerRef}
            bookId={bookId}
            bookUrl={bookUrl}
            fileType={book?.fileType || ''}
            initialLocation={positionParam}
            fontSize={fontSize}
            onProgressUpdate={(progress) => console.log('Progress:', progress)}
            onBookmarkAdded={handleAddBookmark}
            onTextSelected={(text) => console.log('Selected text:', text)}
            onNext={handleNext}
            onPrev={handlePrev}
            hasPrev={true}
            hasNext={true}
          />
        </div>
      </main>
      
      {/* Floating Controls - positioned absolutely to avoid interfering with main navbar */}
      <div className="fixed top-20 right-4 z-40 flex items-center gap-2">
        {/* Bookmarks */}
        <BookmarksPanel 
          bookId={parseInt(bookId)}
          chapterId={1}
          bookmarks={bookmarks}
          onAddBookmark={handleAddBookmark}
          onRemoveBookmark={handleRemoveBookmark}
          onNavigate={handleNavigateToBookmark}
        />
        
        {/* Font Size Control */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Type className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-4">
              <h4 className="font-medium leading-none">Размер шрифта</h4>
              <div className="flex items-center gap-4">
                <span className="text-xs">A</span>
                <Slider
                  value={[fontSize]}
                  onValueChange={(vals) => setFontSize(vals[0])}
                  min={14}
                  max={32}
                  step={1}
                  className="flex-1"
                />
                <span className="text-lg">A</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* AI Toggle */}
        <Button 
          variant={isSidebarOpen ? "default" : "outline"}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="gap-2 transition-all duration-300 border-primary/20 hover:border-primary/50"
        >
          <Brain className="w-4 h-4" />
          <span className="hidden sm:inline">AI Анализ</span>
        </Button>
      </div>
      
      {/* Navigation Zones */}
      <div 
        className="fixed left-0 top-16 bottom-32 w-16 md:w-32 z-10 hidden lg:flex items-center justify-start pl-4 cursor-pointer opacity-0 hover:opacity-100 hover:bg-gradient-to-r hover:from-foreground/5 to-transparent transition-all duration-300 group"
        onClick={handlePrev}
        title="Previous page"
      >
        <ArrowLeft className="w-10 h-10 text-muted-foreground/40 group-hover:-translate-x-2 transition-transform duration-300" />
      </div>
            
      <div 
        className={`fixed right-0 top-16 bottom-32 w-16 md:w-32 z-10 hidden lg:flex items-center justify-end pr-4 cursor-pointer opacity-0 hover:opacity-100 hover:bg-gradient-to-l hover:from-foreground/5 to-transparent transition-all duration-300 group ${isSidebarOpen ? 'mr-[400px]' : ''}`}
        onClick={handleNext}
        title="Next page"
        style={{ transitionProperty: 'margin-right, opacity, background-color' }}
      >
        <ArrowRight className="w-10 h-10 text-muted-foreground/40 group-hover:translate-x-2 transition-transform duration-300" />
      </div>
      
      {/* AI Sidebar */}
      <AISidebar 
        chapter={{
          id: 1,
          title: `Страница 1`,
          content: '', // Content will be provided by the reader
          summary: "Анализ страницы недоступен",
          keyTakeaways: ["Ключевой момент 1", "Ключевой момент 2"]
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}