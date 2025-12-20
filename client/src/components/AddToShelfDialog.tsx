import React from 'react';
import { Shelf } from '@/hooks/useShelves';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddToShelfDialogProps {
  bookId: string;
  shelves: Shelf[];
  onToggleShelf: (shelfId: string, bookId: string, isAdded: boolean) => void;
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddToShelfDialog({ bookId, shelves, onToggleShelf, trigger, isOpen, onOpenChange }: AddToShelfDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  
  const isControlled = isOpen !== undefined;
  const openState = isControlled ? isOpen : internalOpen;
  const setOpenState = isControlled ? onOpenChange : setInternalOpen;

  return (
    <Dialog open={openState} onOpenChange={setOpenState}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 w-full" style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            Полки
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Полки</DialogTitle>
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
                      onCheckedChange={(checked) => onToggleShelf(shelf.id, bookId, checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={`shelf-${shelf.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {shelf.name}
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