import React, { useState } from 'react';
import { Comment, mockComments } from '@/lib/mockData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReactionBar } from '@/components/ReactionBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Send } from 'lucide-react';

interface CommentsProps {
  bookId: number;
}

export function CommentsSection({ bookId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>(mockComments.filter(c => c.bookId === bookId));
  const [newComment, setNewComment] = useState('');

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      bookId,
      author: 'Вы', // Mock user
      content: newComment,
      createdAt: new Date().toISOString(),
      reactions: []
    };
    
    setComments([comment, ...comments]);
    setNewComment('');
  };

  const handleReact = (commentId: string, emoji: string) => {
    setComments(comments.map(comment => {
      if (comment.id !== commentId) return comment;

      const existingReactionIndex = comment.reactions.findIndex(r => r.emoji === emoji);
      let newReactions = [...comment.reactions];

      if (existingReactionIndex >= 0) {
        const reaction = newReactions[existingReactionIndex];
        if (reaction.userReacted) {
          // Unlike
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count - 1,
            userReacted: false
          };
          if (newReactions[existingReactionIndex].count === 0) {
            newReactions.splice(existingReactionIndex, 1);
          }
        } else {
          // Like existing emoji
          newReactions[existingReactionIndex] = {
            ...reaction,
            count: reaction.count + 1,
            userReacted: true
          };
        }
      } else {
        // Add new reaction
        newReactions.push({
          emoji,
          count: 1,
          userReacted: true
        });
      }

      return { ...comment, reactions: newReactions };
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Avatar>
          <AvatarFallback>Вы</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Оставьте комментарий..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <div className="flex justify-end">
            <Button onClick={handlePostComment} disabled={!newComment.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              Отправить
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Avatar className="w-10 h-10 border">
              <AvatarFallback>{comment.author[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{comment.author}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-muted-foreground cursor-help">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ru })}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
              <ReactionBar 
                reactions={comment.reactions} 
                onReact={(emoji) => handleReact(comment.id, emoji)} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
