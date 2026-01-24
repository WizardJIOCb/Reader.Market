import { createContext, useContext, useEffect, ReactNode, useRef, createElement } from 'react';
import { getSocket } from './socket';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';

// Keys for localStorage
const STREAM_NOTIFICATIONS_KEY = 'streamNotificationsEnabled';
const STREAM_ACTION_FILTERS_KEY = 'streamActionTypeFilters';

// Types for action filtering
type ActionType = 'news' | 'book' | 'comment' | 'review' | 'user_action';

interface StreamNotificationsContextType {
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  getActionTypeFilters: () => ActionType[];
  setActionTypeFilters: (filters: ActionType[]) => void;
}

const StreamNotificationsContext = createContext<StreamNotificationsContextType | null>(null);

// Helper functions for localStorage
export function getStreamNotificationsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STREAM_NOTIFICATIONS_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function setStreamNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STREAM_NOTIFICATIONS_KEY, String(enabled));
  } catch (error) {
    console.error('Error saving stream notifications setting:', error);
  }
}

export function getStreamActionTypeFilters(): ActionType[] {
  try {
    const stored = localStorage.getItem(STREAM_ACTION_FILTERS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading stream action type filters:', error);
  }
  return ['news', 'book', 'comment', 'review'];
}

export function setStreamActionTypeFilters(filters: ActionType[]): void {
  try {
    localStorage.setItem(STREAM_ACTION_FILTERS_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving stream action type filters:', error);
  }
}

// Map action_type from server to frontend filter types
function mapActionTypeToFilter(actionType: string): ActionType | null {
  const mapping: Record<string, ActionType> = {
    // User navigation actions
    'view_profile': 'user_action',
    'view_book': 'user_action',
    'view_news': 'user_action',
    'navigate_home': 'user_action',
    'navigate_stream': 'user_action',
    'navigate_search': 'user_action',
    'navigate_shelves': 'user_action',
    'navigate_about': 'user_action',
    'navigate_messages': 'user_action',
    'navigate_users': 'user_action',
    'navigate_profile': 'user_action',
    'navigate_news': 'user_action',
    'navigate_book': 'user_action',
    'navigate_reader': 'user_action',
    // User actions
    'group_message': 'user_action',
    'send_group_message': 'user_action',
    'user_registered': 'user_action',
    'shelf_created': 'user_action',
    'book_added_to_shelf': 'book',
    'profile_rating': 'user_action',
    'search_books': 'user_action',
    // Comment/review actions
    'profile_comment': 'comment',
    'profile_comment_reply': 'comment',
    'book_comment_reaction': 'comment',
    'book_review_reaction': 'review',
    'profile_comment_reaction': 'user_action',
    'book_reaction': 'book',
    // Content creation
    'add_comment': 'comment',
    'add_review': 'review',
    'add_book': 'book',
    'add_news': 'news',
  };
  return mapping[actionType] || 'user_action';
}

interface StreamNotificationsProviderProps {
  children: ReactNode;
  currentUserId?: string;
}

export function StreamNotificationsProvider({ children, currentUserId }: StreamNotificationsProviderProps) {
  const { toast } = useToast();
  const { t } = useTranslation(['stream']);
  const [location] = useLocation();
  const processedActionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join rooms to receive events globally
    const joinRooms = () => {
      socket.emit('join:stream:last-actions');
      socket.emit('join:stream:global');
    };

    if (socket.connected) {
      joinRooms();
    }
    socket.on('connect', joinRooms);

    // Handle incoming new activity events (comments, reviews, books, news)
    const handleNewActivity = (activity: any) => {
      console.log('DEBUG: handleNewActivity received:', activity);
      // Skip if notifications are disabled
      if (!getStreamNotificationsEnabled()) {
        return;
      }

      // Skip if this is the current user's own activity
      if (currentUserId && activity.userId === currentUserId) {
        return;
      }

      // Skip if we've already processed this activity (dedup)
      if (processedActionsRef.current.has(activity.id)) {
        return;
      }
      processedActionsRef.current.add(activity.id);

      // Check if this activity type is in the user's filters
      const actionFilters = getStreamActionTypeFilters();
      const activityType = activity.type as ActionType;

      if (!actionFilters.includes(activityType)) {
        return;
      }

      // Build notification message to match Last Actions display exactly
      // Title = Activity type - Author name (like header in Last Actions)
      // Description = Full text of the activity with all dynamic values and links
      const authorName = activity.user?.fullName || activity.user?.username || activity.metadata?.author_name || activity.metadata?.uploader_name || t('stream:unknownUser');
      const authorId = activity.user?.id || activity.metadata?.author_id || activity.metadata?.uploader_id || activity.userId;
      const authorLink = `/profile/${authorId}`;
      let title: ReactNode = '';
      let description: ReactNode = '';

      // Helper to create author link element
      const createAuthorLink = (name: string, link: string) => 
        createElement('a', { href: link, className: 'font-medium hover:underline' }, name);
      
      // Helper to create target link element  
      const createTargetLink = (name: string, link: string) =>
        createElement('a', { href: link, className: 'text-primary hover:underline font-medium' }, name);

      if (activity.type === 'comment') {
        const bookTitle = activity.metadata?.book_title || '';
        const newsTitle = activity.metadata?.news_title || '';
        const bookId = activity.metadata?.book_id || activity.bookId;
        const newsId = activity.metadata?.news_id || activity.newsId;
        const commentText = activity.metadata?.comment_text || activity.metadata?.content_preview || activity.metadata?.content || '';
        title = createElement('span', null,
          t('stream:activityTypes.comment'),
          ' - ',
          createAuthorLink(authorName, authorLink)
        );
        if (bookTitle && bookId) {
          description = createElement('span', null,
            commentText && `"${commentText}"`,
            commentText && createElement('span', { className: 'text-muted-foreground' }, ' · '),
            createTargetLink(bookTitle, `/book/${bookId}`)
          );
        } else if (newsTitle && newsId) {
          description = createElement('span', null,
            commentText && `"${commentText}"`,
            commentText && createElement('span', { className: 'text-muted-foreground' }, ' · '),
            createTargetLink(newsTitle, `/news/${newsId}`)
          );
        } else {
          description = createElement('span', null,
            commentText && `"${commentText}"`
          );
        }
      } else if (activity.type === 'review') {
        title = createElement('span', null,
          t('stream:activityTypes.review'),
          ' - ',
          createAuthorLink(authorName, authorLink)
        );
        const bookTitle = activity.metadata?.bookTitle || activity.metadata?.book_title || '';
        const bookId = activity.metadata?.bookId || activity.metadata?.book_id || activity.bookId;
        const rating = activity.metadata?.rating || '';
        const reviewText = activity.metadata?.content_preview || activity.metadata?.content || activity.metadata?.review_text || '';
        description = createElement('span', null,
          reviewText && `"${reviewText}"`,
          reviewText && rating && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          rating && createElement('span', { className: 'text-muted-foreground' }, ` (${rating}/10)`),
          (reviewText || rating) && bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && bookId && createTargetLink(bookTitle, `/book/${bookId}`)
        );
      } else if (activity.type === 'book') {
        title = createElement('span', null,
          t('stream:activityTypes.book'),
          ' - ',
          createAuthorLink(authorName, authorLink)
        );
        const bookTitle = activity.metadata?.title || '';
        const bookId = activity.entityId || activity.bookId;
        description = createElement('span', null,
          createTargetLink(bookTitle, `/book/${bookId}`)
        );
      } else if (activity.type === 'news') {
        title = createElement('span', null,
          t('stream:activityTypes.news'),
          ' - ',
          createAuthorLink(authorName, authorLink)
        );
        const newsTitle = activity.metadata?.title || '';
        const newsId = activity.entityId || activity.newsId;
        if (newsTitle && newsId) {
          description = createTargetLink(newsTitle, `/news/${newsId}`);
        } else {
          description = t('stream:newNews');
        }
      } else {
        return; // Unknown type, skip
      }

      // Show toast notification matching Last Actions format
      console.log('DEBUG: Showing toast - title:', title, 'description:', description);
      toast({
        title: title,
        description: description,
        duration: 5000,
      });
    };

    // Handle incoming last action events
    const handleLastAction = (action: any) => {
      console.log('DEBUG: handleLastAction received:', action);
      // Skip if notifications are disabled
      if (!getStreamNotificationsEnabled()) {
        return;
      }

      // Skip if this is the current user's own action
      const actionUserId = action.user?.id || action.userId;
      if (currentUserId && actionUserId === currentUserId) {
        return;
      }

      // Skip if we've already processed this action (dedup)
      if (processedActionsRef.current.has(action.id)) {
        return;
      }
      processedActionsRef.current.add(action.id);
      
      // Keep the set from growing too large
      if (processedActionsRef.current.size > 100) {
        const entries = Array.from(processedActionsRef.current);
        processedActionsRef.current = new Set(entries.slice(-50));
      }

      // Check if this action type is in the user's filters
      const actionFilters = getStreamActionTypeFilters();
      const mappedType = mapActionTypeToFilter(action.action_type);
      
      // Skip send_group_message - handled by MessageNotificationProvider
      if (action.action_type === 'send_group_message') {
        console.log('DEBUG: Skipping send_group_message in StreamNotifications');
        return;
      }
      
      if (!mappedType || !actionFilters.includes(mappedType)) {
        return;
      }

      // Build notification message to match Last Actions display exactly
      // Title = Action type label (like header in Last Actions)
      // Description = Username link · target link (like user section in Last Actions)
      const userName = action.user?.fullName || action.user?.username || t('stream:unknownUser');
      const userLink = `/profile/${action.user?.username || action.user?.id || ''}`;
      let title: ReactNode = '';
      let description: ReactNode = '';
      
      // Helper to create user link element
      const createUserLink = (name: string, link: string) => 
        createElement('a', { href: link, className: 'font-medium hover:underline' }, name);
      
      // Helper to create target link element  
      const createTargetLink = (name: string, link: string) =>
        createElement('a', { href: link, className: 'text-primary hover:underline font-medium' }, name);

      // Build title (action type) and description (username + target) with links
      if (action.action_type === 'view_profile' || action.action_type === 'navigate_profile') {
        title = t('stream:actionTypes.navigate_profile');
        const targetName = action.target?.full_name 
          ? `${action.target.full_name} (@${action.target.username})`
          : (action.metadata?.full_name || action.metadata?.username || action.target?.username || '');
        const targetLink = `/profile/${action.target?.username || action.target?.id || ''}`;
        
        // Check if viewing own profile - or if target information is missing
        const isViewingOwnProfile = action.user?.id === action.target?.id || 
                                    action.user?.username === action.target?.username ||
                                    userName === targetName ||
                                    !targetName || // If target name is empty, assume viewing own profile
                                    targetLink === '/profile/'; // If target link is invalid, assume viewing own profile
        
        if (isViewingOwnProfile) {
          description = createElement('span', null,
            createUserLink(userName, userLink),
            createElement('span', { className: 'text-muted-foreground' }, ` ${t('stream:viewedOwnProfile')}`)
          );
        } else {
          description = createElement('span', null,
            createUserLink(userName, userLink),
            createElement('span', { className: 'text-muted-foreground' }, ` ${t('stream:on')} `),
            createTargetLink(targetName, targetLink)
          );
        }
      } else if (action.action_type === 'view_book' || action.action_type === 'navigate_book') {
        title = t('stream:actionTypes.navigate_book');
        const bookTitle = action.target?.title || action.metadata?.title || '';
        const bookLink = `/book/${action.target?.id || action.metadata?.book_id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && createTargetLink(bookTitle, bookLink)
        );
      } else if (action.action_type === 'view_news' || action.action_type === 'navigate_news') {
        title = t('stream:actionTypes.navigate_news');
        const newsTitle = action.target?.title || action.metadata?.title || '';
        const newsLink = `/news/${action.target?.id || action.metadata?.news_id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          newsTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          newsTitle && createTargetLink(newsTitle, newsLink)
        );
      } else if (action.action_type === 'navigate_reader') {
        title = t('stream:actionTypes.navigate_reader');
        const bookTitle = action.target?.title || action.metadata?.title || '';
        const bookLink = `/book/${action.target?.id || action.metadata?.book_id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && createTargetLink(bookTitle, bookLink)
        );
      } else if (action.action_type === 'book_comment_reaction') {
        title = t('stream:actionTypes.book_comment_reaction');
        const emoji = action.metadata?.emoji || '❤️';
        const bookTitle = action.metadata?.book_title || '';
        const bookLink = `/book/${action.metadata?.book_id || ''}`;
        const commentText = action.metadata?.comment_text || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          ' ', emoji,
          commentText && ` "${commentText}"`,
          (commentText || emoji) && bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && createTargetLink(bookTitle, bookLink)
        );
      } else if (action.action_type === 'book_review_reaction') {
        title = t('stream:actionTypes.book_review_reaction');
        const emoji = action.metadata?.emoji || '❤️';
        const bookTitle = action.metadata?.book_title || '';
        const bookLink = `/book/${action.metadata?.book_id || ''}`;
        const reviewText = action.metadata?.review_text || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          ' ', emoji,
          reviewText && ` "${reviewText}"`,
          (reviewText || emoji) && bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && createTargetLink(bookTitle, bookLink)
        );
      } else if (action.action_type === 'book_reaction') {
        title = t('stream:actionTypes.book_reaction');
        const emoji = action.metadata?.emoji || '❤️';
        const bookTitle = action.metadata?.book_title || action.target?.title || action.metadata?.title || '';
        const bookLink = `/book/${action.target?.id || action.metadata?.book_id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          ' ', emoji,
          bookTitle && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          bookTitle && createTargetLink(bookTitle, bookLink)
        );
      } else if (action.action_type === 'group_message' || action.action_type === 'send_group_message') {
        title = t('stream:actionTypes.send_group_message').replace(/ в$/, '').replace(/ in$/, '');
        const groupName = action.target?.name || action.metadata?.group_name || '';
        const groupLink = `/messages?group=${action.target?.id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          groupName && createElement('span', { className: 'text-muted-foreground' }, ` · ${t('stream:in')} `),
          groupName && createTargetLink(groupName, groupLink)
        );
      } else if (action.action_type === 'search_books') {
        title = t('stream:actionTypes.search_books');
        const searchQuery = action.metadata?.search_query || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          searchQuery && createElement('span', { className: 'text-muted-foreground italic' }, ` · "${searchQuery}"`)
        );
      } else if (action.action_type === 'shelf_created') {
        title = t('stream:actionTypes.shelf_created');
        const shelfName = action.target?.name || action.metadata?.shelf_name || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          shelfName && createElement('span', { className: 'font-medium' }, ` · "${shelfName}"`)
        );
      } else if (action.action_type === 'book_added_to_shelf') {
        title = t('stream:actionTypes.book_added_to_shelf');
        const bookTitle = action.target?.title || action.metadata?.book_title || '';
        const shelfName = action.target?.shelf_name || action.metadata?.shelf_name || '';
        const bookLink = `/book/${action.target?.id || action.metadata?.book_id || ''}`;
        description = createElement('span', null,
          createUserLink(userName, userLink),
          createElement('span', { className: 'text-muted-foreground' }, ` · ${t('stream:added')} `),
          bookTitle && createTargetLink(bookTitle, bookLink),
          shelfName && createElement('span', { className: 'text-muted-foreground' }, ` ${t('stream:to')} `),
          shelfName && createElement('span', { className: 'font-medium' }, shelfName)
        );
      } else if (action.action_type === 'user_registered') {
        title = t('stream:actionTypes.user_registered');
        description = createUserLink(userName, userLink);
      } else if (action.action_type === 'profile_comment') {
        title = t('stream:actionTypes.profile_comment');
        const targetName = action.target?.full_name
          ? `${action.target.full_name} (@${action.target.username})`
          : (action.metadata?.target_name || action.target?.username || '');
        const targetLink = `/profile/${action.target?.username || action.target?.id || ''}`;
        const commentText = action.metadata?.comment_text || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          targetName && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          targetName && createTargetLink(targetName, targetLink),
          commentText && createElement('span', { className: 'text-muted-foreground' }, ` · "${commentText}"`)
        );
      } else if (action.action_type === 'profile_comment_reply') {
        title = t('stream:actionTypes.profile_comment_reply');
        const targetName = action.target?.full_name
          ? `${action.target.full_name} (@${action.target.username})`
          : (action.metadata?.target_name || action.target?.username || '');
        const targetLink = `/profile/${action.target?.username || action.target?.id || ''}`;
        const commentText = action.metadata?.comment_text || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          targetName && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          targetName && createTargetLink(targetName, targetLink),
          commentText && createElement('span', { className: 'text-muted-foreground' }, ` · "${commentText}"`)
        );
      } else if (action.action_type === 'profile_rating') {
        title = t('stream:actionTypes.profile_rating');
        const targetName = action.target?.full_name 
          ? `${action.target.full_name} (@${action.target.username})`
          : (action.metadata?.target_name || action.target?.username || '');
        const targetLink = `/profile/${action.target?.username || action.target?.id || ''}`;
        const rating = action.metadata?.rating || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          targetName && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          targetName && createTargetLink(targetName, targetLink),
          rating && createElement('span', { className: 'text-muted-foreground' }, ` (${rating}/10)`)
        );
      } else if (action.action_type === 'profile_comment_reaction') {
        title = t('stream:actionTypes.profile_comment_reaction');
        const emoji = action.metadata?.emoji || '❤️';
        const targetName = action.target?.full_name
          ? `${action.target.full_name} (@${action.target.username})`
          : (action.metadata?.target_name || action.target?.username || '');
        const targetLink = `/profile/${action.target?.username || action.target?.id || ''}`;
        const commentText = action.metadata?.comment_text || '';
        description = createElement('span', null,
          createUserLink(userName, userLink),
          ' ', emoji,
          commentText && ` "${commentText}"`,
          (commentText || emoji) && targetName && createElement('span', { className: 'text-muted-foreground' }, ' · '),
          targetName && createTargetLink(targetName, targetLink)
        );
      } else {
        // Generic fallback
        title = t(`stream:actionTypes.${action.action_type}`, { defaultValue: action.action_type });
        description = createUserLink(userName, userLink);
      }

      // Show toast notification matching Last Actions format
      console.log('DEBUG: Showing toast - title:', title, 'description:', description);
      toast({
        title: title,
        description: description,
        duration: 5000,
      });
    };

    socket.on('stream:new-activity', handleNewActivity);
    socket.on('stream:last-action', handleLastAction);

    return () => {
      socket.off('connect', joinRooms);
      socket.off('stream:new-activity', handleNewActivity);
      socket.off('stream:last-action', handleLastAction);
    };
  }, [location, currentUserId, toast, t]);

  const contextValue: StreamNotificationsContextType = {
    notificationsEnabled: getStreamNotificationsEnabled(),
    setNotificationsEnabled: setStreamNotificationsEnabled,
    getActionTypeFilters: getStreamActionTypeFilters,
    setActionTypeFilters: setStreamActionTypeFilters,
  };

  return (
    <StreamNotificationsContext.Provider value={contextValue}>
      {children}
    </StreamNotificationsContext.Provider>
  );
}

export function useStreamNotifications() {
  const context = useContext(StreamNotificationsContext);
  if (!context) {
    throw new Error('useStreamNotifications must be used within StreamNotificationsProvider');
  }
  return context;
}
