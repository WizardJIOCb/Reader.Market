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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['messages']);
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
        title: t('messages:error'),
        description: t('messages:groupNameRequired'),
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
          title: t('messages:success'),
          description: t('messages:groupCreatedSuccess'),
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
          title: t('messages:error'),
          description: error.error || t('messages:failedToCreateGroup'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('messages:error'),
        description: t('messages:failedToCreateGroup'),
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
          <DialogTitle>{t('messages:createGroupTitle')}</DialogTitle>
          <DialogDescription>
            {t('messages:createGroupDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('messages:groupNameLabel')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('messages:groupNamePlaceholder')}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('messages:descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('messages:descriptionPlaceholder')}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Privacy */}
          <div className="space-y-2">
            <Label htmlFor="privacy">{t('messages:privacyLabel')}</Label>
            <Select value={privacy} onValueChange={(value: 'public' | 'private') => setPrivacy(value)}>
              <SelectTrigger id="privacy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('messages:publicOption')}</SelectItem>
                <SelectItem value="private">{t('messages:privateOption')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Book Association */}
          <div className="space-y-2">
            <Label htmlFor="books">{t('messages:relatedBooksLabel')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="books"
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  searchBooks(e.target.value);
                }}
                placeholder={t('messages:searchBooksPlaceholder')}
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
            {t('messages:cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? `${t('messages:create')}...` : t('messages:create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
