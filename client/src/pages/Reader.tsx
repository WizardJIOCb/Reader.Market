import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { mockBook, mockBookmarks, Bookmark } from '@/lib/mockData';
import { BookReader } from '@/components/BookReader';
import { AISidebar } from '@/components/AISidebar';
import { BookmarksPanel } from '@/components/BookmarksPanel';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft, ArrowRight, Type } from 'lucide-react';
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
      {/* Main Content Area - pt-16 removed since we're using the main navbar */}
      <main className={`min-h-screen transition-all duration-500 ease-in-out ${isSidebarOpen ? 'pr-0 md:pr-[400px]' : ''}`}>
        <BookReader 
          chapter={currentChapter}
          onNext={handleNext}
          onPrev={handlePrev}
          hasPrev={hasPrev}
          hasNext={hasNext}
          fontSize={fontSize}
        />
      </main>

      {/* Floating Controls - positioned absolutely to avoid interfering with main navbar */}
      <div className="fixed top-20 right-4 z-40 flex items-center gap-2">
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

      {/* Navigation Zones */}
      {hasPrev && (
        <div 
          className="fixed left-0 top-16 bottom-0 w-16 md:w-32 z-10 hidden lg:flex items-center justify-start pl-4 cursor-pointer opacity-0 hover:opacity-100 hover:bg-gradient-to-r hover:from-foreground/5 to-transparent transition-all duration-300 group"
          onClick={handlePrev}
          title="Предыдущая глава"
        >
          <ArrowLeft className="w-10 h-10 text-muted-foreground/40 group-hover:-translate-x-2 transition-transform duration-300" />
        </div>
      )}

      {hasNext && (
        <div 
          className={`fixed right-0 top-16 bottom-0 w-16 md:w-32 z-10 hidden lg:flex items-center justify-end pr-4 cursor-pointer opacity-0 hover:opacity-100 hover:bg-gradient-to-l hover:from-foreground/5 to-transparent transition-all duration-300 group ${isSidebarOpen ? 'mr-[400px]' : ''}`}
          onClick={handleNext}
          title="Следующая глава"
          style={{ transitionProperty: 'margin-right, opacity, background-color' }}
        >
          <ArrowRight className="w-10 h-10 text-muted-foreground/40 group-hover:translate-x-2 transition-transform duration-300" />
        </div>
      )}

      {/* AI Sidebar */}
      <AISidebar 
        chapter={currentChapter}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}