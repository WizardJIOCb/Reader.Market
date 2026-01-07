import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Book {
  id: string;
  title: string;
  author: string;
}

interface GroupCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: (groupId: string) => void;
}

export function GroupCreationDialog({
  open,
  onOpenChange,
  onGroupCreated,
}: GroupCreationDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);
  const [creating, setCreating] = useState(false);

  const searchBooks = async (query: string) => {
    if (query.trim().length < 2) {
      setBookResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBookResults(data.slice(0, 10)); // Limit to 10 results
      }
    } catch (error) {
      console.error('Failed to search books:', error);
    }
  };

  const addBook = (book: Book) => {
    if (!selectedBooks.find((b) => b.id === book.id)) {
      setSelectedBooks([...selectedBooks, book]);
    }
    setBookSearch('');
    setBookResults([]);
  };

  const removeBook = (bookId: string) => {
    setSelectedBooks(selectedBooks.filter((b) => b.id !== bookId));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Название группы обязательно',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          privacy,
          bookIds: selectedBooks.map((b) => b.id),
        }),
      });

      if (response.ok) {
        const group = await response.json();
        toast({
          title: 'Успех',
          description: 'Группа успешно создана',
        });
        onOpenChange(false);
        onGroupCreated?.(group.id);
        // Reset form
        setName('');
        setDescription('');
        setPrivacy('public');
        setSelectedBooks([]);
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось создать группу',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать группу',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать группу</DialogTitle>
          <DialogDescription>
            Создайте группу для обсуждения книг и общения с другими читателями
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Название группы *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название группы"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите цель и тематику группы"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Privacy */}
          <div className="space-y-2">
            <Label htmlFor="privacy">Приватность</Label>
            <Select value={privacy} onValueChange={(value: 'public' | 'private') => setPrivacy(value)}>
              <SelectTrigger id="privacy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Публичная - любой может найти и присоединиться</SelectItem>
                <SelectItem value="private">Приватная - только по приглашению</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Book Association */}
          <div className="space-y-2">
            <Label htmlFor="books">Связанные книги (необязательно)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="books"
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  searchBooks(e.target.value);
                }}
                placeholder="Поиск книг для добавления в группу"
                className="pl-10"
              />
            </div>
            {bookResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {bookResults.map((book) => (
                  <div
                    key={book.id}
                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => addBook(book)}
                  >
                    <p className="font-medium text-sm">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  </div>
                ))}
              </div>
            )}
            {selectedBooks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedBooks.map((book) => (
                  <Badge key={book.id} variant="secondary" className="pl-3 pr-1">
                    <span className="mr-1">{book.title}</span>
                    <button
                      onClick={() => removeBook(book.id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Отмена
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Создание...' : 'Создать группу'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
