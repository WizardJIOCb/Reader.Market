import React, { useState, useRef, useEffect } from 'react';
import EmojiPickerReact, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onEmojiSelect, className = '' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
    
    // Store recently used emoji in localStorage
    const recentEmojis = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    const updatedRecent = [emojiData.emoji, ...recentEmojis.filter((e: string) => e !== emojiData.emoji)].slice(0, 20);
    localStorage.setItem('recentEmojis', JSON.stringify(updatedRecent));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          title="Add emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-0" 
        align="end"
        side="top"
      >
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          height={400}
          width={320}
          searchPlaceHolder="Search emoji..."
          previewConfig={{
            showPreview: false
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Simplified version for mobile
export function EmojiPickerMobile({ onEmojiSelect, onClose }: { onEmojiSelect: (emoji: string) => void; onClose: () => void }) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onClose();
    
    // Store recently used emoji
    const recentEmojis = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    const updatedRecent = [emojiData.emoji, ...recentEmojis.filter((e: string) => e !== emojiData.emoji)].slice(0, 20);
    localStorage.setItem('recentEmojis', JSON.stringify(updatedRecent));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-800 rounded-t-xl shadow-lg">
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Select Emoji</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          height={350}
          width="100%"
          searchPlaceHolder="Search emoji..."
          previewConfig={{
            showPreview: false
          }}
        />
      </div>
    </div>
  );
}
