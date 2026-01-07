import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Smile, Plus } from 'lucide-react';
import { onSocketEvent } from '@/lib/socket';

interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  username?: string;
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
  conversationId?: string;
  channelId?: string;
}

// Common emoji reactions
const COMMON_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', 
  '🎉', '🔥', '👏', '✅', '❌', '🤔',
  '💯', '🙏', '👀', '💪', '🚀', '⭐'
];

export function MessageReactions({ 
  messageId, 
  currentUserId,
  conversationId,
  channelId 
}: MessageReactionsProps) {
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReactions();
  }, [messageId]);

  // Listen for real-time reaction updates
  useEffect(() => {
    const eventName = channelId ? 'channel:reaction:new' : 'reaction:new';
    const removeEventName = channelId ? 'channel:reaction:removed' : 'reaction:removed';

    const cleanupNew = onSocketEvent(eventName as any, (data: any) => {
      if (data.messageId === messageId) {
        setReactions(prev => {
          // Avoid duplicates
          if (prev.some(r => r.id === data.reaction.id)) {
            return prev;
          }
          return [...prev, data.reaction];
        });
      }
    });

    const cleanupRemoved = onSocketEvent(removeEventName as any, (data: any) => {
      if (data.messageId === messageId) {
        setReactions(prev => prev.filter(r => r.id !== data.reactionId));
      }
    });

    return () => {
      cleanupNew();
      cleanupRemoved();
    };
  }, [messageId, channelId]);

  const fetchReactions = async () => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setReactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReaction = async (emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const reaction = await response.json();
        // Reaction will be added via WebSocket, but add locally as fallback
        setReactions(prev => {
          if (prev.some(r => r.id === reaction.id)) {
            return prev;
          }
          return [...prev, reaction];
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось добавить реакцию',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить реакцию',
        variant: 'destructive',
      });
    }
  };

  const removeReaction = async (reactionId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions/${reactionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        // Reaction will be removed via WebSocket, but remove locally as fallback
        setReactions(prev => prev.filter(r => r.id !== reactionId));
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось удалить реакцию',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить реакцию',
        variant: 'destructive',
      });
    }
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const hasUserReacted = (emoji: string) => {
    return groupedReactions[emoji]?.some(r => r.userId === currentUserId);
  };

  const getUserReaction = (emoji: string) => {
    return groupedReactions[emoji]?.find(r => r.userId === currentUserId);
  };

  const toggleReaction = (emoji: string) => {
    const userReaction = getUserReaction(emoji);
    if (userReaction) {
      removeReaction(userReaction.id);
    } else {
      addReaction(emoji);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Display existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
        <Button
          key={emoji}
          variant={hasUserReacted(emoji) ? 'default' : 'outline'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => toggleReaction(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span>{reactionList.length}</span>
        </Button>
      ))}

      {/* Add reaction button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="grid grid-cols-6 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-lg hover:bg-muted"
                onClick={() => {
                  toggleReaction(emoji);
                }}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
