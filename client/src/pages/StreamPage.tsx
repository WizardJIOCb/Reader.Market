import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityCard } from "@/components/stream/ActivityCard";
import { LastActionsActivityCard } from "@/components/stream/LastActionsActivityCard";
import { ShelfFilters } from "@/components/stream/ShelfFilters";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { usePageView } from "@/hooks/usePageView";

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

interface ShelfFiltersData {
  selectedShelf: string | null;
  selectedBooks: string[];
}

export default function StreamPage() {
  const { t } = useTranslation(['stream', 'navigation']);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'global' | 'personal' | 'shelves' | 'last-actions'>('global');
  const [filters, setFilters] = useState<ShelfFiltersData>({ selectedShelf: null, selectedBooks: [] });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const socketRef = useRef<any>(null);
  
  // Track page view for navigation logging
  usePageView('stream');

  // Set document title
  useEffect(() => {
    document.title = `${t('stream:title')} - Reader.Market`;
  }, [t]);

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
  }, []);

  // Invalidate query cache on mount to ensure fresh data when returning to Stream page
  // This fixes the issue where comments posted on other pages don't appear until manual refresh
  useEffect(() => {
    console.log('[STREAM PAGE] Component mounted, invalidating cache for fresh data');
    
    // Always invalidate global stream as it's visible to all users
    queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
    
    // Invalidate personal stream if authenticated and on personal tab
    if (isAuthenticated && activeTab === 'personal') {
      console.log('[STREAM PAGE] Invalidating personal stream cache');
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
    }
    
    // Invalidate shelves stream if authenticated and on shelves tab
    if (isAuthenticated && activeTab === 'shelves') {
      console.log('[STREAM PAGE] Invalidating shelves stream cache');
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'shelves'] });
    }
  }, []); // Run only on mount

  // Fetch global stream - always keep this active to receive real-time updates
  const { data: globalActivities = [], isLoading: globalLoading, refetch: refetchGlobal } = useQuery<Activity[]>({
    queryKey: ['api', 'stream', 'global'],
    // Always enabled to maintain cache for real-time updates
  });

  // Fetch personal stream
  const { data: personalActivities = [], isLoading: personalLoading, refetch: refetchPersonal } = useQuery<Activity[]>({
    queryKey: ['api', 'stream', 'personal'],
    enabled: activeTab === 'personal' && isAuthenticated,
  });

  // Fetch shelf stream
  const { data: shelfActivities = [], isLoading: shelfLoading, refetch: refetchShelf } = useQuery<Activity[]>({
    queryKey: ['api', 'stream', 'shelves', filters],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const shelfQueryParams = new URLSearchParams();
      if (filters.selectedShelf) {
        shelfQueryParams.append('shelfIds', filters.selectedShelf);
      }
      if (filters.selectedBooks.length > 0) {
        shelfQueryParams.append('bookIds', filters.selectedBooks.join(','));
      }
      const queryString = shelfQueryParams.toString();
      const url = queryString ? `/api/stream/shelves?${queryString}` : '/api/stream/shelves';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shelf activities: ${response.status}`);
      }
      
      return await response.json();
    },
    enabled: activeTab === 'shelves' && isAuthenticated,
  });
  
  // Fetch last actions stream
  const { data: lastActionsData, isLoading: lastActionsLoading, refetch: refetchLastActions } = useQuery<any>({
    queryKey: ['api', 'stream', 'last-actions'],
    queryFn: async () => {
      const response = await fetch('/api/stream/last-actions?limit=50');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch last actions: ${response.status}`);
      }
      
      return await response.json();
    },
    enabled: activeTab === 'last-actions',
  });
  
  const lastActions = lastActionsData?.activities || [];

  // Get current activities based on active tab
  const currentActivities: any[] = activeTab === 'global' ? globalActivities : 
                           activeTab === 'personal' ? personalActivities : 
                           activeTab === 'last-actions' ? lastActions :
                           shelfActivities;
  
  const isLoading = activeTab === 'global' ? globalLoading : 
                   activeTab === 'personal' ? personalLoading :
                   activeTab === 'last-actions' ? lastActionsLoading :
                   shelfLoading;

  // Page Visibility API: Refetch data when user returns to the browser tab
  // This ensures the stream is up-to-date after switching tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[STREAM PAGE] Tab became visible, refetching active stream');
        
        // Refetch the currently active tab's data
        if (activeTab === 'global') {
          refetchGlobal();
        } else if (activeTab === 'personal' && isAuthenticated) {
          refetchPersonal();
        } else if (activeTab === 'shelves' && isAuthenticated) {
          refetchShelf();
        } else if (activeTab === 'last-actions') {
          refetchLastActions();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, isAuthenticated, refetchGlobal, refetchPersonal, refetchShelf, refetchLastActions]);

  // WebSocket connection and event handlers
  useEffect(() => {
    console.log('[STREAM PAGE] Setting up WebSocket connection...');
    const socket = getSocket();
    if (!socket) {
      console.warn('[STREAM PAGE] No socket available - will retry shortly');
      // Socket may not be initialized yet, will be available on next render
      return;
    }

    console.log('[STREAM PAGE] Socket connected:', socket.connected);
    console.log('[STREAM PAGE] Is authenticated:', isAuthenticated);
    socketRef.current = socket;

    // Store the current tab value for cleanup
    const currentTab = activeTab;
    const wasAuthenticated = isAuthenticated;

    // Function to join rooms
    const joinRooms = () => {
      // ALWAYS join global room - we need to receive all global activities
      // regardless of which tab is active
      console.log('[STREAM PAGE] Joining global stream room (always active)');
      socket.emit('join:stream:global');
      
      // ALWAYS join last-actions room - we need to receive all last actions
      console.log('[STREAM PAGE] Joining last actions stream room (always active)');
      socket.emit('join:stream:last-actions');
      
      // Join tab-specific rooms based on active tab
      if (activeTab === 'personal' && isAuthenticated) {
        console.log('[STREAM PAGE] Joining personal stream room');
        socket.emit('join:stream:personal');
      } else if (activeTab === 'shelves' && isAuthenticated) {
        console.log('[STREAM PAGE] Joining shelves stream room');
        socket.emit('join:stream:shelves');
      }
    };

    // Join rooms immediately if already connected
    if (socket.connected) {
      joinRooms();
    } else {
      // If not connected yet, wait for connection
      console.log('[STREAM PAGE] Socket not connected yet, will join rooms on connect event');
    }

    // Also join when connection is established (in case of reconnection or delayed connection)
    const handleConnect = () => {
      console.log('[STREAM PAGE] Socket connected event fired, joining rooms');
      joinRooms();
    };
    socket.on('connect', handleConnect);

    // Listen for new activities
    const handleNewActivity = (activity: Activity) => {
      console.log('[STREAM] New activity received:', activity);
      console.log('[STREAM] Activity type:', activity.type);
      console.log('[STREAM] Activity metadata:', activity.metadata);
      if (activity.type === 'comment') {
        console.log('[STREAM] Comment has news_title:', activity.metadata?.news_title);
        console.log('[STREAM] Comment has book_title:', activity.metadata?.book_title);
      }
      
      // Update the appropriate query cache based on active tab
      // Global stream - always update
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
        // Check if activity already exists to avoid duplicates
        if (oldData.some(a => a.id === activity.id)) {
          return oldData;
        }
        return [activity, ...oldData];
      });
      
      // Last Actions - also add global activities here since they're part of merged stream
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData) {
          return { activities: [activity] };
        }
        
        const activities = oldData.activities || [];
        
        // Check if activity already exists to avoid duplicates
        if (activities.some((a: any) => a.id === activity.id)) {
          return oldData;
        }
        
        return {
          ...oldData,
          activities: [activity, ...activities]
        };
      });
      
      // Personal stream - update if activity was created by current user
      // Personal stream shows user's own activities (their comments, reviews, news, books)
      if (currentUser && activity.userId === currentUser.id) {
        console.log('[STREAM] Adding activity to personal stream - created by current user');
        queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (oldData = []) => {
          if (oldData.some(a => a.id === activity.id)) {
            return oldData;
          }
          return [activity, ...oldData];
        });
      }
      
      // Shelf stream - update if there's a bookId
      if (activity.bookId) {
        queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], (oldData = []) => {
          if (oldData.some(a => a.id === activity.id)) {
            return oldData;
          }
          return [activity, ...oldData];
        });
      }
      
      // Show toast notification for new activity
      const activityTypeText = activity.type === 'comment' ? t('stream:newComment') :
                                activity.type === 'review' ? t('stream:newReview') :
                                activity.type === 'book' ? t('stream:newBook') :
                                t('stream:newNews');
      
      toast({
        title: t('stream:newActivity'),
        description: activityTypeText,
      });
    };

    const handleActivityUpdated = (data: { entityId: string; metadata: any }) => {
      console.log('[STREAM] Activity updated:', data);
      // Update the activity in the query cache
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'shelves'] });
    };

    const handleActivityDeleted = (data: { entityId: string }) => {
      console.log('[STREAM] Activity deleted:', data);
      
      // Remove the activity from all query caches
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
        return oldData.filter(a => a.entityId !== data.entityId);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (oldData = []) => {
        return oldData.filter(a => a.entityId !== data.entityId);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], (oldData = []) => {
        return oldData.filter(a => a.entityId !== data.entityId);
      });
    };

    const handleReactionUpdate = (data: { commentId: string; entityId: string; entityType: string; reactions: any[]; action: string }) => {
      console.log('[STREAM] Reaction update received:', data);
      
      // Update activities in all caches to update reactions
      const updateActivities = (oldData: Activity[] = []) => {
        return oldData.map(activity => {
          // Match by entityId and entityType
          // For comments: match by entityId (comment ID)
          // For reviews: match by entityId (review ID)  
          // For news: match by entityId (news ID) and type 'news'
          const isMatch = 
            (data.entityType === 'comment' && (activity.entityId === data.entityId || activity.id === data.commentId)) ||
            (data.entityType === 'review' && activity.entityId === data.entityId) ||
            (data.entityType === 'news' && activity.entityId === data.entityId && activity.type === 'news');
            
          if (isMatch) {
            console.log('[STREAM] Updating reactions for activity:', activity.id, 'with reactions:', data.reactions);
            return {
              ...activity,
              metadata: {
                ...activity.metadata,
                reactions: data.reactions
              }
            };
          }
          return activity;
        });
      };
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], updateActivities);
    };

    const handleCounterUpdate = (data: { entityId: string; entityType: string; commentCount?: number; reactionCount?: number; viewCount?: number; reviewCount?: number }) => {
      console.log('[STREAM] Counter update received:', data);
      
      // Update counters for news and book activities
      const updateActivities = (oldData: Activity[] = []) => {
        return oldData.map(activity => {
          // Match by entityId (news ID or book ID) and type
          if ((activity.entityId === data.entityId || activity.newsId === data.entityId || activity.bookId === data.entityId) &&
              (activity.type === data.entityType)) {
            console.log('[STREAM] Updating counters for activity:', activity.id, 'with data:', data);
            const updatedMetadata = { ...activity.metadata };
            
            if (data.commentCount !== undefined) {
              updatedMetadata.comment_count = data.commentCount;
            }
            if (data.reactionCount !== undefined) {
              updatedMetadata.reaction_count = data.reactionCount;
            }
            if (data.viewCount !== undefined) {
              updatedMetadata.view_count = data.viewCount;
            }
            if (data.reviewCount !== undefined) {
              updatedMetadata.review_count = data.reviewCount;
            }
            
            return {
              ...activity,
              metadata: updatedMetadata
            };
          }
          return activity;
        });
      };
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], updateActivities);
    };
    
    const handleLastAction = (action: any) => {
      console.log('[STREAM] New last action received:', action);
      
      // Update the last actions query cache
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData) {
          return { activities: [action] };
        }
        
        const activities = oldData.activities || [];
        
        // Check if action already exists to avoid duplicates
        if (activities.some((a: any) => a.id === action.id)) {
          return oldData;
        }
        
        return {
          ...oldData,
          activities: [action, ...activities]
        };
      });
      
      // Show toast notification for last action
      toast({
        title: t('stream:newActivity'),
        description: t(`stream:actionTypes.${action.action_type}`),
      });
    };

    socket.on('stream:new-activity', handleNewActivity);
    socket.on('stream:activity-updated', handleActivityUpdated);
    socket.on('stream:activity-deleted', handleActivityDeleted);
    socket.on('stream:reaction-update', handleReactionUpdate);
    socket.on('stream:counter-update', handleCounterUpdate);
    socket.on('stream:last-action', handleLastAction);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('stream:new-activity', handleNewActivity);
      socket.off('stream:activity-updated', handleActivityUpdated);
      socket.off('stream:activity-deleted', handleActivityDeleted);
      socket.off('stream:reaction-update', handleReactionUpdate);
      socket.off('stream:counter-update', handleCounterUpdate);
      socket.off('stream:last-action', handleLastAction);
      
      // Leave tab-specific rooms only - NEVER leave global room or last-actions room
      // Global room and last-actions room should stay active to receive updates even when on other tabs
      console.log('[STREAM PAGE] Cleanup: leaving tab-specific room for tab:', currentTab);
      if (currentTab === 'personal' && wasAuthenticated) {
        socket.emit('leave:stream:personal');
      } else if (currentTab === 'shelves' && wasAuthenticated) {
        socket.emit('leave:stream:shelves');
      }
      // Note: We don't leave global room or last-actions room - they stay active throughout the session
    };
  }, [activeTab, isAuthenticated, queryClient, filters, toast, t, currentUser]);

  // Handle tab change
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'global' | 'personal' | 'shelves' | 'last-actions');
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (activeTab === 'global') {
      refetchGlobal();
    } else if (activeTab === 'personal') {
      refetchPersonal();
    } else if (activeTab === 'last-actions') {
      refetchLastActions();
    } else {
      refetchShelf();
    }
  }, [activeTab, refetchGlobal, refetchPersonal, refetchShelf, refetchLastActions]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilters: ShelfFiltersData) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t('stream:title')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="global">
            {t('stream:globalTab')}
          </TabsTrigger>
          <TabsTrigger value="shelves" disabled={!isAuthenticated}>
            {t('stream:myShelvesTab')}
          </TabsTrigger>
          <TabsTrigger value="personal" disabled={!isAuthenticated}>
            {t('stream:myTab')}
          </TabsTrigger>
          <TabsTrigger value="last-actions">
            <Zap className="w-4 h-4 mr-2" />
            {t('stream:lastActionsTab')}
          </TabsTrigger>
        </TabsList>

        {/* Global Stream Tab */}
        <TabsContent value="global" className="mt-0">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : currentActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('stream:noActivities')}
              </div>
            ) : (
              currentActivities.map((activity: any) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))
            )}
          </div>
        </TabsContent>

        {/* Shelf Stream Tab */}
        <TabsContent value="shelves" className="mt-0">
          {!isAuthenticated ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('stream:authRequired')}
            </div>
          ) : (
            <div className="space-y-4">
              <ShelfFilters 
                filters={filters} 
                onFilterChange={handleFilterChange}
              />
              
              <div className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading...
                  </div>
                ) : currentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('stream:noActivities')}
                  </div>
                ) : (
                  currentActivities.map((activity: any) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Personal Stream Tab */}
        <TabsContent value="personal" className="mt-0">
          {!isAuthenticated ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('stream:authRequired')}
            </div>
          ) : (
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : currentActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('stream:noActivities')}
                </div>
              ) : (
                currentActivities.map((activity: any) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              )}
            </div>
          )}
        </TabsContent>
        
        {/* Last Actions Tab */}
        <TabsContent value="last-actions" className="mt-0">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : currentActivities.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {t('stream:noLastActions')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('stream:noLastActionsSubtext')}
                </p>
              </div>
            ) : (
              currentActivities.map((action: any) => {
                // Regular activities from global stream
                if (action.type !== 'user_action') {
                  return <ActivityCard key={action.id} activity={action} />;
                }
                // User actions (navigation, group messages)
                return <LastActionsActivityCard key={action.id} activity={action} />;
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
