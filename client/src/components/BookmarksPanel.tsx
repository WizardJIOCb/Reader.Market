import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark as BookmarkIcon, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Bookmark } from '@/lib/mockData';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BookmarksPanelProps {
  bookId: number;
  chapterId: number;
  bookmarks: Bookmark[];
  onAddBookmark: (title: string) => void;
  onRemoveBookmark: (id: string) => void;
  onNavigate: (chapterId: number) => void;
}

export function BookmarksPanel({ 
  bookId, 
  chapterId, 
  bookmarks, 
  onAddBookmark, 
  onRemoveBookmark,
  onNavigate 
}: BookmarksPanelProps) {
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const currentBookBookmarks = bookmarks.filter(b => b.bookId === bookId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBookmarkTitle.trim()) {
      onAddBookmark(newBookmarkTitle);
      setNewBookmarkTitle('');
      setIsAdding(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <BookmarkIcon className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] sm:w-[400px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-serif text-2xl">Закладки</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pb-12">
          {!isAdding ? (
            <Button 
              onClick={() => setIsAdding(true)} 
              className="mb-6 gap-2 w-full"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Добавить закладку здесь
            </Button>
          ) : (
            <form onSubmit={handleAdd} className="mb-6 space-y-3 bg-muted/30 p-4 rounded-lg border">
              <Input
                placeholder="Название закладки..."
                value={newBookmarkTitle}
                onChange={(e) => setNewBookmarkTitle(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  Отмена
                </Button>
                <Button type="submit" size="sm">
                  Сохранить
                </Button>
              </div>
            </form>
          )}

          <ScrollArea className="flex-1 -mx-6 px-6">
            {currentBookBookmarks.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <BookmarkIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>В этой книге пока нет закладок</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentBookBookmarks.map((bookmark) => (
                  <motion.div
                    key={bookmark.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative bg-card border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onNavigate(bookmark.chapterId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium line-clamp-2 pr-6 group-hover:text-primary transition-colors">
                        {bookmark.title}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(bookmark.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Глава {bookmark.chapterId}</span>
                      <span>{format(bookmark.createdAt, 'd MMM yyyy', { locale: ru })}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
