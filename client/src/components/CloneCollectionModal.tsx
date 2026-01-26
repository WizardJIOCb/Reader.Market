import { useState } from 'react';
import { bookmarkCollectionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface CloneCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  originalName: string;
  onCloneSuccess?: () => void;
}

export function CloneCollectionModal({
  isOpen,
  onClose,
  collectionId,
  originalName,
  onCloneSuccess
}: CloneCollectionModalProps) {
  const [name, setName] = useState(`Копия ${originalName}`);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    
    try {
      const response = await bookmarkCollectionsApi.cloneCollection(collectionId, {
        name: name.trim(),
        description: description.trim() || undefined
      });
      
      if (response.ok) {
        const clonedCollection = await response.json();
        toast({
          title: "Успешно",
          description: `Коллекция "${clonedCollection.name}" создана`
        });
        
        onClose();
        setName(`Копия ${originalName}`);
        setDescription('');
        
        if (onCloneSuccess) {
          onCloneSuccess();
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось клонировать коллекцию",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error cloning collection:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при клонировании коллекции",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      // Reset form when closing
      setName(`Копия ${originalName}`);
      setDescription('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Клонировать коллекцию
          </DialogTitle>
          <DialogDescription>
            Создать копию коллекции "{originalName}" с новым названием
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">Новое название *</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название для новой коллекции"
              maxLength={100}
              required
            />
            <p className="text-sm text-muted-foreground">
              {name.length}/100 символов
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clone-description">Описание (необязательно)</Label>
            <Textarea
              id="clone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание новой коллекции..."
              maxLength={500}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              {description.length}/500 символов
            </p>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Клонирование...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Клонировать
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}