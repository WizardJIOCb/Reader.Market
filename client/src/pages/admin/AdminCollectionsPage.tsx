import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Users,
  BookOpen,
  Calendar,
  EyeIcon,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { bookmarkCollectionsApi, adminUsersApi } from '@/lib/api';
import { BookmarkCollection } from '@/types/bookmarkCollections';

export function AdminCollectionsPage() {
  const { toast } = useToast();
  const { t } = useTranslation(['admin', 'collections', 'common']);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<BookmarkCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for user management
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  
  // State for modal
  const [showModal, setShowModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<BookmarkCollection | null>(null);
  const [formValues, setFormValues] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    isPublic: false,
    userId: '',
    coverImage: null as File | null
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);
  
  useEffect(() => {
    filterCollections();
  }, [collections, searchTerm]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/collections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      } else {
        const error = await response.json();
        toast({
          title: t('common:error'),
          description: error.error || t('admin:failedToLoadCollections'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast({
        title: t('common:error'),
        description: t('admin:failedToLoadCollections'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await adminUsersApi.getAllUsers({ limit: 1000 }); // Get all users
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        const error = await response.json();
        console.error('Error fetching users:', error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const filterCollections = () => {
    if (!searchTerm) {
      setFilteredCollections(collections);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = collections.filter(collection => 
      collection.name.toLowerCase().includes(term) ||
      (collection.description && collection.description.toLowerCase().includes(term)) ||
      collection.ownerUsername?.toLowerCase().includes(term) ||
      collection.userId.toLowerCase().includes(term)
    );

    setFilteredCollections(filtered);
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(t('admin:confirmDeleteCollection', { name }))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/collections/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        setCollections(collections.filter(col => col.id !== id));
        toast({
          title: t('common:success'),
          description: t('admin:collectionDeleted', { name }),
        });
      } else {
        const error = await response.json();
        toast({
          title: t('common:error'),
          description: error.error || t('admin:failedToDeleteCollection'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast({
        title: t('common:error'),
        description: t('admin:failedToDeleteCollection'),
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  const openCreateModal = () => {
    setEditingCollection(null);
    setFormValues({
      name: '',
      description: '',
      color: '#3b82f6',
      isPublic: false,
      userId: '',
      coverImage: null
    });
    setImagePreview(null);
    setShowModal(true);
  };
  
  const openEditModal = (collection: BookmarkCollection) => {
    setEditingCollection(collection);
    setFormValues({
      name: collection.name,
      description: collection.description || '',
      color: collection.color || '#3b82f6',
      isPublic: collection.isPublic,
      userId: collection.userId,
      coverImage: null
    });
    setImagePreview(collection.coverImageUrl || null);
    setShowModal(true);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormValues(prev => ({
        ...prev,
        [name]: target.checked
      }));
    } else {
      setFormValues(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormValues(prev => ({
        ...prev,
        coverImage: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('name', formValues.name);
      formData.append('description', formValues.description);
      formData.append('color', formValues.color);
      formData.append('isPublic', formValues.isPublic.toString());
      formData.append('userId', formValues.userId);
      
      if (formValues.coverImage) {
        formData.append('coverImage', formValues.coverImage);
      }
      
      let response;
      if (editingCollection) {
        // Update existing collection
        response = await fetch(`/api/admin/collections/${editingCollection.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: formData,
        });
      } else {
        // Create new collection
        response = await fetch('/api/admin/collections', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: formData,
        });
      }
      
      if (response.ok) {
        const result = await response.json();
        
        if (editingCollection) {
          // Update the collection in the list
          setCollections(prev => prev.map(col => col.id === result.id ? result : col));
          toast({
            title: t('common:success'),
            description: t('admin:collectionUpdated', { name: result.name }),
          });
        } else {
          // Add the new collection to the list
          setCollections(prev => [result, ...prev]);
          toast({
            title: t('common:success'),
            description: t('admin:collectionCreated', { name: result.name }),
          });
        }
        
        setShowModal(false);
      } else {
        const error = await response.json();
        toast({
          title: t('common:error'),
          description: error.error || (editingCollection ? t('admin:failedToUpdateCollection') : t('admin:failedToCreateCollection')),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(editingCollection ? 'Error updating collection:' : 'Error creating collection:', error);
      toast({
        title: t('common:error'),
        description: editingCollection ? t('admin:failedToUpdateCollection') : t('admin:failedToCreateCollection'),
        variant: 'destructive',
      });
    } finally {
      setModalLoading(false);
    }
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingCollection(null);
    setImagePreview(null);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('admin:collections.manageCollections')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('admin:collections.manageCollectionsDescription')}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('admin:collections.collectionsList')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={openCreateModal} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('admin:collections.create')}
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('admin:collections.searchCollections')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? t('admin:noCollectionsFound') : t('admin:noCollections')}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? t('admin:noCollectionsMatchSearch') 
                  : t('admin:noCollectionsDescription')
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:id')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:name')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:coverImage')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:owner')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:collections.stats')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:visibility')}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('admin:createdAt')}</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t('admin:actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.map((collection) => (
                    <tr key={collection.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {collection.id.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{collection.name}</div>
                        {collection.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">
                            {collection.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {collection.coverImageUrl ? (
                          <img 
                            src={collection.coverImageUrl.startsWith('http') 
                              ? collection.coverImageUrl 
                              : collection.coverImageUrl.startsWith('/') ? collection.coverImageUrl : `/${collection.coverImageUrl}`}
                            alt={collection.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded flex items-center justify-center"
                            style={{ backgroundColor: collection.color || '#3b82f6' }}
                          >
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{collection.ownerUsername || collection.ownerFullName || collection.userId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {collection.bookCount || 0} {t('admin:collections.books')}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            📌 {collection.bookmarkCount || 0} {t('admin:collections.bookmarks')}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <EyeIcon className="w-3 h-3 mr-1" />
                            {collection.viewCount || 0} {t('admin:collections.views')}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {collection.isPublic ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            {t('collections:collectionCard.public')}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-gray-100 text-gray-800">
                            {t('collections:collectionCard.private')}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(collection.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            title={t('admin:viewCollection')}
                          >
                            <a href={`/collections/${collection.id}`} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            title={t('admin:editCollection')}
                          >
                            <a href={`/collections/${collection.id}/edit`} target="_blank" rel="noopener noreferrer">
                              <Edit className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteCollection(collection.id, collection.name)}
                            title={t('admin:deleteCollection')}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Modal for creating/editing collections */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCollection ? t('admin:collections.editCollection') : t('admin:collections.create')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t('admin:name')}</Label>
                <Input
                  id="name"
                  name="name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">{t('admin:description')}</Label>
                <Input
                  id="description"
                  name="description"
                  value={formValues.description}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color">{t('admin:color')}</Label>
                  <Input
                    id="color"
                    name="color"
                    type="color"
                    value={formValues.color}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="flex items-center pt-2">
                  <input
                    id="isPublic"
                    name="isPublic"
                    type="checkbox"
                    checked={formValues.isPublic}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary"
                  />
                  <Label htmlFor="isPublic" className="ml-2">
                    {t('collections:collectionCard.public')}
                  </Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="userId">{t('admin:owner')}</Label>
                <Select
                  name="userId"
                  value={formValues.userId}
                  onValueChange={(value) => setFormValues(prev => ({ ...prev, userId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin:collections.selectOwner')} />
                  </SelectTrigger>
                  <SelectContent>
                    {usersLoading ? (
                      <SelectItem value="" disabled>{t('common:loading')}</SelectItem>
                    ) : (
                      users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username} ({user.fullName || user.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="coverImage">{t('collections:coverImage')}</Label>
                <Input
                  id="coverImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-1">{t('collections:imagePreview')}:</p>
                    <img 
                      src={imagePreview} 
                      alt={t('collections:imagePreview')} 
                      className="max-w-xs max-h-32 object-contain border rounded"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={closeModal}
                disabled={modalLoading}
              >
                <X className="w-4 h-4 mr-2" />
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={modalLoading}>
                {modalLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 mr-2 border-b-2 border-white"></div>
                    {editingCollection ? t('admin:collections.saving') : t('admin:collections.creating')}
                  </div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingCollection ? t('admin:collections.saveChanges') : t('admin:collections.create')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}