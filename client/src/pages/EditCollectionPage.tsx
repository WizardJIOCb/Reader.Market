import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@/lib/auth';
import { bookmarkCollectionsApi, booksApi } from '@/lib/api';
import { BookmarkCollection } from '@/types/bookmarkCollections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Palette, Search, X, BookOpen } from 'lucide-react';

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

export function EditCollectionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [collection, setCollection] = useState<BookmarkCollection | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPublic, setIsPublic] = useState(false);
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<Array<{id: string, title: string, author: string}>>([]);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState<Array<{id: string, title: string, author: string}>>([]);
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchCollection();
    }
  }, [user, id]);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description || '');
      setColor(collection.color);
      setIsPublic(collection.isPublic);
      
      // Handle multiple books (new approach)
      if (collection.books && Array.isArray(collection.books) && collection.books.length > 0) {
        // Collection has books array with book info
        const books = collection.books.map((book: any) => ({
          id: book.id,
          title: book.title,
          author: book.author
        }));
        setSelectedBooks(books);
        setBookIds(books.map(book => book.id));
      } else if (collection.bookIds && Array.isArray(collection.bookIds) && collection.bookIds.length > 0) {
        // Collection has bookIds array, need to fetch book info
        const bookIdsArray = collection.bookIds;
        setBookIds(bookIdsArray);
        
        // Fetch book info for each bookId
        const fetchBooksInfo = async () => {
          try {
            const bookPromises = bookIdsArray.map(async (bookId: string) => {
              const response = await booksApi.getBookById(bookId);
              if (response.ok) {
                const bookData = await response.json();
                return {
                  id: bookData.id,
                  title: bookData.title,
                  author: bookData.author
                };
              }
              return null;
            });
            
            const books = (await Promise.all(bookPromises)).filter(Boolean) as Array<{id: string, title: string, author: string}>;
            setSelectedBooks(books);
          } catch (error) {
            console.error('Error fetching books info:', error);
          }
        };
        
        fetchBooksInfo();
      } else if (collection.bookId) {
        // Handle existing single bookId (backward compatibility)
        setBookIds([collection.bookId]);
        
        // Fetch the book info
        const fetchBookInfo = async () => {
          try {
            const response = await booksApi.getBookById(collection.bookId!);
            if (response.ok) {
              const bookData = await response.json();
              // Set the selected books state
              setSelectedBooks([{
                id: bookData.id,
                title: bookData.title,
                author: bookData.author
              }]);
            }
          } catch (error) {
            console.error('Error fetching book info:', error);
          }
        };
        fetchBookInfo();
      } else {
        // If no books, make sure selectedBooks is cleared
        setBookIds([]);
        setSelectedBooks([]);
      }
    }
  }, [collection, collection?.id]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const response = await bookmarkCollectionsApi.getCollection(id!);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        toast({
          title: "Ошибка",
          description: "Коллекция не найдена",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке коллекции",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Book search functionality
  const handleBookSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setBookSearchResults([]);
      return;
    }
    
    try {
      const response = await booksApi.searchBooks(query, 'title', 'asc');
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

  const handleSelectBook = (book: {id: string, title: string, author: string}) => {
    // Check if book is already selected
    if (!bookIds.includes(book.id)) {
      setSelectedBooks(prev => [...prev, book]);
      setBookIds(prev => [...prev, book.id]);
    }
    setShowBookSearch(false);
    setBookSearchQuery('');
    setBookSearchResults([]);
  };

  const handleRemoveBook = (bookId: string) => {
    setSelectedBooks(prev => prev.filter(book => book.id !== bookId));
    setBookIds(prev => prev.filter(id => id !== bookId));
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (bookSearchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleBookSearch(bookSearchQuery);
      }, 300);
    } else {
      setBookSearchResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [bookSearchQuery]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название коллекции обязательно",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    
    try {
      console.log('Submitting collection update:');
      console.log('Collection ID:', id);
      console.log('Name:', name.trim());
      console.log('Description:', description.trim() || undefined);
      console.log('Color:', color);
      console.log('Is Public:', isPublic);
      console.log('Book IDs:', bookIds);
      console.log('Selected Books Count:', selectedBooks.length);
      
      const requestData = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        isPublic,
        bookIds: bookIds.length > 0 ? bookIds : undefined
      };
      
      console.log('Request Data:', requestData);
      
      const response = await bookmarkCollectionsApi.updateCollection(id!, requestData);
      
      if (response.ok) {
        const updatedCollection = await response.json();
        toast({
          title: "Успешно",
          description: `Коллекция "${updatedCollection.name}" обновлена`
        });
        
        // Redirect to collection detail page
        window.location.href = `/collections/${id}`;
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось обновить коллекцию",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating collection:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при обновлении коллекции",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Редактировать коллекцию</h1>
          <p className="text-muted-foreground">Пожалуйста, войдите в систему для редактирования коллекций</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка коллекции...</p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Коллекция не найдена</h1>
          <p className="text-muted-foreground">Запрашиваемая коллекция не существует</p>
          <Button asChild className="mt-4">
            <Link href="/collections">
              Вернуться к коллекциям
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/collections/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Редактировать коллекцию</h1>
          <p className="text-muted-foreground">
            Измените информацию о вашей коллекции
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редактирование коллекции</CardTitle>
          <CardDescription>
            Обновите информацию о коллекции "{collection.name}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" key={collection.id}>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название коллекции"
                maxLength={100}
                required
              />
              <p className="text-sm text-muted-foreground">
                {name.length}/100 символов
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание коллекции..."
                maxLength={500}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                {description.length}/500 символов
              </p>
            </div>

            {/* Books Selection */}
            <div className="space-y-2">
              <Label>Книги (опционально)</Label>
              
              {/* Selected Books Display */}
              {selectedBooks.length > 0 && (
                <div className="space-y-2">
                  {selectedBooks.map((book) => (
                    <div key={book.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBook(book.id)}
                        title="Удалить книгу"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Book Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowBookSearch(!showBookSearch)}
              >
                <Search className="w-4 h-4 mr-2" />
                {showBookSearch ? 'Отменить выбор книг' : 'Добавить книгу'}
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
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {bookSearchResults.map((book) => (
                        <div
                          key={book.id}
                          className="p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSelectBook(book)}
                        >
                          <p className="font-medium truncate">{book.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {bookSearchQuery.trim().length >= 2 && bookSearchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Книги не найдены
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Выберите книги, к которым будет принадлежать эта коллекция (опционально)
              </p>
            </div>

            {/* Color Picker */}
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
                        : 'border-border hover:scale-110'
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                    aria-label={`Выбрать цвет ${presetColor}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  {color.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="public">Публичная коллекция</Label>
                <p className="text-sm text-muted-foreground">
                  Сделать коллекцию видимой для других пользователей
                </p>
              </div>
              <Button
                type="button"
                variant={isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(!isPublic)}
                className="w-12 h-6 p-0"
              >
                {isPublic ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" asChild>
                <Link href={`/collections/${id}`}>
                  Отмена
                </Link>
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить изменения
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}