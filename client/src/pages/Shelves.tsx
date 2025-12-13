import React, { useState } from 'react';
import { Link } from 'wouter';
import { mockBooks, mockShelves, Shelf, Book } from '@/lib/mockData';
import { Plus, Search, Book as BookIcon, MoreVertical, X, LayoutGrid, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';

export default function Shelves() {
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
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
             <Link href="/">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-serif font-bold text-xl cursor-pointer">
                  N
                </div>
             </Link>
            <h1 className="font-serif text-2xl font-bold">Мои полки</h1>
          </div>
          
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
        </header>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBooks.length > 0 ? (
                filteredBooks.map(book => (
                  <div key={book.id} className="bg-card border rounded-xl p-4 flex gap-4 hover:shadow-lg transition-all">
                    <div className={`w-16 h-24 rounded-md shadow-sm flex-shrink-0 ${book.coverColor}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold truncate">{book.title}</h3>
                      <p className="text-sm text-muted-foreground truncate mb-2">{book.author}</p>
                      
                      <div className="mt-2">
                        <AddToShelfDialog 
                          bookId={book.id}
                          shelves={shelves}
                          onToggleShelf={handleToggleShelf}
                          trigger={
                            <Button variant="outline" size="sm" className="w-full text-xs h-8">
                              Добавить на полку
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))
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
                <ScrollArea className="w-full whitespace-nowrap rounded-xl">
                  <div className="flex w-max space-x-4 p-1 pb-4">
                    {shelf.bookIds.map(bookId => {
                      const book = mockBooks.find(b => b.id === bookId);
                      if (!book) return null;
                      return (
                        <div key={book.id} className="w-[160px] group/book relative">
                          <Link href={`/read/${book.id}/1`}>
                            <div className={`aspect-[2/3] rounded-lg shadow-md mb-3 overflow-hidden cursor-pointer transition-transform hover:scale-105 ${book.coverColor} relative`}>
                               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/book:opacity-100 transition-opacity flex items-end p-3">
                                  <span className="text-white text-xs font-medium">Читать</span>
                               </div>
                            </div>
                          </Link>
                          <h3 className="font-bold text-sm truncate pr-2" title={book.title}>{book.title}</h3>
                          <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                        </div>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
