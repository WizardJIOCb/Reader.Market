import React from 'react';
import { Shelf } from '@/lib/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddToShelfDialogProps {
  bookId: number;
  shelves: Shelf[];
  onToggleShelf: (bookId: number, shelfId: string, isAdded: boolean) => void;
  trigger?: React.ReactNode;
}

export function AddToShelfDialog({ bookId, shelves, onToggleShelf, trigger }: AddToShelfDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Добавить на полку
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Добавить книгу на полки</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {shelves.map((shelf) => {
                const isAdded = shelf.bookIds.includes(bookId);
                return (
                  <div key={shelf.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox 
                      id={`shelf-${shelf.id}`} 
                      checked={isAdded}
                      onCheckedChange={(checked) => onToggleShelf(bookId, shelf.id, checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={`shelf-${shelf.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {shelf.title}
                      </Label>
                      {shelf.description && (
                        <p className="text-xs text-muted-foreground">
                          {shelf.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
