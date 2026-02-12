import { useState, useEffect } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@/lib/auth';
import { bookmarkCollectionsApi } from '@/lib/api';
import { BookmarkCollectionWithBookmarks, BookmarkWithBookInfo } from '@/types/bookmarkCollections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserProfileDisplay } from '@/components/UserProfileDisplay';
import { useTranslation } from 'react-i18next';
import { usePageView } from '@/hooks/usePageView';
import { 
  ArrowLeft, 
  BookOpen, 
  Edit, 
  Trash2, 
  Eye,
  Calendar,
  Hash,
  Copy
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function CollectionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation(['collections', 'common']);
  
  // Track page view for navigation logging
  // Use specific collection detail tracking with ID
  usePageView(`collection/${id}`);
  const [collection, setCollection] = useState<BookmarkCollectionWithBookmarks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchCollection();
    }
  }, [user, id]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const response = await bookmarkCollectionsApi.getCollection(id!);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        toast({
          title: t('common:error'),
          description: t('collections:detailPage.emptyBookmarks.title'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      toast({
        title: t('common:error'),
        description: t('collections:toasts.error'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!collection || !confirm(`${t('collections:modals.deleteConfirm.message')} "${collection.name}"? ${t('collections:modals.deleteConfirm.warning')}`)) {
      return;
    }

    try {
      const response = await bookmarkCollectionsApi.deleteCollection(collection.id);
      if (response.ok) {
        toast({
          title: t('common:success'),
          description: `${t('collections:toasts.deleted')} "${collection.name}"`
        });
        // Redirect to collections page
        window.location.href = '/collections';
      } else {
        toast({
          title: t('common:error'),
          description: t('collections:toasts.error'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast({
        title: t('common:error'),
        description: t('collections:toasts.error'),
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const locale = localStorage.getItem('i18nextLng') || 'ru';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleReadBookmark = async (bookmark: BookmarkWithBookInfo) => {
    try {
      // Track bookmark click
      const response = await fetch(`/api/bookmarks/${bookmark.id}/click`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        // Update local bookmark click count
        setCollection(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            bookmarks: prev.bookmarks.map(b => 
              b.id === bookmark.id 
                ? { ...b, clickCount: (b.clickCount || 0) + 1 }
                : b
            )
          };
        });
      }
    } catch (error) {
      console.error('Error tracking bookmark click:', error);
    }
    
    // Debug: Log ALL bookmark data to see what we're working with
    console.log('[BOOKMARK NAVIGATION] ALL bookmarks in collection:', 
      collection?.bookmarks.map(b => ({
        id: b.id,
        title: b.title,
        chapterIndex: b.chapterIndex,
        pageInChapter: b.pageInChapter,
        percentage: b.percentage,
        selectedText: b.selectedText ? b.selectedText.substring(0, 50) + '...' : null
      }))
    );
    
    // Debug: Log the specific bookmark being clicked
    console.log('[BOOKMARK NAVIGATION] Clicked bookmark data:', {
      id: bookmark.id,
      title: bookmark.title,
      chapterIndex: bookmark.chapterIndex,
      pageInChapter: bookmark.pageInChapter,
      percentage: bookmark.percentage,
      selectedText: bookmark.selectedText
    });
    
    // Navigate to reader with bookmark ID for proper text highlighting
    // Format: /read/{bookId}/{chapter}.{page}?bookmarkId={id}&collectionId={collectionId}
    const positionParam = bookmark.pageInChapter !== null && bookmark.pageInChapter !== undefined
      ? `${bookmark.chapterIndex || 0}.${bookmark.pageInChapter}`
      : `${bookmark.chapterIndex || 0}`;
    
    const url = `/read/${bookmark.bookId}/${positionParam}?bookmarkId=${bookmark.id}&fromCollection=${id}`;
    
    console.log('[BOOKMARK NAVIGATION] Navigating to:', url);
    
    window.location.href = url;
  };

  const handleReadBook = (bookId: string) => {
    // Navigate to reader at the beginning of the book
    window.location.href = `/read/${bookId}/0`;
  };

  // Group bookmarks by book
  const groupBookmarksByBook = (bookmarks: BookmarkWithBookInfo[]) => {
    const grouped: Record<string, { bookInfo: any; bookmarks: BookmarkWithBookInfo[] }> = {};
    
    bookmarks.forEach(bookmark => {
      const bookId = bookmark.bookId;
      if (!grouped[bookId]) {
        grouped[bookId] = {
          bookInfo: {
            id: bookmark.bookId,
            title: bookmark.bookTitle,
            author: bookmark.bookAuthor,
            coverImageUrl: bookmark.bookCoverImageUrl
          },
          bookmarks: []
        };
      }
      grouped[bookId].bookmarks.push(bookmark);
    });
    
    return Object.values(grouped);
  };

  // Get the associated books for the collection (if any)
  const getAssociatedBooks = () => {
    // First check if we have books from the collection.books property
    if (collection?.books && collection.books.length > 0) {
      return collection.books;
    }
    
    // Fallback: extract unique books from bookmarks
    if (collection?.bookmarks && collection.bookmarks.length > 0) {
      const uniqueBooks = new Map<string, any>();
      collection.bookmarks.forEach(bookmark => {
        if (!uniqueBooks.has(bookmark.bookId)) {
          uniqueBooks.set(bookmark.bookId, {
            id: bookmark.bookId,
            title: bookmark.bookTitle,
            author: bookmark.bookAuthor,
            coverImageUrl: bookmark.bookCoverImageUrl
          });
        }
      });
      return Array.from(uniqueBooks.values());
    }
    
    return [];
  };

  const associatedBooks = getAssociatedBooks();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('collections:pageTitle')}</h1>
          <p className="text-muted-foreground">{t('collections:detailPage.authRequired')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common:loading')}</p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">{t('collections:detailPage.emptyBookmarks.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('collections:detailPage.emptyBookmarks.description')}
          </p>
          <Button asChild>
            <Link href="/collections">
              {t('collections:backToCollections')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleCloneCollection = () => {
    // Implement clone functionality
    toast({
      title: t('common:info'),
      description: t('collections:toasts.comingSoon')
    });
  };

  // Group bookmarks by book for rendering
  const groupedBookmarks = collection ? groupBookmarksByBook(collection.bookmarks) : [];

  // DEBUG: Log collection data
  console.log('Collection data in detail page:', {
    ownerProfileRating: collection.ownerProfileRating,
    ownerId: collection.ownerId,
    ownerUsername: collection.ownerUsername,
    ownerFullName: collection.ownerFullName
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Back button, owner info, and collection title at the top */}
      <div className="mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          asChild
          className="text-sm font-normal pl-2 mb-2"
        >
          <Link href="/collections">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('collections:detailPage.backToList')}
          </Link>
        </Button>
        
        {/* Owner Info and Collection Title */}
        <div className="space-y-6 pt-2">
          <UserProfileDisplay
            userId={collection.ownerId || ''}
            username={collection.ownerUsername || ''}
            fullName={collection.ownerFullName}
            avatarUrl={collection.ownerAvatarUrl}
            profileRating={collection.ownerProfileRating}
            size="md"
          />
          <div>
            <h1 className="text-3xl font-bold">{collection.name}</h1>
            {collection.isPublic && (
              <Badge variant="outline" className="mt-2">{t('collections:collectionCard.public')}</Badge>
            )}
          </div>
        </div>
        
        {collection.description && (
          <div className="text-muted-foreground mt-4 whitespace-pre-wrap">
            {collection.description}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex gap-2">
          {collection.isOwn && (
            <Button asChild variant="outline">
              <Link href={`/collections/${collection.id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                {t('collections:detailPage.edit')}
              </Link>
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleCloneCollection}
          >
            <Copy className="w-4 h-4 mr-2" />
            {t('collections:detailPage.clone')}
          </Button>
          {collection.isOwn && (
            <Button 
              variant="outline" 
              onClick={handleDeleteCollection}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {collection.isClone && (
            <Badge variant="secondary">{t('collections:collectionCard.clone')}</Badge>
          )}
        </div>
      </div>

      {/* Collection metadata */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('collections:detailPage.metadata.created')} {formatDate(collection.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {collection.bookmarks.length} {t('collections:detailPage.metadata.bookmarksCount')}
              </span>
            </div>
            {collection.viewCount !== undefined && (
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {collection.viewCount} {t('collections:detailPage.metadata.views')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: collection.color }}
              ></div>
              <span className="text-sm text-muted-foreground">
                {t('collections:detailPage.metadata.collectionColor')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books in Collection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {t('collections:booksInCollection', { count: associatedBooks.length })}
          </CardTitle>
          <CardDescription>
            {t('collections:allBooksContainingBookmarks')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {associatedBooks.map((book) => {
              // Get bookmark count for this book in this collection
              const bookBookmarkCount = collection.bookmarks.filter(b => b.bookId === book.id).length;
              
              return (
                <div 
                  key={book.id} 
                  className="flex flex-col border rounded-lg hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => {
                    // Scroll to bookmarks section for this book
                    const bookSection = document.getElementById(`book-${book.id}`);
                    if (bookSection) {
                      bookSection.scrollIntoView({ behavior: 'smooth' });
                      // Highlight the section temporarily
                      bookSection.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                      setTimeout(() => {
                        bookSection.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                      }, 2000);
                    }
                  }}
                >
                  <div className="p-4 flex-1">
                    <div className="flex items-start gap-3">
                      {book.videoCoverUrl ? (
                        <div className="relative w-16 h-20 flex-shrink-0">
                          {/* Placeholder image shown initially */}
                          {book.coverImageUrl && (
                            <img 
                              data-book-id={book.id}
                              src={book.coverImageUrl?.startsWith('http') ? book.coverImageUrl : book.coverImageUrl?.startsWith('/') ? book.coverImageUrl : `/${book.coverImageUrl}`} 
                              alt={book.title}
                              className="w-16 h-20 object-cover rounded shadow-sm absolute inset-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          )}
                          {/* Video cover loaded behind the image */}
                          <video 
                            src={book.videoCoverUrl.startsWith('http') ? book.videoCoverUrl : book.videoCoverUrl.startsWith('/') ? book.videoCoverUrl : `/${book.videoCoverUrl}`}
                            className="w-16 h-20 object-cover rounded shadow-sm absolute inset-0"
                            autoPlay
                            muted
                            loop
                            onError={(e) => {
                              console.error('Video failed to load:', book.videoCoverUrl);
                              // If video fails, show image
                              const videoElement = e.target as HTMLVideoElement;
                              videoElement.style.display = 'none';
                            }}
                            onLoadedData={(e) => {
                              // When video loads, hide the placeholder image
                              const videoElement = e.target as HTMLVideoElement;
                              const parentDiv = videoElement.parentElement;
                              if (parentDiv) {
                                const imgElements = parentDiv.querySelectorAll('img:not([data-book-id])');
                                imgElements.forEach(img => (img as HTMLElement).style.display = 'none');
                              }
                            }}
                          />
                        </div>
                      ) : book.coverImageUrl ? (
                        <img 
                          src={book.coverImageUrl.startsWith('http') ? book.coverImageUrl : book.coverImageUrl.startsWith('/') ? book.coverImageUrl : `/${book.coverImageUrl}`} 
                          alt={book.title}
                          className="w-16 h-20 object-cover rounded shadow-sm flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-20 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
                          Нет обложки
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                          {book.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2 truncate">
                          {book.author}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {bookBookmarkCount} {t('collections:bookmarksCount', { count: bookBookmarkCount })}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-0 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReadBook(book.id);
                      }}
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      {t('common:reader.read')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {associatedBooks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('collections:noBookmarksInCollectionYet')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Books and their bookmarks */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">
          {t('collections:detailPage.bookmarksTitle')} ({collection.bookmarks.length} {t('collections:detailPage.metadata.bookmarksCount')})
        </h2>
      </div>

      {collection.bookmarks.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">{t('collections:detailPage.emptyBookmarks.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('collections:detailPage.emptyBookmarks.description')}
          </p>
          <Button asChild>
            <Link href="/home">
              {t('collections:detailPage.emptyBookmarks.goToBooks')}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* DEBUG: Log all book info */}
          {groupedBookmarks.map((group: any) => {
            console.log('Book info:', group.bookInfo);
            console.log('Cover image URL:', group.bookInfo.coverImageUrl);
            console.log('Constructed URL:', group.bookInfo.coverImageUrl ? `/${group.bookInfo.coverImageUrl}` : 'No cover image');
            return (
              <div key={group.bookInfo.id} id={`book-${group.bookInfo.id}`} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              {/* Book header */}
              <div className="flex items-start gap-4 mb-6">
                {group.bookInfo.videoCoverUrl ? (
                  <div className="relative w-24 h-36">
                    {/* Placeholder image shown initially */}
                    {group.bookInfo.coverImageUrl && (
                      <img 
                        data-book-title={group.bookInfo.title}
                        src={group.bookInfo.coverImageUrl?.startsWith('http') ? group.bookInfo.coverImageUrl : group.bookInfo.coverImageUrl?.startsWith('/') ? group.bookInfo.coverImageUrl : `/${group.bookInfo.coverImageUrl}`}
                        alt={group.bookInfo.title}
                        className="w-24 h-36 object-cover rounded absolute inset-0"
                        onError={(e) => {
                          console.error('Image failed to load:', group.bookInfo.coverImageUrl);
                          // @ts-ignore
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    {/* Video cover loaded behind the image */}
                    <video 
                      src={group.bookInfo.videoCoverUrl.startsWith('http') ? group.bookInfo.videoCoverUrl : group.bookInfo.videoCoverUrl.startsWith('/') ? group.bookInfo.videoCoverUrl : `/${group.bookInfo.videoCoverUrl}`}
                      className="w-24 h-36 object-cover rounded absolute inset-0"
                      autoPlay
                      muted
                      loop
                      onError={(e) => {
                        console.error('Video failed to load:', group.bookInfo.videoCoverUrl);
                        // If video fails, show image
                        const videoElement = e.target as HTMLVideoElement;
                        videoElement.style.display = 'none';
                      }}
                      onLoadedData={(e) => {
                        // When video loads, hide the placeholder image
                        const videoElement = e.target as HTMLVideoElement;
                        const parentDiv = videoElement.parentElement;
                        if (parentDiv) {
                          const imgElements = parentDiv.querySelectorAll('img:not([data-book-title])');
                          imgElements.forEach(img => (img as HTMLElement).style.display = 'none');
                        }
                      }}
                    />
                  </div>
                ) : group.bookInfo.coverImageUrl ? (
                  <img 
                    src={group.bookInfo.coverImageUrl.startsWith('http') ? group.bookInfo.coverImageUrl : group.bookInfo.coverImageUrl.startsWith('/') ? group.bookInfo.coverImageUrl : `/${group.bookInfo.coverImageUrl}`}
                    alt={group.bookInfo.title}
                    className="w-24 h-36 object-cover rounded"
                    onError={(e) => {
                      console.error('Image failed to load:', group.bookInfo.coverImageUrl);
                      // @ts-ignore
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                    No Cover
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{group.bookInfo.title}</h3>
                  {group.bookInfo.author && (
                    <p className="text-muted-foreground mb-3">{group.bookInfo.author}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReadBook(group.bookInfo.id)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      {t('common:reader.read')}
                    </Button>
                    <span>{group.bookmarks.length} {t('collections:collectionCard.bookmarks')}</span>
                  </div>
                </div>
              </div>
              
              {/* Bookmarks list for this book */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.bookmarks.map((bookmark: BookmarkWithBookInfo) => (
                  <Card key={bookmark.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg mb-2 line-clamp-2">
                        {bookmark.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bookmark.selectedText && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground line-clamp-3 italic">
                            "{bookmark.selectedText}"
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                        {bookmark.percentage !== null && (
                          <span>{Math.round(bookmark.percentage)}% {t('common:reader.progressBook')}</span>
                        )}
                        <span>
                          {t('common:reader.progressChapter')}: {bookmark.chapterIndex !== null ? bookmark.chapterIndex + 1 : 'N/A'}
                        </span>
                        {bookmark.pageInChapter !== null && (
                          <span>
                            {t('common:reader.progressPage')} {bookmark.pageInChapter + 1}
                          </span>
                        )}
                        {bookmark.clickCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {bookmark.clickCount} {t('collections:collectionCard.clicks')}
                          </span>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full"
                        onClick={() => handleReadBookmark(bookmark)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {t('collections:collectionCard.view')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}