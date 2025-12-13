import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { mockUser, mockOtherUser, mockBooks, mockShelves, Shelf } from '@/lib/mockData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { 
  BookOpen, 
  Type, 
  AlignLeft, 
  MessageCircle, 
  Settings, 
  Share2, 
  ArrowLeft,
  Mail,
  MoreVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const [match, params] = useRoute('/profile/:userId');
  const { toast } = useToast();
  const userId = params?.userId || 'user1'; // Default to logged-in user if no param
  
  // Mock logic to determine if viewing own profile
  const isOwnProfile = userId === 'user1';
  const user = isOwnProfile ? mockUser : mockOtherUser;
  
  // Local state for shelves to support adding books
  const [myShelves, setMyShelves] = useState<Shelf[]>(mockShelves);

  const handleToggleShelf = (bookId: number, shelfId: string, isAdded: boolean) => {
    setMyShelves(myShelves.map(shelf => {
      if (shelf.id === shelfId) {
        if (isAdded) {
          return { ...shelf, bookIds: [...shelf.bookIds, bookId] };
        } else {
          return { ...shelf, bookIds: shelf.bookIds.filter(id => id !== bookId) };
        }
      }
      return shelf;
    }));
    
    toast({
      title: isAdded ? "Книга добавлена" : "Книга убрана",
      description: isAdded ? "Книга успешно добавлена на полку" : "Книга убрана с полки",
    });
  };

  const [message, setMessage] = useState('');
  const handleSendMessage = () => {
    toast({
      title: "Сообщение отправлено",
      description: `Ваше сообщение для ${user.name} успешно отправлено.`,
    });
    setMessage('');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Navigation */}
        <header className="flex justify-between items-center mb-8">
          <Link href="/">
            <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Назад в библиотеку</span>
            </Button>
          </Link>
          {isOwnProfile && (
             <Button variant="ghost" size="icon">
               <Settings className="w-5 h-5" />
             </Button>
          )}
        </header>

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-8 items-start mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="text-4xl font-serif bg-primary text-primary-foreground">
              {user.name[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-serif font-bold">{user.name}</h1>
                <p className="text-muted-foreground font-medium">{user.username}</p>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                {!isOwnProfile ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="flex-1 sm:flex-none gap-2">
                        <Mail className="w-4 h-4" />
                        Написать
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Написать сообщение {user.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Textarea 
                          placeholder="Привет! Как тебе последняя книга..." 
                          className="min-h-[150px]"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button onClick={handleSendMessage}>Отправить</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button variant="outline" className="flex-1 sm:flex-none gap-2">
                    <Share2 className="w-4 h-4" />
                    Поделиться профилем
                  </Button>
                )}
              </div>
            </div>

            {/* Bio with HTML rendering */}
            <div 
              className="prose prose-sm dark:prose-invert text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-lg border"
              dangerouslySetInnerHTML={{ __html: user.bio.replace(/\n/g, '<br/>') }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-full">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(user.stats.booksRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Книг прочитано</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-full">
              <AlignLeft className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(user.stats.wordsRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Слов прочитано</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full">
              <Type className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(user.stats.lettersRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Букв прочитано</p>
            </div>
          </div>
        </div>

        {/* Recently Read */}
        <section className="mb-12">
          <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-muted-foreground" />
            Недавно читал
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {user.recentlyReadIds.map(bookId => {
              const book = mockBooks.find(b => b.id === bookId);
              if (!book) return null;
              
              return (
                <div key={bookId} className="group bg-card border rounded-xl p-4 flex gap-4 hover:shadow-lg transition-all">
                  <Link href={`/read/${book.id}/1`}>
                    <div className={`w-16 h-24 rounded-md shadow-sm flex-shrink-0 ${book.coverColor} cursor-pointer hover:opacity-90 transition-opacity`} />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <Link href={`/read/${book.id}/1`}>
                         <h3 className="font-serif font-bold truncate hover:text-primary transition-colors cursor-pointer">{book.title}</h3>
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <Link href={`/read/${book.id}/1`}>
                        <Button size="sm" variant="secondary" className="text-xs h-8">
                          Читать
                        </Button>
                      </Link>
                      {/* Only show Add to Shelf if viewing another user's profile, or just general utility */}
                      <AddToShelfDialog 
                        bookId={book.id}
                        shelves={myShelves} // Always add to MY shelves (current logged in user)
                        onToggleShelf={handleToggleShelf}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* User's Shelves */}
        <section>
          <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
            <LibraryIcon className="w-5 h-5 text-muted-foreground" />
            Книжные полки
          </h2>
          <div className="space-y-8">
            {user.shelves.map((shelf) => (
              <div key={shelf.id} className="bg-card/50 border rounded-xl p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-bold">{shelf.title}</h3>
                    <Badge variant="secondary" className="rounded-full">{shelf.bookIds.length}</Badge>
                  </div>
                </div>

                {shelf.bookIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Полка пуста</p>
                ) : (
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-4 pb-4">
                      {shelf.bookIds.map(bookId => {
                        const book = mockBooks.find(b => b.id === bookId);
                        if (!book) return null;
                        return (
                          <div key={book.id} className="w-[100px] group/book relative">
                            <Link href={`/read/${book.id}/1`}>
                              <div className={`aspect-[2/3] rounded-lg shadow-md mb-2 overflow-hidden cursor-pointer transition-transform hover:scale-105 ${book.coverColor}`} />
                            </Link>
                            <h4 className="font-medium text-xs truncate" title={book.title}>{book.title}</h4>
                          </div>
                        );
                      })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function LibraryIcon({ className }: { className?: string }) {
   return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
   )
}
