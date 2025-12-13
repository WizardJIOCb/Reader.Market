import React, { useState } from 'react';
import { Link } from 'wouter';
import { mockBook, mockShelves, Shelf } from '@/lib/mockData';
import { Play, BookOpen, Clock, Star, ArrowRight, Library as LibraryIcon, MessageSquare, Award, Plus, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentsSection } from '@/components/CommentsSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import generatedImage from '@assets/generated_images/digital_lines_merging_with_paper_pages.png';

export default function Library() {
  const [activeTab, setActiveTab] = useState("chapters");
  const [shelves, setShelves] = useState<Shelf[]>(mockShelves);
  const book = mockBook;

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
    <div className="min-h-screen bg-background font-sans">
      <div className="container mx-auto px-4 py-12 md:py-24 max-w-6xl">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-serif font-bold text-xl">
              N
            </div>
            <span className="font-semibold text-xl tracking-tight">NeuroReader</span>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/search">
               <Button variant="ghost" size="icon">
                 <Search className="w-5 h-5" />
               </Button>
             </Link>
             <Link href="/shelves">
               <Button variant="ghost" className="gap-2">
                 <LibraryIcon className="w-4 h-4" />
                 <span className="hidden sm:inline">Мои полки</span>
               </Button>
             </Link>
             <Link href="/profile/user1">
               <Button variant="ghost" className="gap-2">
                 <User className="w-4 h-4" />
                 <span className="hidden sm:inline">Профиль</span>
               </Button>
             </Link>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-12 items-start mb-24">
          {/* Hero Content */}
          <div className="space-y-8 sticky top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
              <Star className="w-4 h-4 fill-accent" />
              <span>Выбор редакции</span>
            </div>
            
            <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight text-foreground">
              {book.title}
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
              Научная фантастика о границах человеческого сознания и искусственного интеллекта. Погрузитесь в мир будущего с нейро-комментариями.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href={`/read/${book.id}/1`}>
                <Button size="lg" className="h-14 px-8 text-lg gap-3 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  <Play className="w-5 h-5 fill-current" />
                  Читать сейчас
                </Button>
              </Link>
              <div className="flex gap-2">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg gap-3 rounded-full">
                  <BookOpen className="w-5 h-5" />
                  О книге
                </Button>
                
                <AddToShelfDialog 
                  bookId={book.id} 
                  shelves={shelves} 
                  onToggleShelf={handleToggleShelf}
                  trigger={
                    <Button size="icon" variant="outline" className="h-14 w-14 rounded-full border-dashed border-2 hover:border-solid">
                      <Plus className="w-6 h-6" />
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-8 pt-8 border-t border-border/50">
              <div>
                <p className="text-2xl font-bold font-serif">{book.chapters.length}</p>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Глав</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-serif">4.8</p>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Рейтинг</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">~2.5 ч. чтения</span>
              </div>
            </div>
          </div>

          {/* Book Cover / Visual */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-[2rem] blur-3xl transform rotate-6 scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="relative aspect-[3/4] md:aspect-square rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
              <img 
                src={generatedImage} 
                alt="Book Cover Abstract" 
                className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
                <p className="text-white/80 font-medium mb-1">Алексей Ветров</p>
                <h3 className="text-white font-serif text-3xl font-bold">{book.title}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Content */}
        <section className="border-t pt-12">
          <Tabs defaultValue="chapters" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-8 p-1 bg-muted/30 rounded-full h-auto inline-flex">
              <TabsTrigger value="chapters" className="rounded-full px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                Оглавление
              </TabsTrigger>
              <TabsTrigger value="comments" className="rounded-full px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2">
                <MessageSquare className="w-4 h-4" />
                Комментарии
              </TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-full px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2">
                <Award className="w-4 h-4" />
                Рецензии
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chapters" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {book.chapters.map((chapter) => (
                  <Link key={chapter.id} href={`/read/${book.id}/${chapter.id}`}>
                    <div className="group p-6 rounded-xl border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer h-full flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-primary/60 uppercase tracking-wider">Глава {chapter.id}</span>
                        <Badge variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          ~10 мин
                        </Badge>
                      </div>
                      <h3 className="font-serif text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {chapter.title.split(': ')[1] || chapter.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                        {chapter.summary}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-medium text-accent">
                        <span>Сгенерировать пересказ</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="max-w-2xl">
              <CommentsSection bookId={book.id} />
            </TabsContent>

            <TabsContent value="reviews" className="max-w-2xl">
              <ReviewsSection bookId={book.id} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
