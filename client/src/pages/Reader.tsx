import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { mockBook, mockBookmarks, Bookmark } from '@/lib/mockData';
import { BookReader } from '@/components/BookReader';
import { AISidebar } from '@/components/AISidebar';
import { BookmarksPanel } from '@/components/BookmarksPanel';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft, Type } from 'lucide-react';
import { Link } from 'wouter';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function Reader() {
  const [match, params] = useRoute('/read/:bookId/:chapterId');
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(mockBookmarks);

  const bookId = parseInt(params?.bookId || '1');
  const chapterId = parseInt(params?.chapterId || '1');

  // For this mock, we only have one book
  const book = mockBook;
  const currentChapterIndex = book.chapters.findIndex(c => c.id === chapterId);
  const currentChapter = book.chapters[currentChapterIndex];

  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < book.chapters.length - 1;

  if (!currentChapter) return <div>Chapter not found</div>;

  const handleNext = () => {
    if (hasNext) {
      setLocation(`/read/${bookId}/${book.chapters[currentChapterIndex + 1].id}`);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setLocation(`/read/${bookId}/${book.chapters[currentChapterIndex - 1].id}`);
    }
  };

  const handleAddBookmark = (title: string) => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      bookId,
      chapterId,
      title,
      createdAt: new Date()
    };
    setBookmarks([newBookmark, ...bookmarks]);
  };

  const handleRemoveBookmark = (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const handleNavigateToBookmark = (chapterId: number) => {
    setLocation(`/read/${bookId}/${chapterId}`);
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-16 bg-background/80 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-8 transition-all duration-300">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="hidden md:block">
            <h1 className="font-serif font-bold text-sm tracking-wide">{book.title}</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{currentChapter.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bookmarks */}
          <BookmarksPanel 
            bookId={bookId}
            chapterId={chapterId}
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
      </nav>

      {/* Main Content Area */}
      <main className={`pt-16 min-h-screen transition-all duration-500 ease-in-out ${isSidebarOpen ? 'pr-0 md:pr-[400px]' : ''}`}>
        <BookReader 
          chapter={currentChapter}
          onNext={handleNext}
          onPrev={handlePrev}
          hasPrev={hasPrev}
          hasNext={hasNext}
          fontSize={fontSize}
        />
      </main>

      {/* AI Sidebar */}
      <AISidebar 
        chapter={currentChapter}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
