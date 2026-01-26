import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { bookmarkCollectionsApi, booksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Book search state
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [showBookSearch, setShowBookSearch] = useState(false);
  
  // Set default book if provided
  useEffect(() => {
    if (currentBookId && currentBookTitle && !selectedBook) {
      setSelectedBook({
        id: currentBookId,
        title: currentBookTitle
      });
      
      // Pre-fill name with book title
      if (!name) {
        setName(`Закладки для ${currentBookTitle}`);
      }
      
      // Pre-fill description
      if (!description) {
        setDescription(`Коллекция закладок для книги ${currentBookTitle}`);
      }
    }
  }, [currentBookId, currentBookTitle, selectedBook, name, description]);
  
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
        title: 'Ошибка',
        description: 'Название коллекции обязательно',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await bookmarkCollectionsApi.createCollection({
        name: name.trim(),
        description: description.trim(),
        color,
        isPublic,
        bookId: selectedBook?.id // Include book ID if selected
      });

      if (response.ok) {
        const collection = await response.json();
        toast({
          title: 'Успех',
          description: `Коллекция "${collection.name}" создана`
        });
        
        // Reset form
        setName('');
        setDescription('');
        setColor('#3b82f6');
        setIsPublic(false);
        setSelectedBook(null);
        setBookSearchQuery('');
        setBookSearchResults([]);
        setShowBookSearch(false);
        
        // Close modal and notify parent
        onOpenChange(false);
        onCollectionCreated?.(collection);
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось создать коллекцию',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать коллекцию',
        variant: 'destructive'
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Создать коллекцию закладок
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название коллекции"
              required
              autoFocus
            />
          </div>
          
          {/* Book selection */}
          <div className="space-y-2">
            <Label>Книга (опционально)</Label>
            
            {selectedBook ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <Book className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{selectedBook.title}</div>
                  <div className="text-xs text-muted-foreground">Выбранная книга</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedBook(null);
                    setBookSearchQuery('');
                    setBookSearchResults([]);
                    setShowBookSearch(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowBookSearch(!showBookSearch)}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {showBookSearch ? 'Скрыть поиск' : 'Выбрать книгу'}
                </Button>
                
                {showBookSearch && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Поиск книг..."
                      value={bookSearchQuery}
                      onChange={(e) => setBookSearchQuery(e.target.value)}
                      className="w-full"
                    />
                    
                    {bookSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                        {bookSearchResults.map(book => (
                          <div
                            key={book.id}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              setSelectedBook(book);
                              setShowBookSearch(false);
                              
                              // Update name and description if not already customized
                              if (!name || name.includes('Закладки для')) {
                                setName(`Закладки для ${book.title}`);
                              }
                              if (!description || description.includes('Коллекция закладок')) {
                                setDescription(`Коллекция закладок для книги ${book.title}`);
                              }
                            }}
                          >
                            <div className="font-medium text-sm">{book.title}</div>
                            <div className="text-xs text-muted-foreground">{book.author}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {bookSearchQuery.length >= 2 && bookSearchResults.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Книги не найдены
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание коллекции (необязательно)"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Цвет коллекции</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === presetColor 
                      ? 'border-primary ring-2 ring-primary/30' 
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                  aria-label={`Выбрать цвет ${presetColor}`}
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
              Публичная коллекция
            </Label>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Создание...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}