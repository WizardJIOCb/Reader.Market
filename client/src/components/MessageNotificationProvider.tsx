import React, { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { onSocketEvent, getSocket } from '@/lib/socket';
import { MessageCircle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserNameWithRating } from './UserNameWithRating';

interface MessageNotificationProviderProps {
  children: React.ReactNode;
  currentUserId?: string;
}

export function MessageNotificationProvider({ 
  children, 
  currentUserId 
}: MessageNotificationProviderProps) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { t } = useTranslation(['common']);
  
  // Store groups and channels for lookup
  const groupsRef = useRef<any[]>([]);
  const channelsRef = useRef<any[]>([]);
  const listenersRegisteredRef = useRef(false);
  const currentGroupRef = useRef<string | null>(null);
  const currentChannelRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('%c[MESSAGE NOTIFICATION] Provider useEffect triggered', 'color: green; font-weight: bold');
    console.log('%c[MESSAGE NOTIFICATION] Current user ID:', 'color: green', currentUserId);
    console.log('%c[MESSAGE NOTIFICATION] Current user ID type:', 'color: green', typeof currentUserId);
    
    // Early return if no user ID
    if (!currentUserId) {
      console.log('%c[MESSAGE NOTIFICATION] ❌ No current user ID, exiting useEffect', 'color: red');
      return;
    }

    console.log('%c[MESSAGE NOTIFICATION] ✅ User authenticated, setting up listeners', 'color: green');
    
    // Check if we're currently on the messages page
    console.log('%c[MESSAGE NOTIFICATION] Location data:', 'color: green', location);
    console.log('%c[MESSAGE NOTIFICATION] Location type:', 'color: green', typeof location);
    const currentPath = typeof location === 'string' ? location : location[0];
    const isOnMessagesPage = currentPath === '/messages';
    console.log('%c[MESSAGE NOTIFICATION] Current path:', 'color: green', currentPath);
    console.log('%c[MESSAGE NOTIFICATION] isOnMessagesPage:', 'color: green', isOnMessagesPage);
    
    // Verify socket is connected
    const socket = getSocket();
    console.log('%c[MESSAGE NOTIFICATION] Socket status:', 'color: green', {
      socketExists: !!socket,
      connected: socket?.connected,
      id: socket?.id
    });
    
    let cleanupFunction: (() => void) | null | undefined = null;
    
    // If socket doesn't exist yet, wait for it
    if (!socket) {
      console.log('%c[MESSAGE NOTIFICATION] ⏳ Socket not available yet, waiting for initialization...', 'color: orange');
      const checkSocketInterval = setInterval(() => {
        const newSocket = getSocket();
        console.log('%c[MESSAGE NOTIFICATION] Checking for socket... Found:', 'color: orange', !!newSocket);
        if (newSocket) {
          console.log('%c[MESSAGE NOTIFICATION] ✅ Socket initialized, proceeding with setup', 'color: green');
          clearInterval(checkSocketInterval);
          cleanupFunction = setupListeners(newSocket);
        }
      }, 500);
      
      // DON'T cleanup interval - let it persist
      // return () => {
      //   console.log('%c[MESSAGE NOTIFICATION] 🧹 useEffect cleanup called - clearing interval only', 'color: yellow; font-weight: bold');
      //   clearInterval(checkSocketInterval);
      // };
    }
    
    // Listen for route changes to reset group when leaving messages page
    const handleRouteChange = () => {
      const currentPath = typeof location === 'string' ? location : location[0];
      if (currentPath !== '/messages' && currentGroupRef.current !== null) {
        console.log('%c[MESSAGE NOTIFICATION] 🔄 Route changed, resetting group ref', 'color: orange');
        currentGroupRef.current = null;
        currentChannelRef.current = null;
      }
    };
    
    // Check route on mount
    handleRouteChange();
    
    // Listen for location changes
    const locationInterval = setInterval(handleRouteChange, 1000);
    
    // Listen for current group/channel updates from Messages component
    const handleCurrentGroupUpdate = (event: CustomEvent) => {
      const { groupId, channelId } = event.detail;
      currentGroupRef.current = groupId;
      currentChannelRef.current = channelId;
      console.log('%c[MESSAGE NOTIFICATION] 🔁 Current group/channel updated:', 'color: cyan');
      console.log('%c[MESSAGE NOTIFICATION]   Group ID:', 'color: cyan', groupId);
      console.log('%c[MESSAGE NOTIFICATION]   Channel ID:', 'color: cyan', channelId);
      console.log('%c[MESSAGE NOTIFICATION]   Stored group ref:', 'color: cyan', currentGroupRef.current);
    };
    
    window.addEventListener('current-group-update', handleCurrentGroupUpdate as EventListener);
    
    // Log initial state
    console.log('%c[MESSAGE NOTIFICATION] 🔍 Initial group ref state:', 'color: purple');
    console.log('%c[MESSAGE NOTIFICATION]   Current group:', 'color: purple', currentGroupRef.current);
    console.log('%c[MESSAGE NOTIFICATION]   Current channel:', 'color: purple', currentChannelRef.current);
    
    // Socket exists, proceed with setup
    cleanupFunction = setupListeners(socket);
    
    function setupListeners(sock: any) {
      console.log('%c[MESSAGE NOTIFICATION] setupListeners called with socket:', 'color: magenta', sock?.id);
      
      // Skip if listeners already registered
      if (listenersRegisteredRef.current) {
        console.log('%c[MESSAGE NOTIFICATION] ⚠️ Listeners already registered, skipping', 'color: orange');
        return () => {}; // Return empty cleanup
      }
      
      console.log('%c[MESSAGE NOTIFICATION] ✅ Registering listeners for the first time', 'color: green');
      listenersRegisteredRef.current = true;
      // Fetch user's groups and join channel rooms
      const joinGroupChannels = async () => {
        try {
          console.log('%c[MESSAGE NOTIFICATION] Fetching user groups...', 'color: blue');
          const response = await fetch('/api/groups', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (response.ok) {
            const groups = await response.json();
            console.log('%c[MESSAGE NOTIFICATION] User groups:', 'color: blue', groups);
            
            // Store groups for lookup
            groupsRef.current = groups;
            
            // For each group, fetch channels and join rooms
            for (const group of groups) {
              try {
                const channelsResponse = await fetch(`/api/groups/${group.id}/channels`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                  }
                });
                
                if (channelsResponse.ok) {
                  const channels = await channelsResponse.json();
                  console.log(`%c[MESSAGE NOTIFICATION] Channels for group ${group.name}:`, 'color: blue', channels);
                  
                  // Store channels for lookup
                  channelsRef.current = [...channelsRef.current, ...channels];
                  
                  // Join each channel room
                  channels.forEach((channel: any) => {
                    if (sock) {
                      sock.emit('join:channel', channel.id);
                      console.log('%c[MESSAGE NOTIFICATION] 🚪 Sent join:channel for:', 'color: cyan', channel.id);
                      
                      // Also join group room
                      sock.emit('join_room', `group_${group.id}`);
                      console.log('%c[MESSAGE NOTIFICATION] 🚪 Sent join_room for group:', 'color: cyan', `group_${group.id}`);
                      
                      // Check current rooms after delay
                      setTimeout(() => {
                        sock.emit('get_rooms', (rooms: string[]) => {
                          console.log('%c[MESSAGE NOTIFICATION] 🏠 Current socket rooms:', 'color: purple', rooms);
                          console.log('%c[MESSAGE NOTIFICATION] 🏠 Looking for:', 'color: purple', [`channel_${channel.id}`, `group_${group.id}`]);
                        });
                      }, 1000);
                    }
                  });
                }
              } catch (channelError) {
                console.error(`%c[MESSAGE NOTIFICATION] Error fetching channels for group ${group.id}:`, 'color: red', channelError);
              }
            }
          }
        } catch (error) {
          console.error('%c[MESSAGE NOTIFICATION] Error fetching groups:', 'color: red', error);
        }
      };
      
      // Join channel rooms
      if (sock?.connected) {
        joinGroupChannels();
      } else {
        // Wait for connection
        sock?.once('connect', joinGroupChannels);
      }

      // Listen for new private messages
      const cleanupPrivateMessage = onSocketEvent('message:new', (data) => {
        console.log('%c[MESSAGE NOTIFICATION] 📩 New private message event received:', 'color: purple; font-weight: bold');
        console.log('%c[MESSAGE NOTIFICATION] Event data:', 'color: purple', JSON.stringify(data, null, 2));
        
        // Don't show notification for messages sent by current user
        if (data.message?.senderId === currentUserId) {
          console.log('%c[MESSAGE NOTIFICATION] 🚫 Message from self, ignoring', 'color: orange');
          return;
        }

        const senderName = data.message?.senderFullName || 
                          data.message?.senderUsername ||
                          data.message?.sender?.fullName || 
                          data.message?.sender?.username || 
                          'Unknown user';
        
        const messagePreview = data.message?.content?.substring(0, 50) || 'New message';
        
        console.log('%c[MESSAGE NOTIFICATION] ✅ Showing notification for message from:', 'color: green', senderName);
        
        // Don't show notification if user is on messages page AND in the same conversation
        if (isOnMessagesPage) {
          console.log('%c[MESSAGE NOTIFICATION] 🚫 User is on messages page, checking if in same conversation...', 'color: orange');
          // We'll implement conversation-specific check later
          // For now, show notification if not in the exact same conversation
          console.log('%c[MESSAGE NOTIFICATION] ✅ Showing notification - not in same conversation', 'color: green');
          // return; // Don't skip for now
        }
        
        const notification = toast({
          title: (
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>{t('notifications.newMessage')}</span>
            </div>
          ),
          description: (
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {data.message?.senderAvatarUrl || data.message?.sender?.avatarUrl ? (
                  <img 
                    src={data.message.senderAvatarUrl || data.message.sender.avatarUrl} 
                    alt={senderName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {senderName.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <UserNameWithRating
                    userId={data.message?.sender?.id || ''}
                    username={data.message?.senderUsername || data.message?.sender?.username || ''}
                    fullName={data.message?.senderFullName || data.message?.sender?.fullName || ''}
                    profileRating={data.message?.senderRating ? parseFloat(data.message.senderRating) : (data.message?.sender?.rating || null)}
                    showRating={true}
                    className="mb-1"
                  />
                  <p className="text-sm text-muted-foreground">{messagePreview}{data.message?.content?.length > 50 ? '...' : ''}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('%c[MESSAGE NOTIFICATION] 📍 Navigating to messages for conversation:', 'color: blue', data.conversationId);
                  
                  // Close the notification
                  if (notification?.dismiss) {
                    notification.dismiss();
                    console.log('%c[MESSAGE NOTIFICATION] ✅ Notification dismissed', 'color: green');
                  }
                  
                  // Navigate to messages page
                  setLocation('/messages');
                  
                  // Dispatch focus event with delay
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('focus-conversation', { 
                      detail: { conversationId: data.conversationId } 
                    }));
                  }, 500);
                }}
                className="text-xs text-primary hover:underline mt-1 self-start"
              >
                {t('actions.openChat')}
              </button>
            </div>
          ),
          duration: 8000,
        });
      });

      // Listen for new group messages
      const cleanupGroupMessage = onSocketEvent('channel:message:new', (data) => {
        console.log('%c[MESSAGE NOTIFICATION] 📢 New group message event received:', 'color: blue; font-weight: bold');
        console.log('%c[MESSAGE NOTIFICATION] Event data:', 'color: blue', JSON.stringify(data, null, 2));
        console.log('%c[MESSAGE NOTIFICATION] Current user ID:', 'color: blue', currentUserId);
        console.log('%c[MESSAGE NOTIFICATION] Message sender ID:', 'color: blue', data.message?.senderId);
        
        // Don't show notification for messages sent by current user
        if (data.message?.senderId === currentUserId) {
          console.log('%c[MESSAGE NOTIFICATION] 🚫 Group message from self, ignoring', 'color: orange');
          return;
        }

        const senderName = data.message?.senderFullName || 
                          data.message?.senderUsername ||
                          data.message?.sender?.fullName || 
                          data.message?.sender?.username || 
                          'Unknown user';
        
        // Find group and channel names
        const channel = channelsRef.current.find(c => c.id === data.channelId);
        const group = groupsRef.current.find(g => g.id === data.groupId);
        
        const groupName = group?.name || 'Group';
        const channelName = channel?.name || '';
        const fullGroupName = channelName ? `${groupName} #${channelName}` : groupName;
        
        const messagePreview = data.message?.content?.substring(0, 50) || 'New message';
        
        console.log('%c[MESSAGE NOTIFICATION] ✅ Showing notification for group message from:', 'color: green', `${senderName} in ${groupName}`);
        
        // Don't show notification if user is on messages page AND in the same group/channel
        if (isOnMessagesPage) {
          const currentGroupId = currentGroupRef.current;
          const messageGroupId = data.groupId;
          const isInSameGroup = currentGroupId === messageGroupId;
          
          console.log('%c[MESSAGE NOTIFICATION] 🚫 User is on messages page', 'color: orange');
          console.log('%c[MESSAGE NOTIFICATION] Current group ID:', 'color: orange', currentGroupId);
          console.log('%c[MESSAGE NOTIFICATION] Message group ID:', 'color: orange', messageGroupId);
          console.log('%c[MESSAGE NOTIFICATION] Is same group:', 'color: orange', isInSameGroup);
          console.log('%c[MESSAGE NOTIFICATION] Current group ref value:', 'color: orange', currentGroupRef.current);
          console.log('%c[MESSAGE NOTIFICATION] Current group ref type:', 'color: orange', typeof currentGroupRef.current);
          
          if (isInSameGroup && currentGroupId !== null) {
            console.log('%c[MESSAGE NOTIFICATION] 🚫 User is in same group, skipping notification', 'color: orange');
            return;
          } else {
            console.log('%c[MESSAGE NOTIFICATION] ✅ Showing notification - different group or no current group', 'color: green');
          }
        } else {
          console.log('%c[MESSAGE NOTIFICATION] ✅ Not on messages page, showing notification', 'color: green');
        }
        
        console.log('%c[MESSAGE NOTIFICATION] 🎉 About to show toast notification', 'color: magenta; font-weight: bold');
        
        // Test with simple toast first
        // const groupNotification = toast({
        //   title: `New message in ${fullGroupName}`,
        //   description: `${senderName}: ${messagePreview}`,
        //   duration: 8000,
        // });
        
        // Restore full notification with avatar and rating
        const groupNotification = toast({
          title: (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{t('notifications.newMessageIn')} {fullGroupName}</span>
            </div>
          ),
          description: (
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {data.message?.senderAvatarUrl || data.message?.sender?.avatarUrl ? (
                  <img 
                    src={data.message.senderAvatarUrl || data.message.sender.avatarUrl} 
                    alt={senderName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {senderName.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <UserNameWithRating
                    userId={data.message?.sender?.id || ''}
                    username={data.message?.senderUsername || data.message?.sender?.username || ''}
                    fullName={data.message?.senderFullName || data.message?.sender?.fullName || ''}
                    profileRating={data.message?.senderRating ? parseFloat(data.message.senderRating) : (data.message?.sender?.rating || null)}
                    showRating={true}
                    className="mb-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{fullGroupName}</p>
                  <p className="text-sm text-muted-foreground mt-1">{messagePreview}{data.message?.content?.length > 50 ? '...' : ''}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('%c[MESSAGE NOTIFICATION] 📍 Navigating to messages for group:', 'color: blue', { groupId: data.groupId, channelId: data.channelId });
                  
                  // Close the notification
                  if (groupNotification?.dismiss) {
                    groupNotification.dismiss();
                    console.log('%c[MESSAGE NOTIFICATION] ✅ Group notification dismissed', 'color: green');
                  }
                  
                  setLocation('/messages');
                  
                  // Wait for Messages component to mount and load data
                  setTimeout(() => {
                    console.log('%c[MESSAGE NOTIFICATION] 📤 Dispatching focus-group event', 'color: blue');
                    window.dispatchEvent(new CustomEvent('focus-group', { 
                      detail: { 
                        groupId: data.groupId,
                        channelId: data.channelId 
                      } 
                    }));
                  }, 1000); // Increased delay to ensure data is loaded
                }}
                className="text-xs text-primary hover:underline mt-1 self-start"
              >
                {t('actions.openGroupChat')}
              </button>
            </div>
          ),
          duration: 8000,
        });
        
        console.log('%c[MESSAGE NOTIFICATION] 🎉 Toast notification created:', 'color: magenta; font-weight: bold', groupNotification);
      });

      console.log('%c[MESSAGE NOTIFICATION] ✅ Event listeners registered', 'color: green');
      
      // DON'T return cleanup function - let listeners persist
      // return () => {
      //   console.log('%c[MESSAGE NOTIFICATION] 🧹 useEffect cleanup called - clearing interval only', 'color: yellow; font-weight: bold');
      //   clearInterval(checkSocketInterval);
      //   clearInterval(locationInterval);
      //   // DON'T call cleanupFunction - listeners should persist
      //   // if (cleanupFunction) cleanupFunction();
      //   
      //   // Cleanup event listener
      //   window.removeEventListener('current-group-update', handleCurrentGroupUpdate as EventListener);
      // };
    } // End of setupListeners function
    
  }, [currentUserId, toast, setLocation]); // Removed 'location' dependency

  return <>{children}</>;
}