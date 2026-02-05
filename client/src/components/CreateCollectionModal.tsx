import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { bookmarkCollectionsApi, booksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Plus, X, Search, Book } from 'lucide-react';

interface CreateCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollectionCreated?: (collection: any) => void;
  currentBookId?: string; // Optional book ID for context
  currentBookTitle?: string; // Optional book title for context
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function CreateCollectionModal({ open, onOpenChange, onCollectionCreated, currentBookId, currentBookTitle }: CreateCollectionModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation(['collections', 'shelves']);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPublic, setIsPublic] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Book search state
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<any[]>([]);
  const [showBookSearch, setShowBookSearch] = useState(false);
  
  // Set default book if provided
  useEffect(() => {
    if (currentBookId && currentBookTitle && selectedBooks.length === 0) {
      const defaultBook = {
        id: currentBookId,
        title: currentBookTitle
      };
      setSelectedBooks([defaultBook]);
      
      // Pre-fill name with book title
      if (!name) {
        setName(`Закладки для ${currentBookTitle}`);
      }
      
      // Pre-fill description
      if (!description) {
        setDescription(`Коллекция закладок для книги ${currentBookTitle}`);
      }
    }
  }, [currentBookId, currentBookTitle, selectedBooks.length, name, description]);
  
  // Search books
  useEffect(() => {
    if (bookSearchQuery.length < 2) {
      setBookSearchResults([]);
      return;
    }
    
    const searchBooks = async () => {
      try {
        const response = await booksApi.searchBooks(bookSearchQuery);
        if (response.ok) {
          const data = await response.json();
          // Transform the data to match our expected format
          const results = data.map((book: any) => ({
            id: book.id,
            title: book.title,
            author: book.author
          }));
          setBookSearchResults(results);
        }
      } catch (error) {
        console.error('Error searching books:', error);
      }
    };
    
    const timeoutId = setTimeout(searchBooks, 300);
    return () => clearTimeout(timeoutId);
  }, [bookSearchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t('collections:error'),
        description: t('collections:nameRequired'),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      // Create form data for the collection
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('color', color);
      formData.append('isPublic', String(isPublic));
      
      if (coverImage) {
        formData.append('coverImage', coverImage);
      }
      
      if (selectedBooks.length > 0) {
        selectedBooks.forEach((book, index) => {
          formData.append(`bookIds[${index}]`, book.id);
        });
      }

      const response = await fetch('/api/bookmark-collections', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const collection = await response.json();
        toast({
          title: t('collections:success'),
          description: t('collections:collectionCreated', { name: collection.name })
        });
        
        // Reset form
        setName('');
        setDescription('');
        setColor('#3b82f6');
        setIsPublic(false);
        setCoverImage(null);
        setCoverImageUrl(null);
        setSelectedBooks([]);
        setBookSearchQuery('');
        setBookSearchResults([]);
        setShowBookSearch(false);
        
        // Close modal and notify parent
        onOpenChange(false);
        onCollectionCreated?.(collection);
      } else {
        const error = await response.json();
        toast({
          title: t('collections:error'),
          description: error.error || t('collections:failedToCreate')
        });
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast({
        title: t('collections:error'),
        description: t('collections:failedToCreate')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setIsPublic(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t('collections:createBookmarkCollection')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('collections:nameLabel')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('collections:namePlaceholder')}
              required
              autoFocus
            />
          </div>
          
          {/* Book selection */}
          <div className="space-y-2">
            <Label>{t('collections:booksLabel')}</Label>
            
            {/* Selected books display */}
            {selectedBooks.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg border">
                {selectedBooks.map(book => (
                  <div key={book.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                    <Book className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium text-sm truncate" title={book.title}>{book.title}</div>
                      <div className="text-xs text-muted-foreground truncate" title={book.author}>{book.author}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 ml-1"
                      onClick={() => {
                        setSelectedBooks(prev => prev.filter(b => b.id !== book.id));
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add book button */}
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowBookSearch(!showBookSearch)}
            >
              <Plus className="w-4 h-4 mr-2" />
              {selectedBooks.length > 0 ? t('collections:addAnotherBook') : t('collections:selectBooks')}
            </Button>
            
            {showBookSearch && (
              <div className="space-y-2">
                <Input
                  placeholder={t('collections:searchBooksPlaceholder')}
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  className="w-full"
                  autoFocus
                />
                
                {bookSearchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border rounded-md bg-background">
                    {bookSearchResults.map(book => (
                      <div
                        key={book.id}
                        className={`p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 ${
                          selectedBooks.some(b => b.id === book.id) 
                            ? 'bg-muted/50 opacity-50 cursor-not-allowed' 
                            : ''
                        }`}
                        onClick={() => {
                          // Don't allow selecting already selected books
                          if (selectedBooks.some(b => b.id === book.id)) return;
                          
                          setSelectedBooks(prev => [...prev, book]);
                          setBookSearchQuery('');
                          setBookSearchResults([]);
                          
                          // Update name and description if it's the first book
                          if (selectedBooks.length === 0) {
                            if (!name || name.includes('Закладки для')) {
                              setName(`Закладки для ${book.title}`);
                            }
                            if (!description || description.includes('Коллекция закладок')) {
                              setDescription(`Коллекция закладок для книги ${book.title}`);
                            }
                          } else {
                            // For multiple books, update to plural form
                            if (name && name.includes('Закладки для')) {
                              setName('Тематическая коллекция закладок');
                            }
                            if (description && description.includes('Коллекция закладок для книги')) {
                              setDescription('Коллекция закладок для нескольких книг');
                            }
                          }
                        }}
                      >
                        <div className="font-medium text-sm truncate" title={book.title}>{book.title}</div>
                        <div className="text-xs text-muted-foreground truncate" title={book.author}>{book.author}</div>
                        {selectedBooks.some(b => b.id === book.id) && (
                          <div className="text-xs text-muted-foreground mt-1">{t('collections:alreadySelected')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {bookSearchQuery.length >= 2 && bookSearchResults.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {t('collections:noBooksFound')}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('collections:descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('collections:descriptionPlaceholder')}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>{t('collections:collectionColorLabel')}</Label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all flex-shrink-0 ${
                    color === presetColor 
                      ? 'border-primary ring-2 ring-primary/30' 
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                  aria-label={t('collections:ariaSelectColor', { color: presetColor })}
                />
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              id="isPublic"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isPublic" className="cursor-pointer">
              {t('collections:publicCollectionLabel')}
            </Label>
          </div>
          
          {/* Cover Image Upload */}
          <div className="space-y-2">
            <Label htmlFor="coverImage">{t('collections:coverImageLabel')}</Label>
            <div className="flex items-center gap-4">
              {coverImageUrl && (
                <img 
                  src={coverImageUrl} 
                  alt={t('collections:coverImagePreview')} 
                  className="w-16 h-16 rounded object-cover border"
                />
              )}
              <Input
                id="coverImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCoverImage(file);
                    setCoverImageUrl(URL.createObjectURL(file));
                  }
                }}
                className="flex-1"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  {t('collections:creating')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('collections:create')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}