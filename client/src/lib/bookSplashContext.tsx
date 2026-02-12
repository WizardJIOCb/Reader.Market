import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Theme colors for splash screen
const SPLASH_THEME_COLORS = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    accent: '#3b82f6',
  },
  dark: {
    background: '#1a1a1a',
    text: '#e5e5e5',
    accent: '#60a5fa',
  },
  sepia: {
    background: '#f4ecd8',
    text: '#5c4b37',
    accent: '#8b7355',
  },
};

type Theme = 'light' | 'dark' | 'sepia';

interface BookData {
  id: string;
  title: string;
  author: string;
  coverImageUrl?: string;
  videoCoverUrl?: string;
  description?: string;
  rating?: number;
}

interface BookSplashContextType {
  showSplash: (book: BookData, theme?: Theme) => void;
  hideSplash: () => void;
  isVisible: boolean;
  book: BookData | null;
}

const BookSplashContext = createContext<BookSplashContextType | undefined>(undefined);

export function BookSplashProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAppearing, setIsAppearing] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [book, setBook] = useState<BookData | null>(null);
  const [theme, setTheme] = useState<Theme>('sepia');

  const showSplash = useCallback((bookData: BookData, selectedTheme: Theme = 'sepia') => {
    setBook(bookData);
    setTheme(selectedTheme);
    setIsFading(false);
    setIsAppearing(true);
    setIsVisible(true);
    // Trigger fade-in animation after mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAppearing(false);
      });
    });
  }, []);

  const hideSplash = useCallback(() => {
    setIsFading(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsFading(false);
      setIsAppearing(false);
      setBook(null);
    }, 800); // Match animation duration
  }, []);

  const themeColors = SPLASH_THEME_COLORS[theme];

  return (
    <BookSplashContext.Provider value={{ showSplash, hideSplash, isVisible, book }}>
      {children}
      
      {/* Global splash screen overlay */}
      {isVisible && book && (
        <div 
          className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ease-out ${
            isAppearing ? 'opacity-0' : isFading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backgroundColor: themeColors.background }}
        >
          <div className="text-center max-w-2xl mx-auto px-6">
            {/* Book cover */}
            {book.videoCoverUrl ? (
              <div className="mx-auto">
                {/* Placeholder image shown initially */}
                {book.coverImageUrl && (
                  <img 
                    src={book.coverImageUrl.startsWith('uploads/') ? (book.coverImageUrl.startsWith('/') ? book.coverImageUrl : `/${book.coverImageUrl}`) : book.coverImageUrl}
                    alt={book.title}
                    className="max-h-[40vh] max-w-[60vw] object-contain rounded-lg shadow-2xl mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                {/* Video cover loaded behind the image */}
                <video 
                  src={book.videoCoverUrl.startsWith('http') ? book.videoCoverUrl : book.videoCoverUrl.startsWith('/') ? book.videoCoverUrl : `/${book.videoCoverUrl}`}
                  className="max-h-[40vh] max-w-[60vw] object-contain rounded-lg shadow-2xl mx-auto"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={(e) => {
                    console.error('Failed to load video cover:', book.videoCoverUrl);
                    // If video fails, show image
                    const target = e.target as HTMLVideoElement;
                    target.style.display = 'none';
                  }}
                  onLoadedData={(e) => {
                    // When video loads, hide the placeholder image
                    const videoElement = e.target as HTMLVideoElement;
                    const parentDiv = videoElement.parentElement;
                    if (parentDiv) {
                      const imgElements = parentDiv.querySelectorAll('img');
                      imgElements.forEach(img => (img as HTMLElement).style.display = 'none');
                    }
                  }}
                />
              </div>
            ) : book.coverImageUrl ? (
              <img 
                src={book.coverImageUrl.startsWith('uploads/') ? (book.coverImageUrl.startsWith('/') ? book.coverImageUrl : `/${book.coverImageUrl}`) : book.coverImageUrl}
                alt={book.title}
                className="max-h-[40vh] max-w-[60vw] object-contain rounded-lg shadow-2xl mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div 
                className="w-40 h-56 rounded-lg shadow-2xl flex items-center justify-center mx-auto"
                style={{ 
                  backgroundColor: themeColors.accent + '20',
                  border: `2px solid ${themeColors.accent}40`,
                }}
              >
                <span 
                  className="text-4xl font-serif"
                  style={{ color: themeColors.text }}
                >
                  {book.title.charAt(0)}
                </span>
              </div>
            )}
            
            {/* Book title */}
            <h2 
              className="mt-5 text-2xl font-semibold"
              style={{ color: themeColors.text }}
            >
              {book.title}
            </h2>
            
            {/* Author */}
            <p 
              className="mt-2 text-base opacity-80"
              style={{ color: themeColors.text }}
            >
              {book.author}
            </p>
            
            {/* Rating */}
            {book.rating !== undefined && book.rating > 0 && (
              <div className="mt-3 flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="w-5 h-5"
                    fill={star <= Math.round(book.rating!) ? themeColors.accent : 'none'}
                    stroke={themeColors.accent}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ))}
                <span 
                  className="ml-2 text-sm opacity-70"
                  style={{ color: themeColors.text }}
                >
                  {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}
                </span>
              </div>
            )}
            
            {/* Description */}
            {book.description && (
              <p 
                className="mt-4 text-sm opacity-70 line-clamp-3"
                style={{ color: themeColors.text }}
              >
                {book.description}
              </p>
            )}
            
            {/* Loading spinner */}
            <div 
              className="mt-6 animate-spin rounded-full h-6 w-6 border-b-2 mx-auto"
              style={{ borderColor: themeColors.accent }}
            />
            <p 
              className="mt-3 text-xs opacity-50"
              style={{ color: themeColors.text }}
            >
              Загрузка книги...
            </p>
          </div>
        </div>
      )}
    </BookSplashContext.Provider>
  );
}

export function useBookSplash() {
  const context = useContext(BookSplashContext);
  if (context === undefined) {
    throw new Error('useBookSplash must be used within a BookSplashProvider');
  }
  return context;
}
