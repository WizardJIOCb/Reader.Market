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
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/stream/activities/${activity.entityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete action');
      }

      // Optimistically remove from Last Actions cache
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          activities: oldData.activities.filter((a: any) => a.id !== activity.id)
        };
      });

      toast({
        title: t('stream:activityDeleted'),
        description: t('stream:activityDeletedDescription')
      });
    } catch (error) {
      console.error('Error deleting action:', error);
      toast({
        title: t('stream:error'),
        description: t('stream:deleteError'),
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

    const actionText = t(`stream:actionTypes.${activity.action_type}`, activity.action_type);

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
    }

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
                <span className="text-muted-foreground">·</span>
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
