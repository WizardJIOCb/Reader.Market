import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, ThumbsUp, Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface ReactionBarProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void | Promise<void>;
  commentId?: string;
  reviewId?: string;
}

const AVAILABLE_EMOJIS = ['👍', '❤️', '🔥', '👏', '🤯', '🤔', '😢', '😂'];

export function ReactionBar({ reactions = [], onReact, commentId, reviewId }: ReactionBarProps) {
  const handleReaction = async (emoji: string) => {
    // If we don't have either commentId or reviewId, fallback to the original onReact
    if (!commentId && !reviewId) {
      onReact(emoji);
      return;
    }

    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          commentId, 
          reviewId, 
          emoji 
        })
      });

      if (response.ok) {
        // Call the original onReact to update the UI
        await onReact(emoji);
      }
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant={reaction.userReacted ? "secondary" : "ghost"}
          size="sm"
          className={`h-7 px-2 gap-1.5 text-xs rounded-full border ${
            reaction.userReacted 
              ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20' 
              : 'border-transparent bg-muted/30 hover:bg-muted/50'
          }`}
          onClick={() => handleReaction(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/50">
            <Smile className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {AVAILABLE_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent/20 rounded-md transition-colors"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
