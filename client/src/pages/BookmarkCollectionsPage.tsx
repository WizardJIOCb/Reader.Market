import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { bookmarkCollectionsApi } from '@/lib/api';
import { BookmarkCollection } from '@/types/bookmarkCollections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { CloneCollectionModal } from '@/components/CloneCollectionModal';
import { CreateCollectionModal } from '@/components/CreateCollectionModal';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  Search, 
  BookOpen, 
  Edit, 
  Trash2, 
  Eye,
  Filter,
  Copy
} from 'lucide-react';

export function BookmarkCollectionsPage() {
  const { user } = useAuth();
  const { t } = useTranslation(['collections', 'common']);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<BookmarkCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'popular' | 'own' | 'others' | 'clones'>('all');
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [collectionToClone, setCollectionToClone] = useState<BookmarkCollection | null>(null);

  useEffect(() => {
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      if (user) {
        fetchCollections();
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [user, searchTerm]);

  useEffect(() => {
    filterCollections();
  }, [collections, searchTerm, filter]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      // Fetch both user's collections and public collections from others when searching
      const response = await bookmarkCollectionsApi.getCollections({
        search: searchTerm || undefined,
        includeOthers: !!searchTerm
      });
      
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      } else {
        toast({
          title: t('common:error'),
          description: t('collections:toasts.error'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast({
        title: t('common:error'),
        description: t('collections:toasts.error'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCollections = () => {
    let filtered = [...collections];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(collection => 
        collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (collection.description && collection.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply type filter
    switch (filter) {
      case 'recent':
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'popular':
        filtered = filtered.sort((a, b) => 
          (b.bookmarkCount || 0) - (a.bookmarkCount || 0)
        );
        break;
      case 'own':
        filtered = filtered.filter(collection => collection.isOwn);
        break;
      case 'others':
        filtered = filtered.filter(collection => !collection.isOwn);
        break;
      case 'clones':
        filtered = filtered.filter(collection => collection.isClone);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    setFilteredCollections(filtered);
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`${t('collections:modals.deleteConfirm.message')} "${name}"? ${t('collections:modals.deleteConfirm.warning')}`)) {
      return;
    }

    try {
      const response = await bookmarkCollectionsApi.deleteCollection(id);
      if (response.ok) {
        setCollections(collections.filter(c => c.id !== id));
        toast({
          title: t('common:success'),
          description: `${t('collections:toasts.deleted')} "${name}"`
        });
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

  const handleCloneCollection = (collection: BookmarkCollection) => {
    setCollectionToClone(collection);
    setCloneModalOpen(true);
  };

  const handleCloneSuccess = () => {
    // Refresh collections list
    fetchCollections();
  };

  const handleCloseCloneModal = () => {
    setCloneModalOpen(false);
    setCollectionToClone(null);
  };

  const handleCreateCollection = () => {
    setCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    // Refresh collections list
    fetchCollections();
    setCreateModalOpen(false);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
  };
  const formatDate = (dateString: string) => {
    const locale = localStorage.getItem('i18nextLng') || 'ru';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderOwnerInfo = (collection: BookmarkCollection) => {
    if (!collection.ownerId || !collection.ownerUsername) return null;
    
    const displayName = collection.ownerFullName || collection.ownerUsername;
    const initials = displayName
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
        <Avatar className="w-6 h-6">
          <AvatarImage src={collection.ownerAvatarUrl || ''} alt={displayName} />
          <AvatarFallback className="text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <Link 
          href={`/profile/${collection.ownerId}`}
          className="truncate hover:text-primary transition-colors"
        >
          {displayName}
        </Link>
        {collection.ownerProfileRating !== null && collection.ownerProfileRating !== undefined && typeof collection.ownerProfileRating === 'number' && (
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            <span>{collection.ownerProfileRating.toFixed(1)}</span>
          </div>
        )}
        {collection.isClone && (
          <Badge variant="secondary" className="text-xs">
            {t('collections:collectionCard.clone')}
          </Badge>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Коллекции закладок</h1>
          <p className="text-muted-foreground">Пожалуйста, войдите в систему для просмотра ваших коллекций</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold mb-2">{t('collections:pageTitle')}</h1>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('collections:searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-1">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('all')}
          >
            {t('collections:filters.all')}
          </Button>
          <Button
            variant={filter === 'own' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('own')}
          >
            {t('collections:filters.own')}
          </Button>
          <Button
            variant={filter === 'others' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('others')}
          >
            {t('collections:filters.others')}
          </Button>
          <Button
            variant={filter === 'clones' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('clones')}
          >
            {t('collections:filters.clones')}
          </Button>
          <Button
            variant={filter === 'recent' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('recent')}
          >
            {t('collections:filters.recent')}
          </Button>
          <Button
            variant={filter === 'popular' ? 'default' : 'outline'}
            size="sm"
            className="w-full px-2 py-2 text-xs sm:w-auto sm:px-2 sm:py-1"
            onClick={() => setFilter('popular')}
          >
            {t('collections:filters.popular')}
          </Button>
          <div className="col-span-3 sm:col-span-1 sm:w-auto">
            <Button
              variant="default"
              size="sm"
              onClick={handleCreateCollection}
              className="w-full py-2 text-xs sm:w-auto sm:py-1 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>{t('collections:createCollection')}</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common:loading')}</p>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">{t('collections:emptyState.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm 
              ? t('collections:emptyState.noResults') 
              : t('collections:emptyState.noCollections')
            }
          </p>
          {!searchTerm && (
            <Button onClick={handleCreateCollection}>
              <Plus className="w-4 h-4 mr-2" />
              {t('collections:createCollection')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <Card key={collection.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: collection.color }}
                    ></div>
                    <CardTitle 
                      className="text-xl truncate hover:text-primary transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/collections/${collection.id}`}
                    >
                      {collection.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {(collection.bookmarkCount || 0)} {t('collections:collectionCard.bookmarks')}
                    </Badge>
                  </div>
                  {collection.description && (
                    <CardDescription 
                      className="line-clamp-2 text-sm mt-2 hover:text-primary transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/collections/${collection.id}`}
                    >
                      {collection.description}
                    </CardDescription>
                  )}
                  {renderOwnerInfo(collection)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground mb-4 flex-wrap gap-2">
                  <span className="truncate">{t('collections:collectionCard.created')} {formatDate(collection.createdAt)}</span>
                  <div className="flex gap-1">
                    {collection.isPublic ? (
                      <Badge variant="outline" className="text-xs whitespace-nowrap bg-green-50 border-green-200 text-green-700">
                        {t('collections:collectionCard.public')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs whitespace-nowrap bg-gray-100 border-gray-300 text-gray-600">
                        {t('collections:collectionCard.private')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    asChild 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/collections/${collection.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      {t('collections:collectionCard.view')}
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleCloneCollection(collection)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/collections/${collection.id}/edit`}>
                      <Edit className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDeleteCollection(collection.id, collection.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <CloneCollectionModal
        isOpen={cloneModalOpen}
        onClose={handleCloseCloneModal}
        collectionId={collectionToClone?.id || ''}
        originalName={collectionToClone?.name || ''}
        onCloneSuccess={handleCloneSuccess}
      />
      
      <CreateCollectionModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCollectionCreated={handleCreateSuccess}
      />
    </div>
  );
}