import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Newspaper, BookOpen, MessageCircle, Star, Trash2, Edit } from "lucide-react";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ReactionBar } from "@/components/ReactionBar";
import { useAuth } from "@/lib/auth";

interface Activity {
  id: string;
  type: 'news' | 'book' | 'comment' | 'review';
  entityId: string;
  userId: string;
  targetUserId?: string;
  newsId?: string;
  bookId?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface ActivityCardProps {
  activity: Activity;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const { t, i18n } = useTranslation(['stream']);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  
  // Debug logging for news comments
  if (activity.type === 'comment') {
    console.log('[ActivityCard] Rendering comment:', {
      id: activity.id,
      hasNewsTitle: !!activity.metadata?.news_title,
      newsTitle: activity.metadata?.news_title,
      hasBookTitle: !!activity.metadata?.book_title,
      bookTitle: activity.metadata?.book_title,
      fullMetadata: activity.metadata
    });
  }
  
  // Get date-fns locale based on current language
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Check if admin/moder
  const isAdminOrModer = currentUser?.accessLevel === 'admin' || currentUser?.accessLevel === 'moder';

  // Delete activity mutation with optimistic updates
  const deleteActivityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      return await apiCall(`/api/stream/activities/${entityId}`, {
        method: 'DELETE'
      });
    },
    onMutate: async (entityId: string) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'global'] });
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'personal'] });
      await queryClient.cancelQueries({ queryKey: ['api', 'stream', 'shelves'] });
      
      // Snapshot the previous values for rollback
      const previousGlobal = queryClient.getQueryData<Activity[]>(['api', 'stream', 'global']);
      const previousPersonal = queryClient.getQueryData<Activity[]>(['api', 'stream', 'personal']);
      const previousShelves = queryClient.getQueriesData({ queryKey: ['api', 'stream', 'shelves'] });
      
      // Optimistically remove the activity from all caches
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (old = []) => {
        return old.filter(a => a.entityId !== entityId);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (old = []) => {
        return old.filter(a => a.entityId !== entityId);
      });
      
      // Update all shelf query variations
      queryClient.setQueriesData<Activity[]>({ queryKey: ['api', 'stream', 'shelves'] }, (old) => {
        // old might be undefined for queries that don't exist yet
        if (!old || !Array.isArray(old)) {
          return old;
        }
        return old.filter(a => a.entityId !== entityId);
      });
      
      // Return context with snapshots for potential rollback
      return { previousGlobal, previousPersonal, previousShelves };
    },
    onSuccess: () => {
      toast({
        title: t('stream:activityDeleted'),
        description: t('stream:activityDeletedDescription')
      });
    },
    onError: (error: any, entityId, context) => {
      // Rollback to the previous state on error
      if (context?.previousGlobal) {
        queryClient.setQueryData(['api', 'stream', 'global'], context.previousGlobal);
      }
      if (context?.previousPersonal) {
        queryClient.setQueryData(['api', 'stream', 'personal'], context.previousPersonal);
      }
      if (context?.previousShelves) {
        context.previousShelves.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast({
        title: t('stream:error'),
        description: error.message || t('stream:deleteError'),
        variant: 'destructive'
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'shelves'] });
    }
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteActivityMutation.mutateAsync(activity.entityId);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle reaction on activity items
  const handleReact = async (emoji: string) => {
    console.log('[ActivityCard] handleReact called:', { emoji, currentUser, isReacting });
    
    if (isReacting || !currentUser) {
      console.log('[ActivityCard] Reaction blocked:', { isReacting, hasCurrentUser: !!currentUser });
      return;
    }
    
    setIsReacting(true);
    try {
      let endpoint = '';
      let body: any = { emoji };
      
      // Determine the correct endpoint and body based on activity type
      if (activity.type === 'news') {
        endpoint = `/api/news/${activity.entityId}/reactions`;
      } else if (activity.type === 'comment') {
        endpoint = '/api/reactions';
        body.commentId = activity.entityId;
      } else if (activity.type === 'review') {
        endpoint = '/api/reactions';
        body.reviewId = activity.entityId;
      } else {
        // Books don't have reactions
        console.log('[ActivityCard] Books dont have reactions');
        return;
      }
      
      console.log('[ActivityCard] Posting reaction:', { endpoint, body });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(body)
      });
      
      console.log('[ActivityCard] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ActivityCard] Failed to add reaction:', errorText);
        throw new Error('Failed to add reaction');
      }
      
      // The WebSocket will handle updating the UI via stream:reaction-update event
      // But we can also optimistically update the local state
      console.log('[ActivityCard] Reaction added successfully');
      toast({
        title: t('stream:reactionAdded'),
        description: t('stream:reactionAddedDescription'),
      });
    } catch (error: any) {
      console.error('[ActivityCard] Error adding reaction:', error);
      toast({
        title: t('stream:error'),
        description: error.message || t('stream:reactionError'),
        variant: 'destructive'
      });
    } finally {
      setIsReacting(false);
    }
  };

  // Get icon based on activity type
  const getActivityIcon = () => {
    switch (activity.type) {
      case 'news':
        return <Newspaper className="w-5 h-5 text-blue-500" />;
      case 'book':
        return <BookOpen className="w-5 h-5 text-green-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-purple-500" />;
      case 'review':
        return <Star className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Render activity content based on type
  const renderActivityContent = () => {
    const { metadata } = activity;

    switch (activity.type) {
      case 'news':
        return (
          <div>
            <Link href={`/news/${activity.entityId}`}>
              <h3 className="font-semibold text-lg hover:underline cursor-pointer">
                {metadata.title}
              </h3>
            </Link>
            {metadata.content_preview && (
              <p className="text-sm text-muted-foreground mt-1">
                {metadata.content_preview}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>👁️ {metadata.view_count || 0}</span>
              <span>💬 {metadata.comment_count || 0}</span>
              <span>❤️ {metadata.reaction_count || 0}</span>
            </div>
            {/* Interactive reaction bar */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ReactionBar 
                reactions={metadata.reactions || []} 
                onReact={handleReact}
                newsId={activity.entityId}
              />
            </div>
          </div>
        );

      case 'book':
        return (
          <div className="flex gap-4">
            {metadata.cover_url && (
              <Link href={`/book/${activity.bookId}`}>
                <img 
                  src={metadata.cover_url} 
                  alt={metadata.title}
                  className="w-20 h-28 object-cover rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                />
              </Link>
            )}
            <div className="flex-1">
              <Link href={`/book/${activity.bookId}`}>
                <h3 className="font-semibold text-lg hover:underline cursor-pointer">
                  {metadata.title}
                </h3>
              </Link>
              {metadata.author && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('stream:author')}: {metadata.author}
                </p>
              )}
              {metadata.genre && (
                <p className="text-xs text-muted-foreground mt-1">
                  {metadata.genre}
                </p>
              )}
            </div>
          </div>
        );

      case 'comment':
        return (
          <div>
            <p className="text-sm">{metadata.content_preview}</p>
            {/* Interactive reaction bar */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ReactionBar 
                reactions={metadata.reactions || []} 
                onReact={handleReact}
                commentId={activity.entityId}
              />
            </div>
          </div>
        );

      case 'review':
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {metadata.rating && (
                <div className="flex items-center">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold ml-1">{metadata.rating}/10</span>
                </div>
              )}
            </div>
            <p className="text-sm">{metadata.content_preview}</p>
            {/* Interactive reaction bar */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ReactionBar 
                reactions={metadata.reactions || []} 
                onReact={handleReact}
                reviewId={activity.entityId}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Format date display based on how long ago it was
  const activityDate = new Date(activity.createdAt);
  const hoursSinceCreated = differenceInHours(new Date(), activityDate);
  const showFullDate = hoursSinceCreated >= 24;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2">
              {getActivityIcon()}
              <span className="text-sm font-medium">
                {t(`stream:activityTypes.${activity.type}`)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {showFullDate 
                      ? format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })
                      : formatDistanceToNow(activityDate, { addSuffix: true, locale: dateLocale })
                    }
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isAdminOrModer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {/* User info section */}
        {activity.metadata && (activity.metadata.author_name || activity.metadata.uploader_name) && (
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="w-8 h-8">
              {(activity.metadata.author_avatar || activity.metadata.uploader_avatar) && (
                <AvatarImage 
                  src={activity.metadata.author_avatar || activity.metadata.uploader_avatar} 
                  alt={activity.metadata.author_name || activity.metadata.uploader_name} 
                />
              )}
              <AvatarFallback>
                {(activity.metadata.author_name || activity.metadata.uploader_name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Link href={`/profile/${activity.userId}`}>
              <span className="text-sm hover:underline cursor-pointer">
                {activity.metadata.author_name || activity.metadata.uploader_name}
              </span>
            </Link>
            {/* Context for comments and reviews */}
            {/* News title for news comments */}
            {activity.type === 'comment' && activity.metadata.news_title && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link href={`/news/${activity.metadata.news_id}`}>
                  <span className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                    {activity.metadata.news_title}
                  </span>
                </Link>
              </>
            )}
            {/* Book title for book comments and reviews (only if no news_title) */}
            {(activity.type === 'comment' || activity.type === 'review') && !activity.metadata.news_title && activity.metadata.book_title && activity.metadata.book_title !== 'Unknown' && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link href={`/book/${activity.metadata.book_id}`}>
                  <span className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                    {activity.metadata.book_title}
                  </span>
                </Link>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {renderActivityContent()}
      </CardContent>
    </Card>
  );
}
