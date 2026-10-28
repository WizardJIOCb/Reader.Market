import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { mockUser } from '@/lib/mockData';
import { Plus, Search, Book as BookIcon, User, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { BookCard } from '@/components/BookCard';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { useShelves } from '@/hooks/useShelves';
import { useBooks } from '@/hooks/useBooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Shelves() {
  const { user } = useAuth();
  const { shelves, loading, error, createShelf, updateShelf, deleteShelf, addBookToShelf, removeBookFromShelf } = useShelves();
  const { fetchBooksByIds } = useBooks();
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [isAddShelfOpen, setIsAddShelfOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [isEditShelfOpen, setIsEditShelfOpen] = useState(false);
  const [shelfBooks, setShelfBooks] = useState<{[key: string]: any[]}>({});
  const { toast } = useToast();

  // Fetch books for all shelves
  useEffect(() => {
    const fetchAllShelfBooks = async () => {
      if (shelves.length > 0) {
        const newShelfBooks: {[key: string]: any[]} = {};
        
        // Fetch books for each shelf
        for (const shelf of shelves) {
          if (shelf.bookIds && shelf.bookIds.length > 0) {
            try {
              // Convert book IDs to strings if they're not already
              const bookIds = shelf.bookIds.map(id => String(id));
              const books = await fetchBooksByIds(bookIds);
              newShelfBooks[shelf.id] = books;
            } catch (err) {
              console.error(`Error fetching books for shelf ${shelf.id}:`, err);
              newShelfBooks[shelf.id] = [];
            }
          } else {
            newShelfBooks[shelf.id] = [];
          }
        }
        
        setShelfBooks(newShelfBooks);
      }
    };
    
    fetchAllShelfBooks();
  }, [shelves]);
  
  // Perform global search when search query changes
  useEffect(() => {
    const performGlobalSearch = async () => {
      if (searchQuery.trim() === '') {
        setGlobalSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch(`http://localhost:5001/api/books/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setGlobalSearchResults(data);
        } else {
          throw new Error('Failed to search books');
        }
      } catch (err) {
        console.error('Global search error:', err);
        toast({
          title: "Ошибка поиска",
          description: "Не удалось выполнить глобальный поиск",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    };
    
    const delayDebounceFn = setTimeout(() => {
      performGlobalSearch();
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAddShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newShelfName.trim()) {
      try {
        await createShelf({ 
          name: newShelfName,
          color: 'bg-muted/50'
        });
        setNewShelfName('');
        setIsAddShelfOpen(false);
        
        toast({
          title: "Полка создана",
          description: `Полка "${newShelfName}" успешно создана!`,
        });
      } catch (err) {
        toast({
          title: "Ошибка",
          description: err instanceof Error ? err.message : "Не удалось создать полку",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleShelf = async (shelfId: string, bookId: string | number, isAdded: boolean) => {
    try {
      // Convert bookId to string if it's a number
      const bookIdStr = typeof bookId === 'number' ? bookId.toString() : bookId;
      
      if (isAdded) {
        // Check if book is already in shelf
        const shelf = shelves.find(s => s.id === shelfId);
        if (shelf && shelf.bookIds.includes(bookIdStr)) {
          return;
        }
        
        await addBookToShelf(shelfId, bookIdStr);
        
        toast({
          title: "Книга добавлена",
          description: "Книга успешно добавлена на полку!",
        });
      } else {
        await removeBookFromShelf(shelfId, bookIdStr);
        
        toast({
          title: "Книга удалена",
          description: "Книга удалена с полки!",
        });
      }
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось обновить полку",
        variant: "destructive",
      });
    }
  };

  const handleEditShelf = (shelf: { id: string; name: string; description?: string }) => {
    setEditingShelf(shelf);
    setIsEditShelfOpen(true);
  };

  const handleUpdateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShelf && editingShelf.name.trim()) {
      try {
        await updateShelf(editingShelf.id, { 
          name: editingShelf.name,
          description: editingShelf.description
        });
        setIsEditShelfOpen(false);
        setEditingShelf(null);
        
        toast({
          title: "Полка обновлена",
          description: `Полка "${editingShelf.name}" успешно обновлена!`,
        });
      } catch (err) {
        toast({
          title: "Ошибка",
          description: err instanceof Error ? err.message : "Не удалось обновить полку",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteShelf = async (shelfId: string, shelfName: string) => {
    try {
      await deleteShelf(shelfId);
      
      toast({
        title: "Полка удалена",
        description: `Полка "${shelfName}" успешно удалена!`,
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось удалить полку",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title="Мои полки" />
          <div className="flex justify-center items-center h-64">
            <p>Загрузка полок...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title="Мои полки" />
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-red-500 mb-4">Ошибка загрузки полок:</p>
              <p className="text-red-500 text-sm font-mono">{error}</p>
              <Button 
                className="mt-4" 
                onClick={() => window.location.reload()}
              >
                Перезагрузить страницу
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PageHeader title="Мои полки" />
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Для просмотра полок необходимо войти в систему</p>
              <Link href="/login">
                <Button>Войти</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title="Мои полки" />
        
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Link href="/profile/user1">
               <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                 <User className="w-5 h-5" />
               </Button>
            </Link>

            <div className="relative w-full max-w-xs hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск книг..." 
                className="pl-9 bg-muted/30 border-none focus-visible:ring-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Link href="/add-book">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Новая книга</span>
              </Button>
            </Link>
            
            <Dialog open={isAddShelfOpen} onOpenChange={setIsAddShelfOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Новая полка</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать новую полку</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddShelf} className="space-y-4 pt-4">
                  <Input 
                    placeholder="Название полки (например: Фантастика)" 
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsAddShelfOpen(false)}>Отмена</Button>
                    <Button type="submit">Создать</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mb-8">
           <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск книг..." 
                className="pl-9 bg-muted/30 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
        </div>

        {/* Global Search Results (if search query exists) */}
        {searchQuery && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Глобальные результаты поиска
            </h2>
            {isSearching ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalSearchResults.length > 0 ? (
                  globalSearchResults.map((book: any) => {
                    // Find reading progress for this book
                    const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId.toString() === book.id) || undefined;
                    
                    // Convert book data to match BookCard expectations
                    const bookData = {
                      id: book.id,
                      title: book.title,
                      author: book.author,
                      description: book.description,
                      coverImageUrl: book.coverImageUrl?.startsWith('uploads/') ? `http://localhost:5001/${book.coverImageUrl}` : book.coverImageUrl,
                      rating: book.rating,
                      commentCount: book.commentCount,
                      reviewCount: book.reviewCount,
                      genre: book.genre ? book.genre.split(',').map((g: string) => g.trim()) : [],
                      year: book.publishedYear,
                      uploadedAt: book.uploadedAt,
                      publishedAt: book.publishedAt,
                    };
                    
                    return (
                      <BookCard 
                        key={book.id} 
                        book={bookData} 
                        variant="detailed"
                        readingProgress={readingProgress}
                        addToShelfButton={
                          <AddToShelfDialog 
                            bookId={book.id}
                            shelves={shelves.map(s => ({
                              id: s.id,
                              name: s.name,
                              description: s.description,
                              bookIds: s.bookIds || [],
                              color: s.color
                            }))}
                            onToggleShelf={handleToggleShelf}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-2 w-full truncate" style={{ cursor: 'pointer' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                                <span className="truncate">Полки</span>
                              </Button>
                            }
                          />
                        }
                      />
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    Ничего не найдено
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        
        {/* Shelf Books Matching Search Query */}
        {searchQuery && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookIcon className="w-4 h-4" />
              Книги на ваших полках
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(() => {
                // Flatten all shelf books into a single array
                const allShelfBooks = Object.values(shelfBooks).flat();
                
                // Deduplicate books by ID to avoid showing the same book multiple times
                const uniqueBooks = allShelfBooks.filter((book, index, self) => 
                  index === self.findIndex(b => b.id === book.id)
                );
                
                // Filter books that match the search query
                const matchingShelfBooks = uniqueBooks.filter(book => {
                  const searchLower = searchQuery.toLowerCase();
                  return (
                    book.title.toLowerCase().includes(searchLower) ||
                    book.author.toLowerCase().includes(searchLower) ||
                    (book.description && book.description.toLowerCase().includes(searchLower)) ||
                    (book.genre && book.genre.toLowerCase().includes(searchLower))
                  );
                });
                
                return matchingShelfBooks.length > 0 ? (
                  matchingShelfBooks.map((book: any) => {
                    // Find reading progress for this book
                    const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId.toString() === book.id) || undefined;
                    
                    // Convert book data to match BookCard expectations
                    const bookData = {
                      ...book,
                      coverImageUrl: book.coverImageUrl?.startsWith('uploads/') ? `http://localhost:5001/${book.coverImageUrl}` : book.coverImageUrl,
                      genre: book.genre ? (typeof book.genre === 'string' ? book.genre.split(',').map((g: string) => g.trim()) : book.genre) : [],
                    };
                    
                    return (
                      <BookCard 
                        key={book.id} 
                        book={bookData} 
                        variant="detailed"
                        readingProgress={readingProgress}
                        addToShelfButton={
                          <AddToShelfDialog 
                            bookId={book.id}
                            shelves={shelves.map(s => ({
                              id: s.id,
                              name: s.name,
                              description: s.description,
                              bookIds: s.bookIds || [],
                              color: s.color
                            }))}
                            onToggleShelf={handleToggleShelf}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-2 w-full truncate" style={{ cursor: 'pointer' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                                <span className="truncate">Полки</span>
                              </Button>
                            }
                          />
                        }
                      />
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    Нет совпадений на ваших полках
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* Shelves Grid */}
        <div className="space-y-12">
          {shelves.map((shelf) => (
            <section key={shelf.id} className="relative group">
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-2xl font-bold">{shelf.name}</h2>
                  <Badge variant="secondary" className="rounded-full">{(shelf.bookIds || []).length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {shelf.description && (
                    <p className="text-sm text-muted-foreground hidden sm:block">{shelf.description}</p>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditShelf({ id: shelf.id, name: shelf.name, description: shelf.description })}>
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                        onClick={() => handleDeleteShelf(shelf.id, shelf.name)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {(shelf.bookIds || []).length === 0 ? (
                <div className={`h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2 ${shelf.color} bg-opacity-20`}>
                  <BookIcon className="w-8 h-8 opacity-50" />
                  <p>Полка пуста</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(shelfBooks[shelf.id] || []).map((book: any) => {
                    // Convert book data to match BookCard expectations
                    const bookData = {
                      id: book.id, // Keep the original ID as string (UUID)
                      title: book.title,
                      author: book.author,
                      description: book.description,
                      coverImageUrl: book.coverImageUrl?.startsWith('uploads/') ? `http://localhost:5001/${book.coverImageUrl}` : book.coverImageUrl, // Pass the cover image URL
                      rating: book.rating,
                      commentCount: book.commentCount,
                      reviewCount: book.reviewCount,
                      genre: book.genre ? book.genre.split(',').map((g: string) => g.trim()) : [], // Split genre string into array
                      year: book.publishedYear,
                      uploadedAt: book.uploadedAt, // Add upload date
                      publishedAt: book.publishedAt, // Add publication date
                    };
                    
                    // Find reading progress for this book
                    const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId.toString() === book.id) || undefined;
                    
                    return (
                      <BookCard 
                        key={book.id} 
                        book={bookData} 
                        variant="detailed"
                        readingProgress={readingProgress}
                        addToShelfButton={
                          <AddToShelfDialog 
                            bookId={book.id} // Pass the original ID
                            shelves={shelves.map(s => ({
                              id: s.id,
                              name: s.name,
                              description: s.description,
                              bookIds: s.bookIds || [],
                              color: s.color
                            }))}
                            onToggleShelf={handleToggleShelf}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-2 w-full truncate" style={{ cursor: 'pointer' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                                <span className="truncate">Полки</span>
                              </Button>
                            }
                          />
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
      
      {/* Add Shelf Dialog */}
      <Dialog open={isAddShelfOpen} onOpenChange={setIsAddShelfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новую полку</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddShelf} className="space-y-4 pt-4">
            <Input 
              placeholder="Название полки (например: Фантастика)" 
              value={newShelfName}
              onChange={(e) => setNewShelfName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddShelfOpen(false)}>Отмена</Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Shelf Dialog */}
      <Dialog open={isEditShelfOpen} onOpenChange={(open) => {
        setIsEditShelfOpen(open);
        if (!open) setEditingShelf(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать полку</DialogTitle>
          </DialogHeader>
          {editingShelf && (
            <form onSubmit={handleUpdateShelf} className="space-y-4 pt-4">
              <Input 
                placeholder="Название полки" 
                value={editingShelf.name}
                onChange={(e) => setEditingShelf({...editingShelf, name: e.target.value})}
                autoFocus
              />
              <Input 
                placeholder="Описание полки (необязательно)" 
                value={editingShelf.description || ''}
                onChange={(e) => setEditingShelf({...editingShelf, description: e.target.value})}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditShelfOpen(false)}>Отмена</Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
