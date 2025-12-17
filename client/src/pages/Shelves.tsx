import React, { useState } from 'react';
import { Link } from 'wouter';
import { mockBooks, mockShelves, Shelf, Book, mockUser } from '@/lib/mockData';
import { Plus, Search, Book as BookIcon, MoreVertical, X, LayoutGrid, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { BookCard } from '@/components/BookCard';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';

export default function Shelves() {
  const { user } = useAuth();
  const [shelves, setShelves] = useState<Shelf[]>(mockShelves);
  const [searchQuery, setSearchQuery] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [isAddShelfOpen, setIsAddShelfOpen] = useState(false);

  const filteredBooks = mockBooks.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddShelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (newShelfName.trim()) {
      const newShelf: Shelf = {
        id: Date.now().toString(),
        title: newShelfName,
        bookIds: [],
        color: 'bg-muted/50'
      };
      setShelves([...shelves, newShelf]);
      setNewShelfName('');
      setIsAddShelfOpen(false);
    }
  };

  const handleToggleShelf = (bookId: number, shelfId: string, isAdded: boolean) => {
    setShelves(shelves.map(shelf => {
      if (shelf.id === shelfId) {
        if (isAdded) {
          return { ...shelf, bookIds: [...shelf.bookIds, bookId] };
        } else {
          return { ...shelf, bookIds: shelf.bookIds.filter(id => id !== bookId) };
        }
      }
      return shelf;
    }));
  };

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

        {/* Search Results (if active) */}
        {searchQuery && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Результаты поиска
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredBooks.length > 0 ? (
                filteredBooks.map(book => {
                  // Find reading progress for this book
                  const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === book.id) || undefined;
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      variant="detailed"
                      readingProgress={readingProgress}
                      onAddToShelf={(bookId) => console.log(`Add book ${bookId} to shelf`)}
                    />
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  Ничего не найдено
                </div>
              )}
            </div>
          </section>
        )}

        {/* Shelves Grid */}
        <div className="space-y-12">
          {shelves.map((shelf) => (
            <section key={shelf.id} className="relative group">
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-2xl font-bold">{shelf.title}</h2>
                  <Badge variant="secondary" className="rounded-full">{shelf.bookIds.length}</Badge>
                </div>
                {shelf.description && (
                  <p className="text-sm text-muted-foreground hidden sm:block">{shelf.description}</p>
                )}
              </div>

              {shelf.bookIds.length === 0 ? (
                <div className={`h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2 ${shelf.color} bg-opacity-20`}>
                  <BookIcon className="w-8 h-8 opacity-50" />
                  <p>Полка пуста</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {shelf.bookIds.map(bookId => {
                    const book = mockBooks.find(b => b.id === bookId);
                    if (!book) return null;
                    
                    // Find reading progress for this book
                    const readingProgress = mockUser.readingProgress?.find(rp => rp.bookId === bookId) || undefined;
                    
                    return (
                      <BookCard 
                        key={book.id} 
                        book={book} 
                        variant="detailed"
                        readingProgress={readingProgress}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
