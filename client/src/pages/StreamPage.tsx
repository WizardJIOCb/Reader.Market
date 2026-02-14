import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityCard } from "@/components/stream/ActivityCard";
import { LastActionsActivityCard } from "@/components/stream/LastActionsActivityCard";
import { ShelfFilters } from "@/components/stream/ShelfFilters";
import { ActivityTypeFilter } from "@/components/stream/ActivityTypeFilter";
import { Button } from "@/components/ui/button";
import { Zap, Globe, Library, User } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { usePageView } from "@/hooks/usePageView";

interface Activity {
  id: string;
  type: 'news' | 'book' | 'comment' | 'review' | 'user_action';
  entityId: string;
  userId: string;
  targetUserId?: string;
  newsId?: string;
  bookId?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

type ActivityType = 'news' | 'book' | 'comment' | 'review' | 'user_action';

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
  const [, setForceUpdate] = useState(0); // Force re-render after WebSocket updates
  
  // Load showMyActivity state from localStorage or use defaults
  const loadShowMyActivityFromStorage = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem('streamShowMyActivity');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading showMyActivity from localStorage:', error);
    }
    // Return defaults if not in storage or error
    return {
      global: false, // Don't show own activities by default
      personal: true, // Always show own activities on personal tab
      shelves: false, // Don't show own activities by default
      'last-actions': false // Don't show own activities by default
    };
  };
  
  // Show my activity filter for each tab (separate state per tab)
  const [showMyActivity, setShowMyActivity] = useState<Record<string, boolean>>(loadShowMyActivityFromStorage);
  
  // Filter panel open/closed state - shared across all tabs
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  
  // Activity type filters for each tab
  const [activityTypeFilters, setActivityTypeFilters] = useState<Record<string, ActivityType[]>>({
    global: ['news', 'book', 'comment', 'review'],
    personal: ['news', 'book', 'comment', 'review'],
    shelves: ['news', 'book', 'comment', 'review'],
    'last-actions': ['news', 'book', 'comment', 'review', 'user_action']
  });
  
  // User filter for each tab
  const [userFilters, setUserFilters] = useState<Record<string, string>>({
    global: '',
    personal: '',
    shelves: '',
    'last-actions': ''
  });
  
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

  // Save showMyActivity state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('streamShowMyActivity', JSON.stringify(showMyActivity));
    } catch (error) {
      console.error('Error saving showMyActivity to localStorage:', error);
    }
  }, [showMyActivity]);

  // Invalidate query cache on mount to ensure fresh data when returning to Stream page
  // This fixes the issue where comments posted on other pages don't appear until manual refresh
  useEffect(() => {
    
    
    // Always invalidate global stream as it's visible to all users
    queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
    
    // Always invalidate last actions to show recent navigation
    queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'last-actions'] });
    
    // Invalidate personal stream if authenticated and on personal tab
    if (isAuthenticated && activeTab === 'personal') {
      
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
    }
    
    // Invalidate shelves stream if authenticated and on shelves tab
    if (isAuthenticated && activeTab === 'shelves') {
      
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
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to browser tab
  });
  
  const lastActions = lastActionsData?.activities || [];

  // Get current activities based on active tab
  const currentActivities: any[] = activeTab === 'global' ? globalActivities : 
                           activeTab === 'personal' ? personalActivities : 
                           activeTab === 'last-actions' ? lastActions :
                           shelfActivities;
  
  // Build a map of parent comment IDs to detect which comments have nested replies
  // API now returns replies inside metadata.replies, but we also need to filter old duplicate replies
  const parentCommentIds = new Set<string>();
  const repliesByParentId: Record<string, any[]> = {};
  
  currentActivities.forEach(activity => {
    // Check if this activity is a reply (has parentCommentId in metadata)
    const parentId = activity.metadata?.parentCommentId;
    if (activity.type === 'comment' && parentId) {
      parentCommentIds.add(parentId);
      if (!repliesByParentId[parentId]) {
        repliesByParentId[parentId] = [];
      }
      repliesByParentId[parentId].push(activity);
    }
  });
  
  // Filter out reply activities - they will only show as nested inside parent comments
  // Hide comments that have parentCommentId (they are replies and will be shown nested)
  const activitiesWithoutReplies = currentActivities.filter(activity => {
    if (activity.type === 'comment' && activity.metadata?.parentCommentId) {
      return false;
    }
    return true;
  });
  
  // Add replies to parent comments - merge API replies with detected replies
  const activitiesWithReplies = activitiesWithoutReplies.map(activity => {
    if (activity.type === 'comment') {
      // First, use replies from API if available
      let allReplies: any[] = activity.metadata?.replies || [];
      
      // Add any additional replies we detected that aren't in API response
      const additionalReplies = repliesByParentId[activity.id] || [];
      const existingIds = new Set(allReplies.map((r: any) => r.id));
      const newReplies = additionalReplies.filter((r: any) => !existingIds.has(r.id));
      allReplies = [...allReplies, ...newReplies];
      
      // If we have replies, update the activity
      if (allReplies.length > 0) {
        return {
          ...activity,
          metadata: {
            ...activity.metadata,
            replies: allReplies,
            reply_count: allReplies.length,
            parentCommentId: null // Ensure root comments have null parentCommentId
          }
        };
      }
      
      return {
        ...activity,
        metadata: {
          ...activity.metadata,
          parentCommentId: activity.metadata?.parentCommentId || null
        }
      };
    }
    return activity;
  });
  
  // Apply activity type filtering
  const selectedTypeFilters = activityTypeFilters[activeTab] || [];
  let filteredActivities = activitiesWithReplies.filter(activity => 
    selectedTypeFilters.includes(activity.type as ActivityType)
  );
  
  // Apply user filter
  const currentUserFilter = userFilters[activeTab] || '';
  if (currentUserFilter) {
    const filterLower = currentUserFilter.toLowerCase().trim();
    
    // Debug logging
    if (activeTab === 'last-actions') {
      console.log('[StreamPage] Applying user filter:', filterLower);
      
      // Show all unique usernames in current dataset
      const usernameMap: Record<string, boolean> = {};
      filteredActivities.forEach(a => {
        const username = a.type === 'user_action' 
          ? a.user?.username || 'N/A'
          : a.metadata?.username || a.metadata?.author_name || a.metadata?.uploader_name || 'N/A';
        if (username !== 'N/A') {
          usernameMap[username] = true;
        }
      });
      const allUsernames = Object.keys(usernameMap);
      
      console.log('[StreamPage] Available usernames in dataset:', allUsernames);
      
      console.log('[StreamPage] Sample activities:', filteredActivities.slice(0, 5).map(a => ({
        id: a.id,
        type: a.type,
        username: a.type === 'user_action' 
          ? a.user?.username || 'N/A'
          : a.metadata?.username || a.metadata?.author_name || a.metadata?.uploader_name || 'N/A',
        fullName: a.type === 'user_action'
          ? a.user?.username || 'N/A'
          : a.metadata?.fullName || a.metadata?.author_name || a.metadata?.uploader_name || 'N/A'
      })));
    }
    
    filteredActivities = filteredActivities.filter(activity => {
      // For user_action activities (Last Actions), check activity.user
      if (activity.type === 'user_action') {
        const username = activity.user?.username || '';
        const fullName = activity.user?.username || ''; // Last actions typically only have username
        
        const matches = (
          username.toLowerCase().includes(filterLower) ||
          fullName.toLowerCase().includes(filterLower)
        );
        
        if (activeTab === 'last-actions' && filterLower) {
          console.log(`[StreamPage] Activity ${activity.id}:`);
          console.log(`  - Raw username: '${activity.user?.username}'`);
          console.log(`  - Processed username: '${username}'`);
          console.log(`  - Filter text: '${currentUserFilter}'`);
          console.log(`  - Filter lower: '${filterLower}'`);
          console.log(`  - Username includes filter: ${username.toLowerCase().includes(filterLower)}`);
          console.log(`  - Matches: ${matches}`);
        }
        
        return matches;
      }
      
      // For regular activities, check metadata fields
      const username = activity.metadata?.username || 
                      activity.metadata?.user?.username || 
                      activity.metadata?.author_name || 
                      activity.metadata?.uploader_name || '';
      const fullName = activity.metadata?.fullName || 
                      activity.metadata?.user?.fullName || 
                      activity.metadata?.author_name || 
                      activity.metadata?.uploader_name || '';
      const displayName = activity.metadata?.displayName || 
                         activity.metadata?.user?.displayName || '';
      
      return (
        username.toLowerCase().includes(filterLower) ||
        fullName.toLowerCase().includes(filterLower) ||
        displayName.toLowerCase().includes(filterLower)
      );
    });
    
    // If user filter is active, skip the "Show my activity" filter
    // because the user is intentionally searching for specific activities
    console.log(`[StreamPage] Skipping showMyActivity filter due to active user filter`);
  } else {
    // Apply showMyActivity filter if disabled and user is authenticated
    // Use the tab-specific showMyActivity state (inverted logic from hideMyActions)
    if (!showMyActivity[activeTab] && currentUser) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.userId !== currentUser.id
      );
    }
  }
  
  const isLoading = activeTab === 'global' ? globalLoading : 
                   activeTab === 'personal' ? personalLoading :
                   activeTab === 'last-actions' ? lastActionsLoading :
                   shelfLoading;

  // Page Visibility API: Refetch data when user returns to the browser tab
  // This ensures the stream is up-to-date after switching tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        
        
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
  
  // Refetch last actions when switching to that tab
  // This ensures fresh data after navigating away and back
  useEffect(() => {
    if (activeTab === 'last-actions') {
      
      refetchLastActions();
    }
  }, [activeTab, refetchLastActions]);

  // WebSocket connection and event handlers
  useEffect(() => {
    
    const socket = getSocket();
    if (!socket) {
      console.warn('[STREAM PAGE] No socket available - will retry shortly');
      // Socket may not be initialized yet, will be available on next render
      return;
    }

    
    
    socketRef.current = socket;

    // Store the current tab value for cleanup
    const currentTab = activeTab;
    const wasAuthenticated = isAuthenticated;

    // Function to join rooms
    const joinRooms = () => {
      // ALWAYS join global room - we need to receive all global activities
      // regardless of which tab is active
      socket.emit('join:stream:global');
      
      // ALWAYS join last-actions room - we need to receive all last actions
      socket.emit('join:stream:last-actions');
      
      // Join tab-specific rooms based on active tab
      if (activeTab === 'personal' && isAuthenticated) {
        
        socket.emit('join:stream:personal');
      } else if (activeTab === 'shelves' && isAuthenticated) {
        
        socket.emit('join:stream:shelves');
      }
    };

    // Join rooms immediately if already connected
    if (socket.connected) {
      joinRooms();
    } else {
      // If not connected yet, wait for connection
      
    }

    // Also join when connection is established (in case of reconnection or delayed connection)
    const handleConnect = () => {
      
      joinRooms();
    };
    socket.on('connect', handleConnect);

    // Listen for new activities
    const handleNewActivity = (activity: Activity) => {
      console.log('[StreamPage] handleNewActivity:', activity.id, 'type:', activity.type, 'parentCommentId:', activity.metadata?.parentCommentId);
      if (activity.type === 'comment') {
        
        
      }
      
      // Check if this is a reply (has parentCommentId)
      const isReply = activity.metadata?.parentCommentId;
      
      console.log('[StreamPage] isReply:', isReply, 'activity type:', activity.type);
      
      if (activity.type === 'comment' && isReply) {
        // This is a reply - need to add it to the parent comment and move parent up
        const parentCommentId = activity.metadata.parentCommentId;
        
        console.log('[StreamPage] Processing reply, parentCommentId:', parentCommentId);
        console.log('[StreamPage] Activity entityId:', activity.entityId);
        
        // Update global stream: find parent and add reply to it
        // Parent is found by entityId (comment ID) matching parentCommentId
        queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
          console.log('[StreamPage] Looking for parent:', parentCommentId);
          console.log('[StreamPage] Current stream activities details:', oldData.map(a => ({id: a.id, entityId: a.entityId, type: a.type, hasReplies: !!a.metadata?.replies?.length})));
          console.log('[StreamPage] Current stream activities:', oldData.map(a => ({id: a.id, entityId: a.entityId, type: a.type})));
          
          // Helper function to find and update nested reply recursively
          const findAndUpdateNestedReply = (
            activities: Activity[],
            targetId: string,
            newReply: Activity
          ): { found: boolean; updated: Activity[] } => {
            for (let i = 0; i < activities.length; i++) {
              const activity = activities[i];
              
              // Check if this activity is the parent - STRICT check with entityId first
              const parentEntityId = activity.entityId || activity.id;
              const isExactMatch = parentEntityId === targetId;
              
              if (activity.type === 'comment' && isExactMatch) {
                console.log('[StreamPage] Found EXACT parent match:', parentEntityId, '===', targetId);
                const parentReplies = activity.metadata?.replies || [];
                console.log('[StreamPage] Adding reply to parent, reply content:', (newReply as any).content || (newReply as any).metadata?.content, 'author:', newReply.metadata?.author_name);
                
                // Check if reply already exists in this activity's replies (top-level)
                if (parentReplies.some((r: any) => r.id === newReply.id)) {
                  console.log('[StreamPage] Reply already exists in parent, skipping');
                  return { found: true, updated: activities };
                }
                
                // Also check nested replies for duplicates
                const hasNestedDuplicate = (replies: any[]): boolean => {
                  for (const r of replies) {
                    if (r.id === newReply.id) return true;
                    if (r.replies && r.replies.length > 0 && hasNestedDuplicate(r.replies)) return true;
                  }
                  return false;
                };
                if (hasNestedDuplicate(parentReplies)) {
                  console.log('[StreamPage] Reply already exists in nested replies, skipping');
                  return { found: true, updated: activities };
                }
                
                const updatedActivity: Activity = {
                  ...activity,
                  // Add top-level replies for ActivityCard rendering - use UPDATED parentReplies
                  // Also update parent's replyCount for nested rendering
                  replyCount: (activity.metadata?.reply_count || 0) + 1,
                  replies: [...parentReplies, {
                    ...newReply,
                    // Flatten content and metadata fields to top level for display
                    content: (newReply as any).content || (newReply as any).metadata?.content || (newReply as any).metadata?.content_preview,
                    author_name: newReply.metadata?.author_name,
                    username: newReply.metadata?.username,
                    author: newReply.metadata?.author_name || newReply.metadata?.username,
                    avatarUrl: newReply.metadata?.author_avatar,
                    author_avatar: newReply.metadata?.author_avatar,
                    // Add top-level replies for nested rendering
                    replies: (newReply as any).metadata?.replies || [],
                    replyCount: (newReply as any).metadata?.reply_count || 0
                  }],
                  metadata: {
                    ...activity.metadata,
                    replies: [...parentReplies, {
                      ...newReply,
                      // Flatten content and metadata fields to top level for display
                      content: (newReply as any).content || (newReply as any).metadata?.content || (newReply as any).metadata?.content_preview,
                      author_name: newReply.metadata?.author_name,
                      username: newReply.metadata?.username,
                      author: newReply.metadata?.author_name || newReply.metadata?.username,
                      avatarUrl: newReply.metadata?.author_avatar,
                      author_avatar: newReply.metadata?.author_avatar,
                      // Add top-level replies for nested rendering
                      replies: (newReply as any).metadata?.replies || [],
                      replyCount: (newReply as any).metadata?.reply_count || 0
                    }],
                    reply_count: (activity.metadata?.reply_count || 0) + 1
                  }
                } as Activity;
                
                return {
                  found: true,
                  updated: [
                    ...activities.slice(0, i),
                    updatedActivity,
                    ...activities.slice(i + 1)
                  ]
                };
              }
              
              // Check nested replies
              if (activity.metadata?.replies && activity.metadata.replies.length > 0) {
                console.log('[StreamPage] Checking nested replies for activity:', activity.entityId, 'replies count:', activity.metadata.replies.length);
                // Log all nested reply IDs for debugging
                activity.metadata.replies.forEach((r: any, idx: number) => {
                  console.log('[StreamPage] Nested reply', idx, 'id:', r.id, 'entityId:', r.entityId);
                });
                const result = findAndUpdateNestedReply(
                  activity.metadata.replies,
                  targetId,
                  newReply
                );
                
                if (result.found) {
                  // Return updated parent with updated nested replies
                  // IMPORTANT: Also update top-level replies for ActivityCard rendering
                  return {
                    found: true,
                    updated: [
                      ...activities.slice(0, i),
                      {
                        ...activity,
                        // Also update top-level replies
                        replies: result.updated,
                        metadata: {
                          ...activity.metadata,
                          replies: result.updated
                        }
                      } as Activity,
                      ...activities.slice(i + 1)
                    ]
                  };
                }
              }
            }
            
            return { found: false, updated: activities };
          };
          
          // Try to find and update parent in nested replies
          const result = findAndUpdateNestedReply(oldData, parentCommentId, activity);
          
          if (result.found) {
            console.log('[StreamPage] Found parent in nested replies');
            return result.updated;
          } else {
            console.log('[StreamPage] Parent NOT found anywhere for:', parentCommentId);
          }
          
          // Fallback: check root level
          const parentIndex = oldData.findIndex(a => 
            a.type === 'comment' && (a.entityId === parentCommentId || a.id === parentCommentId)
          );
          console.log('[StreamPage] Parent index:', parentIndex);
          
          if (parentIndex !== -1) {
            const parent = oldData[parentIndex];
            console.log('[StreamPage] Found parent, current replies:', parent.metadata?.replies?.length || 0);
            const parentReplies = parent.metadata?.replies || [];
            
            if (parentReplies.some((r: any) => r.id === activity.id)) {
              return oldData;
            }
            
            const updatedParent = {
              ...parent,
              // Add top-level replies for ActivityCard rendering - use UPDATED array
              // Also update parent's replyCount for nested rendering
              replyCount: (parent.metadata?.reply_count || 0) + 1,
              replies: [...parentReplies, {
                ...activity,
                // Flatten content and metadata fields to top level for display
                content: (activity as any).content || (activity as any).metadata?.content || (activity as any).metadata?.content_preview,
                author_name: activity.metadata?.author_name,
                username: activity.metadata?.username,
                author: activity.metadata?.author_name || activity.metadata?.username,
                avatarUrl: activity.metadata?.author_avatar,
                author_avatar: activity.metadata?.author_avatar,
                // Add top-level replies for nested rendering
                replies: (activity as any).metadata?.replies || [],
                replyCount: (activity as any).metadata?.reply_count || 0
              }],
              metadata: {
                ...parent.metadata,
                reply_count: (parent.metadata?.reply_count || 0) + 1,
                replies: [...parentReplies, {
                  ...activity,
                  // Flatten content and metadata fields to top level for display
                  content: (activity as any).content || (activity as any).metadata?.content || (activity as any).metadata?.content_preview,
                  author_name: activity.metadata?.author_name,
                  username: activity.metadata?.username,
                  author: activity.metadata?.author_name || activity.metadata?.username,
                  avatarUrl: activity.metadata?.author_avatar,
                  author_avatar: activity.metadata?.author_avatar,
                  // Add top-level replies for nested rendering
                  replies: (activity as any).metadata?.replies || [],
                  replyCount: (activity as any).metadata?.reply_count || 0
                }],
              }
            };
            
            const newData = oldData.filter((_, i) => i !== parentIndex);
            return [updatedParent, ...newData];
          } else {
            console.log('[StreamPage] Parent not found in stream, skipping this reply for now');
            // Don't add as root - wait for parent to appear first
            return oldData;
          }
        });
        
        return;
      }
      
      // Update the appropriate query cache based on active tab
      // Global stream - always update
      console.log('[StreamPage] Adding as root comment, checking duplicates');
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
        // Check if activity already exists to avoid duplicates
        if (oldData.some(a => a.id === activity.id)) {
          console.log('[StreamPage] Root comment already exists, skipping:', activity.id);
          return oldData;
        }
        console.log('[StreamPage] Adding new root comment to stream:', activity.id);
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
      
      // Force re-render to ensure nested replies are properly displayed
      setForceUpdate(n => n + 1);
    };

    const handleActivityUpdated = (data: { entityId: string; metadata: any }) => {
      
      // Update the activity in the query cache
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'global'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'stream', 'shelves'] });
    };

    const handleActivityDeleted = (data: { id: string }) => {
      
      
      // Remove the activity from all query caches
      // Use the activity ID to filter out the deleted activity
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
        return oldData.filter(a => a.id !== data.id);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (oldData = []) => {
        return oldData.filter(a => a.id !== data.id);
      });
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], (oldData = []) => {
        return oldData.filter(a => a.id !== data.id);
      });
      
      // Also remove from last-actions cache
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          activities: (oldData.activities || []).filter((a: any) => a.id !== data.id)
        };
      });
    };

    // Handler for comment reaction updates (including nested replies in /stream)
    const handleCommentReactionUpdate = (data: { commentId: string; reactions: any[]; action: string }) => {
      console.log('[STREAM PAGE] Received comment-reaction-updated:', data);
      
      // Update the global stream cache
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], (oldData = []) => {
        return oldData.map(activity => {
          // Check if this activity has the comment
          if (activity.entityId === data.commentId) {
            return {
              ...activity,
              metadata: {
                ...activity.metadata,
                reactions: data.reactions
              }
            };
          }
          
          // Also check if this is a comment activity with replies that include this comment
          if (activity.type === 'comment' && activity.metadata?.replies) {
            const updatedReplies = (activity.metadata.replies || []).map((reply: any) => {
              if (reply.id === data.commentId) {
                return { ...reply, reactions: data.reactions };
              }
              // Also check nested replies
              if (reply.replies) {
                return {
                  ...reply,
                  replies: (reply.replies || []).map((nestedReply: any) => {
                    if (nestedReply.id === data.commentId) {
                      return { ...nestedReply, reactions: data.reactions };
                    }
                    return nestedReply;
                  })
                };
              }
              return reply;
            });
            return { ...activity, metadata: { ...activity.metadata, replies: updatedReplies } };
          }
          
          return activity;
        });
      });
      
      // Also update personal stream cache
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], (oldData = []) => {
        return oldData.map(activity => {
          if (activity.entityId === data.commentId) {
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
      });
    };

    const handleReactionUpdate = (data: { commentId: string; entityId: string; entityType: string; reactions: any[]; action: string }) => {
      
      
      // Update activities in all caches to update reactions
      const updateActivities = (oldData: Activity[] = []) => {
        return oldData.map(activity => {
          // Match by entityId and entityType
          // For comments: match by entityId (comment ID)
          // For reviews: match by entityId (review ID)  
          // For news: match by entityId (news ID) and type 'news'
          // For books: match by entityId or bookId and type 'book'
          const isMatch = 
            (data.entityType === 'comment' && (activity.entityId === data.entityId || activity.id === data.commentId)) ||
            (data.entityType === 'review' && activity.entityId === data.entityId) ||
            (data.entityType === 'news' && activity.entityId === data.entityId && activity.type === 'news') ||
            (data.entityType === 'book' && (activity.entityId === data.entityId || activity.bookId === data.entityId) && activity.type === 'book');
            
          if (isMatch) {
            
            return {
              ...activity,
              metadata: {
                ...activity.metadata,
                reactions: data.reactions,
                reaction_count: data.reactions.reduce((sum: number, r: any) => sum + r.count, 0)
              }
            };
          }
          return activity;
        });
      };
      
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'global'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'personal'], updateActivities);
      queryClient.setQueryData<Activity[]>(['api', 'stream', 'shelves', filters], updateActivities);
      
      // Update Last Actions cache for reaction changes
      queryClient.setQueryData<any>(['api', 'stream', 'last-actions'], (oldData: any) => {
        if (!oldData || !oldData.activities) {
          return oldData;
        }
        
        return {
          ...oldData,
          activities: oldData.activities.map((activity: any) => {
            // Match by entityId and entityType
            const isMatch = 
              (data.entityType === 'comment' && (activity.entityId === data.entityId || activity.id === data.commentId)) ||
              (data.entityType === 'review' && activity.entityId === data.entityId) ||
              (data.entityType === 'news' && activity.entityId === data.entityId && activity.type === 'news') ||
              (data.entityType === 'book' && (activity.entityId === data.entityId || activity.bookId === data.entityId) && activity.type === 'book');
            
            if (isMatch) {
              
              return {
                ...activity,
                metadata: {
                  ...activity.metadata,
                  reactions: data.reactions,
                  reaction_count: data.reactions.reduce((sum: number, r: any) => sum + r.count, 0)
                }
              };
            }
            return activity;
          })
        };
      });
    };

    const handleCounterUpdate = (data: { entityId: string; entityType: string; commentCount?: number; reactionCount?: number; viewCount?: number; reviewCount?: number }) => {
      
      
      // Update counters for news and book activities
      const updateActivities = (oldData: Activity[] = []) => {
        return oldData.map(activity => {
          // Match by entityId (news ID or book ID) and type
          if ((activity.entityId === data.entityId || activity.newsId === data.entityId || activity.bookId === data.entityId) &&
              (activity.type === data.entityType)) {
            
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
      

    };

    socket.on('stream:new-activity', handleNewActivity);
    socket.on('stream:activity-updated', handleActivityUpdated);
    socket.on('stream:activity-deleted', handleActivityDeleted);
    socket.on('stream:reaction-update', handleReactionUpdate);
    socket.on('stream:counter-update', handleCounterUpdate);
    socket.on('stream:last-action', handleLastAction);
    socket.on('comment-reaction-updated', handleCommentReactionUpdate);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('stream:new-activity', handleNewActivity);
      socket.off('stream:activity-updated', handleActivityUpdated);
      socket.off('stream:activity-deleted', handleActivityDeleted);
      socket.off('stream:reaction-update', handleReactionUpdate);
      socket.off('stream:counter-update', handleCounterUpdate);
      socket.off('stream:last-action', handleLastAction);
      socket.off('comment-reaction-updated', handleCommentReactionUpdate);
      
      // Leave tab-specific rooms only - NEVER leave global room or last-actions room
      // Global room and last-actions room should stay active to receive updates even when on other tabs
      
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
  
  // Handle activity type filter change
  const handleActivityTypeFilterChange = useCallback((selectedTypes: ActivityType[]) => {
    setActivityTypeFilters(prev => ({
      ...prev,
      [activeTab]: selectedTypes
    }));
  }, [activeTab]);
  
  // Handle user filter change
  const handleUserFilterChange = useCallback((filter: string) => {
    // Debug logging
    console.log(`[StreamPage] User filter changed: '${filter}'`);
    console.log(`[StreamPage] Active tab: ${activeTab}`);
    
    setUserFilters(prev => ({
      ...prev,
      [activeTab]: filter
    }));
  }, [activeTab]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold mb-2">{t('stream:title')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-col gap-2 sm:grid sm:grid-cols-4 w-full mb-6 h-auto sm:h-9 bg-transparent sm:bg-muted p-0 sm:p-1">
          <TabsTrigger value="global">
            <Globe className="w-4 h-4 mr-2" />
            {t('stream:globalTab')}
          </TabsTrigger>
          <TabsTrigger value="shelves" disabled={!isAuthenticated}>
            <Library className="w-4 h-4 mr-2" />
            {t('stream:myShelvesTab')}
          </TabsTrigger>
          <TabsTrigger value="personal" disabled={!isAuthenticated}>
            <User className="w-4 h-4 mr-2" />
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
            {/* Activity Type Filter */}
            <ActivityTypeFilter
              availableTypes={['news', 'book', 'comment', 'review']}
              selectedTypes={activityTypeFilters.global}
              onFilterChange={handleActivityTypeFilterChange}
              showHideMyActions={isAuthenticated}
              hideMyActions={showMyActivity.global}
              onHideMyActionsChange={(show) => setShowMyActivity(prev => ({ ...prev, global: show }))}
              isOpen={filterPanelOpen}
              onOpenChange={setFilterPanelOpen}
              userFilter={userFilters.global}
              onUserFilterChange={handleUserFilterChange}
              showUserFilter={true}
            />
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('stream:loading')}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {currentActivities.length === 0 
                  ? t('stream:noActivities')
                  : t('stream:activityTypeFilter.noResults')
                }
              </div>
            ) : (
              filteredActivities.map((activity: any) => (
                <ActivityCard 
                  key={activity.id} 
                  activity={activity}
                />
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
              {/* Combined Filters: Activity Types + Shelf and Book Filters */}
              <ShelfFilters 
                filters={filters} 
                onFilterChange={handleFilterChange}
                activityTypeFilters={activityTypeFilters.shelves.filter(t => t !== 'user_action') as ('news' | 'book' | 'comment' | 'review')[]}
                onActivityTypeFilterChange={(types) => {
                  setActivityTypeFilters(prev => ({
                    ...prev,
                    shelves: types
                  }));
                }}
                showHideMyActions={true}
                hideMyActions={showMyActivity.shelves}
                onHideMyActionsChange={(show) => setShowMyActivity(prev => ({ ...prev, shelves: show }))}
                isOpen={filterPanelOpen}
                onOpenChange={setFilterPanelOpen}
              />
              
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('stream:loading')}
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {currentActivities.length === 0 
                      ? t('stream:noActivities')
                      : t('stream:activityTypeFilter.noResults')
                    }
                  </div>
                ) : (
                  filteredActivities.map((activity: any) => (
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
              {/* Activity Type Filter */}
              <ActivityTypeFilter
                availableTypes={['news', 'book', 'comment', 'review']}
                selectedTypes={activityTypeFilters.personal}
                onFilterChange={handleActivityTypeFilterChange}
                showHideMyActions={false}
                isOpen={filterPanelOpen}
                onOpenChange={setFilterPanelOpen}
              />
              
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('stream:loading')}
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {currentActivities.length === 0 
                    ? t('stream:noActivities')
                    : t('stream:activityTypeFilter.noResults')
                  }
                </div>
              ) : (
                filteredActivities.map((activity: any) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              )}
            </div>
          )}
        </TabsContent>
        
        {/* Last Actions Tab */}
        <TabsContent value="last-actions" className="mt-0">
          <div className="space-y-4">
            {/* Activity Type Filter */}
            <ActivityTypeFilter
              availableTypes={['news', 'book', 'comment', 'review', 'user_action']}
              selectedTypes={activityTypeFilters['last-actions']}
              onFilterChange={handleActivityTypeFilterChange}
              showHideMyActions={isAuthenticated}
              hideMyActions={showMyActivity['last-actions']}
              onHideMyActionsChange={(show) => setShowMyActivity(prev => ({ ...prev, 'last-actions': show }))}
              isOpen={filterPanelOpen}
              onOpenChange={setFilterPanelOpen}
              showNotificationToggle={true}
              userFilter={userFilters['last-actions']}
              onUserFilterChange={handleUserFilterChange}
              showUserFilter={true}
            />
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('stream:loading')}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {currentActivities.length === 0 
                    ? t('stream:noLastActions')
                    : currentUserFilter
                      ? t('stream:userFilter.noResults', { username: currentUserFilter })
                      : t('stream:activityTypeFilter.noResults')
                  }
                </p>
                {currentActivities.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('stream:noLastActionsSubtext')}
                  </p>
                )}
                {currentUserFilter && currentActivities.length > 0 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('stream:userFilter.tryDifferentName')}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        // Clear the user filter
                        setUserFilters(prev => ({ ...prev, [activeTab]: '' }));
                      }}
                      className="mt-2"
                    >
                      {t('stream:userFilter.clearFilter')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredActivities.map((action: any) => {
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
