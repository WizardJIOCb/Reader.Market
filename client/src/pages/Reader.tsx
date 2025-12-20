import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { mockBook, mockBookmarks, Bookmark, Chapter } from '@/lib/mockData'; // Import Chapter from mockData
import { BookReader } from '@/components/BookReader';
import { AISidebar } from '@/components/AISidebar';
import { BookmarksPanel } from '@/components/BookmarksPanel';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft, ArrowRight, Type } from 'lucide-react';
import { Link } from 'wouter';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

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
}

export default function Reader() {
  const [match, params] = useRoute('/read/:bookId/:chapterId');
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(mockBookmarks);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for book data
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]); // Use Chapter from mockData
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const bookId = params?.bookId || '';
  const chapterId = parseInt(params?.chapterId || '1');

  // Fetch book data
  useEffect(() => {
    const fetchBook = async () => {
      if (!bookId) return;
      
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // Fetch book data
        const bookResponse = await fetch(`/api/books/${bookId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!bookResponse.ok) {
          throw new Error('Failed to fetch book data');
        }
        
        const bookData = await bookResponse.json();
        setBook(bookData);
        
        // For now, we'll generate mock chapters since we don't have actual book processing
        // In a real implementation, this would come from processed book content
        const mockChapters: Chapter[] = [
          {
            id: 1,
            title: "Введение",
            content: `Это пример содержания книги "${bookData.title}" от ${bookData.author}.
            
В настоящей реализации здесь будет отображаться фактическое содержание книги, которое было извлечено из загруженного файла.
            
Пока что это демонстрационный контент для проверки функциональности чтения.`,
            summary: "Введение в книгу",
            keyTakeaways: ["Знакомство с темой книги", "Основные идеи автора"]
          },
          {
            id: 2,
            title: "Первая глава",
            content: `Это содержание первой главы книги.
            
В реальной системе здесь будет отображаться текст главы, извлеченный из загруженного файла книги.
            
Система также может включать функции анализа текста, выделения ключевых моментов и создания закладок.`,
            summary: "Основное содержание первой главы",
            keyTakeaways: ["Ключевая идея главы", "Важные концепции", "Выводы"]
          },
          {
            id: 3,
            title: "Заключение",
            content: `Это заключение книги.
            
В заключении обычно подводятся итоги прочитанного, формулируются основные выводы и возможные направления дальнейшего изучения темы.
            
Спасибо за внимание к этой книге!`,
            summary: "Завершение книги",
            keyTakeaways: ["Основные выводы", "Рекомендации по дальнейшему изучению"]
          }
        ];
        
        setChapters(mockChapters);
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить данные книги",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchBook();
  }, [bookId, toast]);

  const currentChapterIndex = chapters.findIndex(c => c.id === chapterId);
  const currentChapter = chapters[currentChapterIndex];

  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapters.length - 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Загрузка книги...</p>
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
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-muted-foreground mb-4">{error || 'Не удалось загрузить данные книги'}</p>
          <Link href="/library">
            <Button>Вернуться в библиотеку</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentChapter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Глава не найдена</h2>
          <p className="text-muted-foreground mb-4">Запрошенная глава недоступна</p>
          <Link href={`/book/${bookId}`}>
            <Button>Вернуться к книге</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (hasNext) {
      setLocation(`/read/${bookId}/${chapters[currentChapterIndex + 1].id}`);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setLocation(`/read/${bookId}/${chapters[currentChapterIndex - 1].id}`);
    }
  };

  const handleAddBookmark = (title: string) => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      bookId: parseInt(bookId),
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
          chapter={currentChapter || {
            id: 1,
            title: "Введение",
            content: "Содержание недоступно",
            summary: "Нет доступного резюме",
            keyTakeaways: []
          }}
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
          bookId={parseInt(bookId)}
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
        chapter={currentChapter || chapters[0] || {
          id: 1,
          title: "Введение",
          content: "Содержание недоступно",
          summary: "Нет доступного резюме",
          keyTakeaways: []
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}