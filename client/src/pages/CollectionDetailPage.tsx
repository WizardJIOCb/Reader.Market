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

  const handleReadBookmark = (bookmark: BookmarkWithBookInfo) => {
    // Navigate to reader at the bookmark position
    window.location.href = `/read/${bookmark.bookId}/${bookmark.chapterIndex || 0}`;
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
              Вернуться к коллекциям
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
          {groupedBookmarks.map((group: any) => (
            <div key={group.bookInfo.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              {/* Book header */}
              <div className="flex items-start gap-4 mb-6">
                {group.bookInfo.coverImageUrl && (
                  <img 
                    src={group.bookInfo.coverImageUrl} 
                    alt={group.bookInfo.title}
                    className="w-16 h-24 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{group.bookInfo.title}</h3>
                  {group.bookInfo.author && (
                    <p className="text-muted-foreground mb-3">{group.bookInfo.author}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{group.bookmarks.length} {t('collections:collectionCard.bookmarks')}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReadBook(group.bookInfo.id)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      {t('common:reader.read')}
                    </Button>
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
                      
                      <div className="flex justify-between items-center text-xs text-muted-foreground mb-4">
                        <span>
                          {t('common:reader.progressChapter')}: {bookmark.chapterIndex !== null ? bookmark.chapterIndex + 1 : 'N/A'}
                        </span>
                        {bookmark.percentage !== null && (
                          <span>{Math.round(bookmark.percentage)}% {t('common:reader.progressBook')}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}