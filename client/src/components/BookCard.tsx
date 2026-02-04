import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book } from '@/lib/mockData';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  MessageSquare,
  Star, 
  User,
  Bookmark,
  Activity,
  BookOpenCheck
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ReactionBar } from '@/components/ReactionBar';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useBookSplash } from '@/lib/bookSplashContext';
import { readerApi } from '@/lib/api';
import { readingProgressCache } from '@/lib/readingProgressCache';

interface BookCardProps {
  book: Book & { readingProgress?: any };
  variant?: 'standard' | 'detailed' | 'compact';
  readingProgress?: {
    currentPage: number;
    totalPages: number;
    percentage: number;
    lastReadAt: Date;
  };
  addToShelfButton?: React.ReactNode;
  columns?: number; // Number of columns in the grid (1, 2, or 3)
}

export const BookCard: React.FC<BookCardProps> = ({ 
  book, 
  variant = 'standard',
  readingProgress,
  addToShelfButton,
  columns
}) => {
  const [visibleGenreCount, setVisibleGenreCount] = useState(3);
  
  // Set visibleGenreCount based on screen size and columns
  useEffect(() => {
    if (!book.genre) return;
    
    const allGenres = Array.isArray(book.genre) 
      ? book.genre 
      : book.genre && typeof book.genre === 'string' 
        ? book.genre.split(',').map(g => g.trim())
        : [];
        
    // Check if we're on mobile (screen width < 768px)
    const isMobile = window.innerWidth < 768;
    
    let genresToShow = 3; // Default to 3 genres
    
    if (columns !== undefined) {
      // If columns prop is provided, use it to determine genre count
      if (columns >= 3) {
        // 3+ columns (like on shelves page) - show 2 genres
        genresToShow = 2;
      } else if (columns <= 2) {
        // 1-2 columns (like on search page) - show 3 genres
        genresToShow = 3;
      }
    } else {
      // Default behavior based on screen size only
      if (isMobile) {
        genresToShow = 2;
      } else {
        genresToShow = 3;
      }
    }
    
    setVisibleGenreCount(Math.min(genresToShow, allGenres.length));
  }, [book.genre, columns]);
  
  // Update visible genres when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (!book.genre) return;
      
      const allGenres = Array.isArray(book.genre) 
        ? book.genre 
        : book.genre && typeof book.genre === 'string' 
          ? book.genre.split(',').map(g => g.trim())
          : [];
          
      // Check if we're on mobile (screen width < 768px)
      const isMobile = window.innerWidth < 768;
      
      let genresToShow = 3; // Default to 3 genres
      
      if (columns !== undefined) {
        // If columns prop is provided, use it to determine genre count
        if (columns >= 3) {
          // 3+ columns (like on shelves page) - show 2 genres
          genresToShow = 2;
        } else if (columns <= 2) {
          // 1-2 columns (like on search page) - show 3 genres
          genresToShow = 3;
        }
      } else {
        // Default behavior based on screen size only
        if (isMobile) {
          genresToShow = 2;
        } else {
          genresToShow = 3;
        }
      }
      
      setVisibleGenreCount(Math.min(genresToShow, allGenres.length));
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [book.genre, columns]);
  const { t } = useTranslation(['books']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { showSplash } = useBookSplash();
  const [localReactions, setLocalReactions] = useState(book.reactions || []);
  const [progress, setProgress] = useState<{
    currentPage: number;
    totalPages: number;
    percentage: number;
    lastReadAt?: string;
  } | null>(null);
  // Format dates for display in DD.MM.YYYY format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Get book dates - using created_at as fallback for uploaded_at
  const uploadedAt = book.uploadedAt || book.createdAt;
  const publishedAt = book.publishedAt;

  // Update local reactions when book changes
  React.useEffect(() => {
    setLocalReactions(book.reactions || []);
  }, [book]);
    
  // Use passed readingProgress prop if available, otherwise check for embedded reading progress, otherwise fetch from API with caching
  useEffect(() => {
    // If readingProgress is passed as prop, use it directly
    if (readingProgress) {
      setProgress({
        currentPage: readingProgress.currentPage,
        totalPages: readingProgress.totalPages,
        percentage: readingProgress.percentage,
        lastReadAt: readingProgress.lastReadAt.toISOString()
      });
      return;
    }
    
    // Check if book object has embedded reading progress
    if (book.readingProgress) {
      setProgress({
        currentPage: book.readingProgress.currentPage,
        totalPages: book.readingProgress.totalPages,
        percentage: book.readingProgress.percentage,
        lastReadAt: book.readingProgress.lastReadAt || new Date().toISOString()
      });
      return;
    }
    
    // Only fetch from API if no readingProgress prop or embedded data is provided
    const fetchProgress = async () => {
      if (!user || !book.id) {
        setProgress(null);
        return;
      }
        
      try {
        // Use cached API call to avoid duplicate requests
        const data = await readingProgressCache.getUserProgress(
          book.id.toString(), 
          user.id,
          () => readerApi.getUserProgress(book.id.toString(), user.id)
        );
        
        if (data && data.percentage > 0) {
          // Only set progress if there's actual reading progress (percentage > 0)
          setProgress(data);
        } else {
          setProgress(null);
        }
      } catch (error) {
        console.error('Error fetching reading progress:', error);
        setProgress(null);
      }
    };
      
    fetchProgress();
  }, [user, book.id, readingProgress]);

  // Handle book reaction
  const handleBookReact = async (emoji: string) => {
    if (!user) {
      toast({
        title: t('books:error'),
        description: t('books:loginRequired'),
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/books/${book.id}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Optimistically update local state
        setLocalReactions(prev => {
          const existingIndex = prev.findIndex(r => r.emoji === emoji);
          
          if (result.action === 'added') {
            if (existingIndex >= 0) {
              // Increment count and mark as user reacted
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                count: updated[existingIndex].count + 1,
                userReacted: true
              };
              return updated;
            } else {
              // Add new reaction
              return [...prev, { emoji, count: 1, userReacted: true }];
            }
          } else {
            // Removed reaction
            if (existingIndex >= 0) {
              const updated = [...prev];
              if (updated[existingIndex].count > 1) {
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  count: updated[existingIndex].count - 1,
                  userReacted: false
                };
                return updated;
              } else {
                // Remove reaction completely
                return prev.filter((_, i) => i !== existingIndex);
              }
            }
          }
          
          return prev;
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reaction');
      }
    } catch (err) {
      console.error('Error adding book reaction:', err);
      toast({
        title: t('books:error'),
        description: err instanceof Error ? err.message : t('books:failedToAddReaction'),
        variant: "destructive",
      });
    }
  };

  // Handle Read button click with splash screen transition
  const handleReadClick = () => {
    // Show splash screen with book data
    showSplash({
      id: book.id.toString(),
      title: book.title,
      author: book.author,
      coverImageUrl: book.coverImage || book.coverImageUrl,
      description: book.description,
      rating: book.rating,
    });
    
    // Navigate to reader after a short delay to allow splash to appear
    setTimeout(() => {
      setLocation(`/read/${book.id}/1`);
    }, 400);
  };

  return (
    <Card className={`${variant === 'compact' ? 'p-3' : 'p-2'} overflow-hidden hover:shadow-lg transition-shadow duration-300`}>
      {variant === 'compact' ? (
        // Compact layout: Cover on left, content on right
        <div className="flex flex-col gap-3">
          {/* Top Row: Cover on left, Content on right */}
          <div className="flex gap-3">
            {/* Left: Cover */}
            <Link href={`/book/${book.id}`} className="flex-shrink-0">
              <div className="relative cursor-pointer">
                {(book.coverImage || book.coverImageUrl) ? (
                  <img 
                    src={
                      ((book.coverImage || book.coverImageUrl)?.startsWith('http') 
                        ? (book.coverImage || book.coverImageUrl)
                        : `/${(book.coverImage || book.coverImageUrl)?.replace(/^\//, '')}`)}
                    alt={book.title}
                    className="w-28 h-42 rounded-lg object-cover shadow-sm"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      console.error('Failed to load cover image:', book.coverImage || book.coverImageUrl);
                      // Fallback to default image if the cover image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none'; // Hide the broken image
                      target.onerror = null; // Prevent infinite loop
                    }}
                    onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      // Image loaded successfully
                    }}
                  />
                ) : (
                  <div className="w-28 h-42 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center shadow-sm">
                    <BookOpen className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                
                {(book.rating !== undefined && book.rating !== null) && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 text-xs font-bold">
                    <Star className="w-2 h-2 fill-current" />
                    {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </Link>
            
            {/* Right: Content (Title, Authors, Description) */}
            <div className="flex-1 min-w-0">
              <Link href={`/book/${book.id}`}>
                <h3 className="font-serif font-bold text-base line-clamp-1">{book.title}</h3>
              </Link>
              <p className="text-muted-foreground font-bold text-xs line-clamp-1 mb-1">
                {book.author}
              </p>
              
              <p style={{ paddingTop: '7px' }} className="text-[13px] text-muted-foreground mb-0 line-clamp-6">
                {book.description}
              </p>
            </div>
          </div>
          
          {/* Genres after the cover and description block */}
          <div className="flex flex-nowrap gap-1 mb-2" style={{ minHeight: '24px' }}>
            <div className="flex flex-nowrap gap-1">
              {book.genre && book.genre.length > 0 ? (
                <>
                  {Array.isArray(book.genre) 
                    ? book.genre.slice(0, visibleGenreCount).map((genre: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs flex-shrink-0" style={{ backgroundColor: '#ffe69e' }}>
                          {genre}
                        </Badge>
                      ))
                    : book.genre && typeof book.genre === 'string' && book.genre.split(',').slice(0, visibleGenreCount).map((genre: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs flex-shrink-0" style={{ backgroundColor: '#ffe69e' }}>
                          {genre.trim()}
                        </Badge>
                      ))
                  }
                  {((Array.isArray(book.genre) && book.genre.length > visibleGenreCount) || 
                    (typeof book.genre === 'string' && book.genre.split(',').length > visibleGenreCount)) && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0" style={{ backgroundColor: '#ffe69e' }}>
                      +{Array.isArray(book.genre) 
                        ? book.genre.length - visibleGenreCount 
                        : book.genre.split(',').length - visibleGenreCount}
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="secondary" className="text-xs flex-shrink-0" style={{ backgroundColor: '#ffe69e' }}>
                  {t('books:noGenres')}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Bottom Section: Stats, Progress, and Buttons (full width) */}
          <div className="flex flex-col gap-2">
            {/* Metrics row */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {book.commentCount !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        💬 {book.commentCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('books:comments')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {book.cardViewCount !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        👁️ {book.cardViewCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('books:cardViews')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {book.readerOpenCount !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        📖 {book.readerOpenCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('books:readerOpens')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {book.shelfCount !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        📚 {book.shelfCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('books:addedToShelf')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Rating display */}
                {(book.rating !== undefined && book.rating !== null) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-current text-yellow-500" /> {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}
                        {book.ratingCount !== undefined && ` (${book.ratingCount})`}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('books:rating')}: {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)} {book.ratingCount !== undefined ? `(${book.ratingCount} ${t('books:ratings')})` : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
            
            {/* Progress bar - show regardless of progress */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t('books:progress')}</span>
                {progress && progress.percentage > 0 ? (
                  <span>{Math.round(progress.percentage)}% ({progress.currentPage}/{progress.totalPages})</span>
                ) : (
                  <span>({t('books:notStartedReading')})</span>
                )}
              </div>
              <Progress value={progress?.percentage || 0} className="h-1.5" />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs flex-1"
                onClick={handleReadClick}
                style={{ backgroundColor: '#ffe3af', border: '1px solid #979797' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffd995'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffe3af'}
              >
                {t('books:read')}
              </Button>
              <Button variant="outline" size="sm" className="text-xs flex-1" asChild
                style={{ backgroundColor: '#ffedb2', border: '1px solid #979797' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffe499'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffedb2'}>
                <Link href={`/book/${book.id}`}>
                  {t('books:moreDetails')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
        ) : (
        // Original layout
        <>
          <Link href={`/book/${book.id}`}>
            <div className="relative cursor-pointer">
              {(book.coverImage || book.coverImageUrl) ? (
                <img 
                  src={
                    ((book.coverImage || book.coverImageUrl)?.startsWith('http') 
                      ? (book.coverImage || book.coverImageUrl)
                      : `/${(book.coverImage || book.coverImageUrl)?.replace(/^\//, '')}`)}
                  alt={book.title}
                  className="w-full rounded-t-lg object-cover aspect-[2/3] hover:opacity-90 transition-opacity"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Failed to load cover image:', book.coverImage || book.coverImageUrl);
                    // Fallback to default image if the cover image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none'; // Hide the broken image
                    target.onerror = null; // Prevent infinite loop
                  }}
                  onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    // Image loaded successfully
                  }}
                />
              ) : (
                <div className="w-full rounded-t-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center aspect-[2/3] hover:opacity-90 transition-opacity">
                  <BookOpen className="w-12 h-12 text-gray-400" />
                </div>
              )}
                    
              {(book.rating !== undefined && book.rating !== null) ? (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm font-bold">
                  <Star className="w-3 h-3 fill-current" />
                  {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}
                </div>
              ) : (
                <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm">
                  <Star className="w-3 h-3 fill-current" />
                  {t('books:noRating')}
                </div>
              )}
            </div>
          </Link>
          
          <CardHeader className="pb-1">
            <h3 className="font-serif font-bold text-lg line-clamp-2">{book.title}</h3>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <User className="w-4 h-4" />
              {book.author}
            </p>
          </CardHeader>
          
          <CardContent className="pb-1">
            {variant === 'detailed' && (
              <>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3 whitespace-pre-line">
                  {book.description}
                </p>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {Array.isArray(book.genre) 
                    ? book.genre.map((genre, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {genre}
                        </Badge>
                      ))
                    : book.genre && typeof book.genre === 'string' && book.genre.split(',').map((genre, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {genre.trim()}
                        </Badge>
                      ))
                  }
                </div>
                
                {/* Book Reactions - after description and genres */}
                {variant === 'detailed' && (
                  <div className="mb-3">
                    <ReactionBar 
                      reactions={
                        // Sort by count descending to show most popular first
                        localReactions.sort((a, b) => b.count - a.count)
                      } 
                      onReact={handleBookReact}
                      bookId={book.id.toString()}
                    />
                  </div>
                )}
              </>
            )}
            
            {/* Book Dates Display */}
            <div className="space-y-1 mb-2">
              {/* Rating display at the top */}
              {(book.rating !== undefined && book.rating !== null) && (
                <div className="flex items-center text-xs font-bold text-yellow-600">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  <span>{t('books:rating')}: {book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}</span>
                </div>
              )}
              
              {publishedAt && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{t('books:published')}: {formatDate(publishedAt)}</span>
                </div>
              )}
              
              {uploadedAt && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{t('books:added')}: {formatDate(uploadedAt)}</span>
                </div>
              )}
              
              {/* Review counts */}
              {(book.reviewCount !== undefined || book.commentCount !== undefined) && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  <span>
                    {book.reviewCount !== undefined && `${book.reviewCount} ${t('books:reviews')}`}
                    {book.reviewCount !== undefined && book.commentCount !== undefined && ', '}
                    {book.commentCount !== undefined && `${book.commentCount} ${t('books:comments')}`}
                  </span>
                </div>
              )}
              
              {/* Book statistics */}
              {(book.shelfCount !== undefined || book.cardViewCount !== undefined || book.readerOpenCount !== undefined) && (
                <>
                  {typeof book.shelfCount === 'number' && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <Bookmark className="w-3 h-3 mr-1" />
                      <span>{t('books:addedToShelf')}: {book.shelfCount}</span>
                    </div>
                  )}
                  {book.cardViewCount !== undefined && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <span>👁️ {book.cardViewCount} {t('books:cardViews')}</span>
                    </div>
                  )}
                  {book.readerOpenCount !== undefined && (
                    <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <span>📖 {book.readerOpenCount} {t('books:readerOpens')}</span>
                    </div>
                  )}
                </>
              )}
              
              {/* Last activity date */}
              {book.lastActivityDate && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <Activity className="w-3 h-3 mr-1" />
                  <span>{t('books:lastActivity')}: {formatDate(book.lastActivityDate)}</span>
                </div>
              )}
              
              {/* Last read date - when user last opened this book in reader */}
              {progress && progress.lastReadAt && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <BookOpenCheck className="w-3 h-3 mr-1" />
                  <span>{t('books:lastOpenedInReader')}: {new Date(progress.lastReadAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {/* Reading Progress Display */}
            {progress && progress.percentage > 0 && (
              <div className="mt-3 mb-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('books:progress')}</span>
                  <span>{Math.round(progress.percentage)}%</span>
                </div>
                <Progress value={progress.percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{progress.currentPage} {t('books:of')} {progress.totalPages} {t('books:pages')}</span>
                  {progress.lastReadAt && (
                    <span>{t('books:lastRead')}: {new Date(progress.lastReadAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            )}
            
            {/* TODO: Restore when reader module is fully implemented
            {readingProgress && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Прогресс</span>
                  <span>{Math.round(readingProgress.percentage)}%</span>
                </div>
                <Progress value={readingProgress.percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{readingProgress.currentPage} из {readingProgress.totalPages} стр.</span>
                  <span>Читалось: {readingProgress.lastReadAt.toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
            )}
            */}
          </CardContent>
          
          <CardFooter className="flex flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleReadClick}
              >
                {t('books:read')}
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/book/${book.id}`}>
                  {t('books:moreDetails')}
                </Link>
              </Button>
            </div>
            {addToShelfButton && (
              <div className="w-full min-w-0">
                {addToShelfButton}
              </div>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
};

export default BookCard;