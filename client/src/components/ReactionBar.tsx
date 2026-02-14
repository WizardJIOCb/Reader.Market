import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, ThumbsUp, Heart, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';


interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface ReactionDetail {
  id: string;
  userId: string;
  emoji: string;
  createdAt: string;
  userFullName?: string;
  userUsername?: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string | null;
}

interface ReactionBarProps {
  reactions: Reaction[];
  onReact: (emoji: string, commentId?: string) => void | Promise<void>;
  commentId?: string;
  reviewId?: string;
  newsId?: string;
  bookId?: string;
  articleId?: string;
}

const AVAILABLE_EMOJIS = ['👍', '👎', '❤️', '🔥', '👏', '🤯', '🤔', '😢', '😂', '😊', '😐'];

export function ReactionBar({ reactions = [], onReact, commentId, reviewId, newsId, bookId, articleId }: ReactionBarProps) {
  const [reactionDetails, setReactionDetails] = useState<Record<string, ReactionDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [dialogReaction, setDialogReaction] = useState<{emoji: string, users: ReactionDetail[]} | null>(null);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [tooltipHovered, setTooltipHovered] = useState<boolean>(false);
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['reactions']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  
  // Determine entity type and ID for API calls
  const getEntityInfo = () => {
    if (commentId) return { type: 'comment', id: commentId };
    if (reviewId) return { type: 'review', id: reviewId };
    if (newsId) return { type: 'news', id: newsId };
    if (bookId) return { type: 'book', id: bookId };
    if (articleId) return { type: 'article', id: articleId };
    return null;
  };
  
  const entityInfo = getEntityInfo();
  
  // Clear cached data and update visible tooltip when reactions prop changes
  useEffect(() => {
    // Clear all cached reaction details when reactions prop changes
    // This ensures we fetch fresh data when reaction counts change
    setReactionDetails({});
    setLoadingDetails({});
    
    // If a tooltip is currently visible, trigger a refresh
    if (hoveredReaction) {
      // Force refresh the currently hovered reaction
      const currentReaction = reactions.find(r => r.emoji === hoveredReaction);
      if (currentReaction && currentReaction.count > 0) {
        // Small delay to ensure state updates properly
        setTimeout(() => {
          fetchReactionDetails(hoveredReaction);
        }, 50);
      }
    }
  }, [reactions]);
  
  // Fetch detailed reaction information
  const fetchReactionDetails = async (emoji: string) => {
    if (!entityInfo) {
      return;
    }
    
    setLoadingDetails(prev => ({ ...prev, [emoji]: true }));
    
    try {
      let endpoint = '';
      
      // Determine the correct endpoint based on entity type
      if (entityInfo.type === 'news') {
        endpoint = `/api/admin/news/${entityInfo.id}/reactions`;
      } else if (entityInfo.type === 'comment') {
        endpoint = `/api/comments/${entityInfo.id}/reactions`;
      } else if (entityInfo.type === 'review') {
        endpoint = `/api/reviews/${entityInfo.id}/reactions`;
      } else if (entityInfo.type === 'book') {
        endpoint = `/api/books/${entityInfo.id}/reactions/detail`;
      } else if (entityInfo.type === 'article') {
        endpoint = `/api/articles/${entityInfo.id}/reactions/detail`;
      }
      
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(endpoint, { headers });
      
      if (response.ok) {
        const allReactions = await response.json();
        
        // Filter reactions for this specific emoji
        // Handle different data structures that different endpoints might return
        let emojiReactions = [];
        
        if (Array.isArray(allReactions)) {
          // Direct array of reactions
          emojiReactions = allReactions.filter((r: any) => r.emoji === emoji);
        } else if (allReactions && typeof allReactions === 'object') {
          // Check various possible object structures
          if (Array.isArray(allReactions.reactions)) {
            // Object with reactions array
            emojiReactions = allReactions.reactions.filter((r: any) => r.emoji === emoji);
          } else if (Array.isArray(allReactions.data)) {
            // Object with data array
            emojiReactions = allReactions.data.filter((r: any) => r.emoji === emoji);
          } else {
            // Try to find any array property
            const arrayProps = Object.keys(allReactions).filter(key => Array.isArray(allReactions[key]));
            if (arrayProps.length > 0) {
              emojiReactions = allReactions[arrayProps[0]].filter((r: any) => r.emoji === emoji);
            }
          }
        }
        
        setReactionDetails(prev => ({ ...prev, [emoji]: emojiReactions }));
      }
    } catch (error) {
      console.error('Failed to fetch reaction details:', error);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [emoji]: false }));
    }
  };
  
  const handleReaction = async (emoji: string) => {
    // Clear cached reaction details and loading state for this emoji when reacting
    setReactionDetails(prev => {
      const newDetails = { ...prev };
      delete newDetails[emoji];
      return newDetails;
    });
    setLoadingDetails(prev => {
      const newLoading = { ...prev };
      delete newLoading[emoji];
      return newLoading;
    });
    
    // Simply call the onReact handler provided by the parent component
    // Pass commentId if available so parent knows which comment to react to
    await onReact(emoji, commentId);
  };
  
  const handleReactionHover = (emoji: string) => {
    setHoveredReaction(emoji);
    // Fetch details if we don't have them yet OR if we have empty array
    if ((!reactionDetails[emoji] || reactionDetails[emoji].length === 0) && !loadingDetails[emoji]) {
      fetchReactionDetails(emoji);
    }
  };
  
  const handleReactionClick = (emoji: string) => {
    const users = reactionDetails[emoji] || [];
    if (users.length > 0) {
      setDialogReaction({ emoji, users });
    }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {reactions.map((reaction) => (
        <div key={reaction.emoji} className="relative">
          <div className="relative">
            <Button
              variant={reaction.userReacted ? "secondary" : "ghost"}
              size="sm"
              className={`h-7 px-2 gap-1.5 text-xs rounded-full border relative ${
                reaction.userReacted 
                  ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20' 
                  : 'border-transparent bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => handleReaction(reaction.emoji)}
              onMouseEnter={() => {
                handleReactionHover(reaction.emoji);
              }}
              onMouseLeave={() => {
                // Don't hide immediately if tooltip is hovered
                if (!tooltipHovered) {
                  setHoveredReaction(null);
                }
              }}
            >
              <span>{reaction.emoji}</span>
              <span className="font-medium">{reaction.count}</span>
            </Button>
            

          </div>
          
          {/* Tooltip with user list - clickable to show all reactions */}
          {hoveredReaction === reaction.emoji && reaction.count > 0 && (
            <div 
              className="absolute bottom-full left-0 -mb-1 z-50 bg-popover border rounded-md shadow-lg min-w-[200px] max-w-xs pointer-events-auto pt-1 cursor-pointer"
              onClick={() => handleReactionClick(reaction.emoji)}
              onMouseEnter={() => {
                setTooltipHovered(true);
                setHoveredReaction(reaction.emoji);
              }}
              onMouseLeave={() => {
                setTooltipHovered(false);
                setHoveredReaction(null);
              }}
            >
              <div className="p-2">
                <div className="text-xs font-medium mb-1">{reaction.emoji} {t('reactions:reactionCount', '{{count}} reaction', { count: reaction.count })}</div>
                <div className="max-h-32 overflow-y-auto">
                  {loadingDetails[reaction.emoji] ? (
                    <div className="text-xs text-muted-foreground">{t('reactions:loading', 'Loading...')}</div>
                  ) : reactionDetails[reaction.emoji] && reactionDetails[reaction.emoji].length > 0 ? (
                    <div className="space-y-1">
                      {reactionDetails[reaction.emoji].slice(0, 10).map((detail) => (
                        <div key={detail.id} className="flex items-center gap-2 text-xs">
                          <Avatar className="w-5 h-5">
                            {detail.avatarUrl ? (
                              <AvatarImage src={detail.avatarUrl} alt={detail.userFullName || detail.userUsername || detail.fullName || detail.username || 'User'} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {(detail.userFullName || detail.userUsername || detail.fullName || detail.username || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <Link 
                            href={`/profile/${detail.userId}`}
                            className="truncate text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {detail.userFullName || detail.userUsername || detail.fullName || detail.username || 'Unknown User'}
                          </Link>
                        </div>
                      ))}
                      {reactionDetails[reaction.emoji].length > 10 && (
                        <div className="text-xs text-muted-foreground text-center pt-1 border-t mt-1">
                          +{reactionDetails[reaction.emoji].length - 10} more
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground text-center pt-1 border-t mt-1">
                        {t('reactions:viewAllReactions', 'Click to view all {{count}} reactions', { count: reactionDetails[reaction.emoji].length })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No reactions yet</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
      
      {/* Detailed reactions dialog */}
      <Dialog open={!!dialogReaction} onOpenChange={() => setDialogReaction(null)}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{dialogReaction?.emoji}</span>
              <span>{t('reactions:dialogTitle', 'Reactions ({{count}})', { count: dialogReaction?.users.length || 0 })}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3 py-2">
              {dialogReaction?.users.map((detail) => (
                <div key={detail.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    {detail.avatarUrl ? (
                      <AvatarImage src={detail.avatarUrl} alt={detail.userFullName || detail.userUsername || detail.fullName || detail.username || 'User'} />
                    ) : null}
                    <AvatarFallback>
                      {(detail.userFullName || detail.userUsername || detail.fullName || detail.username || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/profile/${detail.userId}`}
                      className="font-medium truncate text-blue-600 hover:text-blue-800 hover:underline block"
                    >
                      {detail.userFullName || detail.userUsername || detail.fullName || detail.username || 'Unknown User'}
                    </Link>
                    {(detail.userUsername || detail.username) && (detail.userFullName || detail.fullName) && (
                      <div className="text-xs text-muted-foreground truncate">
                        @{detail.userUsername || detail.username}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(detail.createdAt), t('reactions:dateFormat', 'MM/dd/yyyy'), { locale: dateLocale })}
                    </div>
                  </div>
                  <div className="text-2xl flex-shrink-0">
                    {detail.emoji}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
