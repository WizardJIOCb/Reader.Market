import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  Activity,
  Search,
  BookOpen,
  Info,
  MessageCircle,
  User,
  Newspaper,
  Book,
  MessageSquare,
  Trash2,
  Library,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LastAction {
  id: string;
  type: 'user_action';
  action_type: string;
  entityId: string;
  userId: string;
  user: {
    id?: string;
    username?: string;
    avatar_url?: string;
  };
  target?: {
    type?: string;
    id?: string;
    title?: string;
    username?: string;
    name?: string;
    shelf_id?: string;
    shelf_name?: string;
  };
  metadata: any;
  createdAt: string | Date;
  timestamp: string;
}

interface LastActionsActivityCardProps {
  activity: LastAction;
}

export function LastActionsActivityCard({ activity }: LastActionsActivityCardProps) {
  const { t, i18n } = useTranslation(['stream']);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current user is admin or moderator
  const isAdminOrModer = currentUser && (currentUser.accessLevel === 'admin' || currentUser.accessLevel === 'moder');

  // Get date-fns locale based on current language
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Delete action handler
  const handleDelete = async () => {
    if (isDeleting) return;
    
    // Use entityId if available, fallback to id
    const deleteId = activity.entityId || activity.id;
    
    if (!deleteId) {
      console.error('[LastActionsActivityCard] No valid ID for deletion', activity);
      toast({
        title: t('stream:error'),
        description: 'Invalid activity ID',
        variant: 'destructive'
      });
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log('[LastActionsActivityCard] Deleting action with ID:', deleteId);
      const response = await fetch(`/api/stream/activities/${deleteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LastActionsActivityCard] Delete failed:', errorText);
        throw new Error(`Failed to delete action: ${errorText}`);
      }

      // Optimistically remove from Last Actions cache
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          activities: oldData.activities.filter((a: any) => a.id !== activity.id && a.entityId !== deleteId)
        };
      });
      
      // Also remove from global cache (user actions may appear there)
      queryClient.setQueryData<any>(['api', 'stream', 'global'], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((a: any) => a.id !== activity.id && a.entityId !== deleteId);
      });
      
      // Remove from personal stream cache if user's own action
      if (currentUser && activity.userId === currentUser.id) {
        queryClient.setQueryData<any>(['api', 'stream', 'personal'], (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.filter((a: any) => a.id !== activity.id && a.entityId !== deleteId);
        });
      }

      toast({
        title: t('stream:activityDeleted'),
        description: t('stream:activityDeletedDescription')
      });
    } catch (error) {
      console.error('[LastActionsActivityCard] Error deleting action:', error);
      toast({
        title: t('stream:error'),
        description: error instanceof Error ? error.message : t('stream:deleteError'),
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Get action type label for display next to icon
  const getActionTypeLabel = () => {
    // For navigation actions, show translated action text
    const actionText = t(`stream:actionTypes.${activity.action_type}`, activity.action_type);
    
    // For group messages, remove the trailing " в" or " in" from the bold text
    if (activity.action_type === 'send_group_message') {
      return actionText.replace(/ в$/, '').replace(/ in$/, '');
    }
    
    return actionText;
  };

  // Get icon based on action type
  const getActionIcon = () => {
    switch (activity.action_type) {
      case 'navigate_home':
        return <Home className="w-5 h-5 text-blue-500" />;
      case 'navigate_stream':
        return <Activity className="w-5 h-5 text-purple-500" />;
      case 'navigate_search':
        return <Search className="w-5 h-5 text-green-500" />;
      case 'navigate_shelves':
        return <BookOpen className="w-5 h-5 text-orange-500" />;
      case 'navigate_about':
        return <Info className="w-5 h-5 text-gray-500" />;
      case 'navigate_messages':
        return <MessageCircle className="w-5 h-5 text-indigo-500" />;
      case 'navigate_profile':
        return <User className="w-5 h-5 text-pink-500" />;
      case 'navigate_news':
        return <Newspaper className="w-5 h-5 text-blue-600" />;
      case 'navigate_book':
        return <Book className="w-5 h-5 text-green-600" />;
      case 'navigate_reader':
        return <BookOpen className="w-5 h-5 text-teal-500" />;
      case 'send_group_message':
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
      case 'user_registered':
        return <User className="w-5 h-5 text-green-500" />;
      case 'shelf_created':
        return <Library className="w-5 h-5 text-amber-500" />;
      case 'book_added_to_shelf':
        return <BookOpen className="w-5 h-5 text-blue-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  // Render action description with target link (only for actions WITH target)
  const renderActionDescription = () => {
    // For actions without a specific target - return null (text is shown in header)
    if (!activity.target || !activity.target.type) {
      return null;
    }

    // For user_registered action type, suppress target description to avoid redundancy
    // since the user is already shown in the user info section
    if (activity.action_type === 'user_registered') {
      return null;
    }

    // For book_added_to_shelf, show custom text with book and shelf
    if (activity.action_type === 'book_added_to_shelf') {
      const bookTitle = activity.target?.title || activity.metadata?.book_title || 'Unknown Book';
      const shelfName = activity.target?.shelf_name || activity.metadata?.shelf_name || 'Unknown Shelf';
      const bookId = activity.target?.id || activity.metadata?.book_id;
      
      return (
        <span className="text-sm">
          <span className="text-muted-foreground">{t('stream:added')} </span>
          <Link href={`/book/${bookId}`}>
            <span className="text-primary hover:underline cursor-pointer font-medium">
              {bookTitle}
            </span>
          </Link>
          <span className="text-muted-foreground"> {t('stream:to')} </span>
          <span className="font-medium">
            {shelfName}
          </span>
        </span>
      );
    }

    // For group messages, we need special handling to add the preposition
    const isGroupMessage = activity.action_type === 'send_group_message';
    
    // Build target link and display name
    let targetLink = '#';
    let targetName = '';

    switch (activity.target.type) {
      case 'user':
        targetLink = `/profile/${activity.target.id}`;
        targetName = activity.target.username || 'Unknown User';
        break;
      case 'book':
        targetLink = `/book/${activity.target.id}`;
        targetName = activity.target.title || 'Unknown Book';
        break;
      case 'news':
        targetLink = `/news/${activity.target.id}`;
        targetName = activity.target.title || 'Unknown News';
        break;
      case 'group':
        targetLink = `/messages?group=${activity.target.id}`; // Navigate to specific group
        targetName = activity.target.name || 'Unknown Group';
        break;
      case 'shelf':
        targetLink = `/profile/${activity.userId}`; // Navigate to user's profile who created the shelf
        targetName = activity.target.name || 'Unknown Shelf';
        break;
    }

    // For group messages, show "в [group name]" without repeating the action text
    if (isGroupMessage) {
      return (
        <span className="text-sm">
          <span className="text-muted-foreground">{t('stream:in')} </span>
          <Link href={targetLink}>
            <span className="text-primary hover:underline cursor-pointer font-medium">
              {targetName}
            </span>
          </Link>
        </span>
      );
    }

    // For other actions with targets, show the full action text
    const actionText = t(`stream:actionTypes.${activity.action_type}`, activity.action_type);
    return (
      <span className="text-sm">
        <span className="text-muted-foreground">{actionText} </span>
        <Link href={targetLink}>
          <span className="text-primary hover:underline cursor-pointer font-medium">
            {targetName}
          </span>
        </Link>
      </span>
    );
  };

  // Format date display based on how long ago it was
  // Use timestamp if available, fallback to createdAt
  const dateValue = activity.timestamp || activity.createdAt;
  const activityDate = new Date(dateValue);
  
  // Check if date is valid
  const isValidDate = !isNaN(activityDate.getTime());
  const hoursSinceCreated = isValidDate ? differenceInHours(new Date(), activityDate) : 0;
  const showFullDate = hoursSinceCreated >= 24;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              {getActionIcon()}
              <span className="text-sm font-medium">
                {getActionTypeLabel()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isValidDate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">
                      {showFullDate
                        ? format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })
                        : formatDistanceToNow(activityDate, { addSuffix: true, locale: dateLocale })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isAdminOrModer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-6 w-6 min-h-6 p-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {/* User info section */}
        {activity.user && (activity.user.username) && (
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="w-8 h-8">
              {activity.user.avatar_url && (
                <AvatarImage
                  src={activity.user.avatar_url}
                  alt={activity.user.username}
                />
              )}
              <AvatarFallback>
                {(activity.user.username || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Link href={`/profile/${activity.user.id}`}>
              <span className="text-sm font-medium hover:underline cursor-pointer">
                {activity.user.username}
              </span>
            </Link>
            {renderActionDescription() && (
              <>
                {activity.action_type !== 'send_group_message' && (
                  <span className="text-muted-foreground">·</span>
                )}
                {renderActionDescription()}
              </>
            )}
          </div>
        )}
      </CardHeader>
      {/* Show message preview for group messages */}
      {activity.action_type === 'send_group_message' && activity.metadata?.message_preview && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground italic">
            "{activity.metadata.message_preview}"
          </p>
        </CardContent>
      )}
    </Card>
  );
}
