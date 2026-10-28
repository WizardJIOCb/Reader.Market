import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { mockUser, mockOtherUser, mockBooks, mockShelves, Shelf } from '@/lib/mockData';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { BookCard } from '@/components/BookCard';
import { LogoutButton } from '@/components/LogoutButton';
import { useAuth } from '@/lib/auth'; // Added import for auth context
import { 
  BookOpen, 
  Type, 
  AlignLeft, 
  MessageCircle, 
  Settings, 
  Share2, 
  ArrowLeft,
  Mail,
  MoreVertical,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const [match, params] = useRoute('/profile/:userId');
  const { toast } = useToast();
  const { user: currentUser } = useAuth(); // Get current authenticated user
  const userId = params?.userId || 'user1'; // Default to logged-in user if no param
  
  // Determine if viewing own profile using real authentication
  const isOwnProfile = currentUser?.id === userId;
  // For mock data, still use the existing logic but with real user detection
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Navigation */}
        <header className="flex justify-between items-center mb-8">
          <div></div> {/* Empty div for spacing */}
          {isOwnProfile && (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <LogoutButton />
            </div>
          )}
        </header>

        {/* Profile Header */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-start">
              <Avatar className="w-32 h-32 border-4 border-background shadow-xl flex-shrink-0">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-muted flex items-center justify-center">
                  <User className="w-16 h-16 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-serif font-bold">{user.name}</h1>
                  <p className="text-muted-foreground font-medium">{user.username}</p>
                  {!isOwnProfile && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="-ml-2 mt-1 p-1 cursor-pointer">
                          <Mail className="w-5 h-5" />
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
                            <Button onClick={handleSendMessage} className="cursor-pointer">Отправить</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  {isOwnProfile && (
                    <Button variant="outline" className="flex-1 sm:flex-none gap-2 cursor-pointer">
                      <Share2 className="w-4 h-4" />
                      Поделиться профилем
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Bio with HTML rendering - full width below avatar and user info */}
          <div className="mt-6">
            <div 
              className="prose prose-sm dark:prose-invert text-foreground/90 leading-relaxed bg-muted/30 p-6 rounded-lg border w-full"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {user.recentlyReadIds.map(bookId => {
              const book = mockBooks.find(b => b.id === bookId);
              if (!book) return null;
              
              // Find reading progress for this book
              const progress = user.readingProgress?.find(p => p.bookId === bookId) || undefined;
              
              return (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  variant="detailed"
                  readingProgress={progress}
                />
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {shelf.bookIds.map(bookId => {
                      const book = mockBooks.find(b => b.id === bookId);
                      if (!book) return null;
                                    
                      return (
                        <BookCard 
                          key={book.id} 
                          book={book} 
                          variant="shelf"
                        />
                      );
                    })}
                  </div>
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