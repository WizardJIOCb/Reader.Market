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
    
    
    
    
    // Early return if no user ID
    if (!currentUserId) {
      
      return;
    }

    
    
    // Check if we're currently on the messages page
    
    
    const currentPath = typeof location === 'string' ? location : location[0];
    const isOnMessagesPage = currentPath === '/messages';
    
    
    
    // Verify socket is connected
    const socket = getSocket();
    
    
    let cleanupFunction: (() => void) | null | undefined = null;
    
    // If socket doesn't exist yet, wait for it
    if (!socket) {
      
      const checkSocketInterval = setInterval(() => {
        const newSocket = getSocket();
        
        if (newSocket) {
          
          clearInterval(checkSocketInterval);
          cleanupFunction = setupListeners(newSocket);
        }
      }, 500);
      
      // DON'T cleanup interval - let it persist
      // return () => {
      //   
      //   clearInterval(checkSocketInterval);
      // };
    }
    
    // Listen for route changes to reset group when leaving messages page
    const handleRouteChange = () => {
      const currentPath = typeof location === 'string' ? location : location[0];
      if (currentPath !== '/messages' && currentGroupRef.current !== null) {
        
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
      
      
      
      
    };
    
    window.addEventListener('current-group-update', handleCurrentGroupUpdate as EventListener);
    
    // Log initial state
    
    
    
    
    // Socket exists, proceed with setup
    cleanupFunction = setupListeners(socket);
    
    function setupListeners(sock: any) {
      
      
      // Skip if listeners already registered
      if (listenersRegisteredRef.current) {
        
        return () => {}; // Return empty cleanup
      }
      
      
      listenersRegisteredRef.current = true;
      // Fetch user's groups and join channel rooms
      const joinGroupChannels = async () => {
        try {
          
          const response = await fetch('/api/groups', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (response.ok) {
            const groups = await response.json();
            
            
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
                  
                  
                  // Store channels for lookup
                  channelsRef.current = [...channelsRef.current, ...channels];
                  
                  // Join each channel room
                  channels.forEach((channel: any) => {
                    if (sock) {
                      sock.emit('join:channel', channel.id);
                      
                      
                      // Also join group room
                      sock.emit('join_room', `group_${group.id}`);
                      
                      
                      // Check current rooms after delay
                      setTimeout(() => {
                        sock.emit('get_rooms', (rooms: string[]) => {
                          
                          
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
        // Don't show notification for messages sent by current user
        // Handle both structures: direct message object or { message: messageObject, conversationId: string }
        const messageData = data.message || data; // Support both structures
        const senderId = messageData.sender?.id || data.message?.senderId;
        
        if (senderId === currentUserId) {          
          return;
        }

        // Don't show notification if user is on messages page AND in the same conversation with the sender
        const currentPath = typeof location === 'string' ? location : location[0];
        const isOnMessagesPage = currentPath === '/messages';
        
        // Check if currently chatting with the sender by checking global state
        const isCurrentlyChattingWithSender = (window as any).__CURRENT_SELECTED_CONVERSATION?.otherUser?.id === senderId;

        if (isOnMessagesPage && isCurrentlyChattingWithSender) {
          // Don't show notification - message will be visible in the chat
          console.log('Skipping notification - already chatting with sender:', senderId);
          
          // Dispatch event to mark message as read in Messages component
          window.dispatchEvent(new CustomEvent('auto-mark-read', {
            detail: {
              messageId: messageData.id,
              conversationId: messageData.conversationId,
              senderId: senderId
            }
          }));
          
          // Update unread count for this specific conversation only
          // We shouldn't update the global unread count here because it affects other conversations
          // Instead, let the Messages component handle updating the conversation list properly
          
          return;
        }

        const senderName = messageData.senderFullName || 
                          messageData.senderUsername ||
                          messageData.sender?.fullName || 
                          messageData.sender?.username || 
                          'Unknown user';
        
        const messagePreview = messageData.content?.substring(0, 50) || 'New message';
        
        
        // Don't show notification if user is on messages page AND in the same conversation
        if (isOnMessagesPage) {
          
          // We'll implement conversation-specific check later
          // For now, show notification if not in the exact same conversation
          
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
                {messageData.senderAvatarUrl || messageData.sender?.avatarUrl ? (
                  <img 
                    src={messageData.senderAvatarUrl || messageData.sender.avatarUrl} 
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
                    userId={messageData.sender?.id || ''}
                    username={messageData.senderUsername || messageData.sender?.username || ''}
                    fullName={messageData.senderFullName || messageData.sender?.fullName || ''}
                    profileRating={messageData.senderRating ? parseFloat(messageData.senderRating) : (messageData.sender?.rating || null)}
                    showRating={true}
                    className="mb-1"
                  />
                  <p className="text-sm text-muted-foreground">{messagePreview}{messageData.content?.length > 50 ? '...' : ''}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  
                  // Close the notification
                  if (notification?.dismiss) {
                    notification.dismiss();
                    
                  }
                  
                  // Navigate to messages page
                  setLocation('/messages');
                  
                  // Dispatch focus event with delay - find conversation with sender
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('focus-conversation', { 
                      detail: { 
                        conversationId: null, // Don't rely on conversationId
                        withUserId: senderId  // Specify the user to open conversation with
                      } 
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
        
        // Update unread count since we received a new message that will be shown as notification
        window.dispatchEvent(new CustomEvent('update-unread-count'));

      });

      // Listen for new group messages
      const cleanupGroupMessage = onSocketEvent('channel:message:new', (data) => {
        // Don't show notification for messages sent by current user
        // Handle both structures: direct message object or { message: messageObject, ... }
        const messageData = data.message || data; // Support both structures
        if (messageData.sender?.id === currentUserId) {
          
          return;
        }

        const senderName = messageData.senderFullName || 
                          messageData.senderUsername ||
                          messageData.sender?.fullName || 
                          messageData.sender?.username || 
                          'Unknown user';
        
        // Find group and channel names
        const channel = channelsRef.current.find(c => c.id === data.channelId);
        const group = groupsRef.current.find(g => g.id === data.groupId);
        
        const groupName = group?.name || 'Group';
        const channelName = channel?.name || '';
        const fullGroupName = channelName ? `${groupName} #${channelName}` : groupName;
        
        const messagePreview = messageData.content?.substring(0, 50) || 'New message';
        
        
        // Don't show notification if user is on messages page AND in the same group/channel
        if (isOnMessagesPage) {
          const currentGroupId = currentGroupRef.current;
          const messageGroupId = data.groupId;
          const isInSameGroup = currentGroupId === messageGroupId;
          
          
          
          
          
          
          
          
          if (isInSameGroup && currentGroupId !== null) {
            
            return;
          } else {
            
          }
        } else {
          
        }
        
        
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
                {messageData.senderAvatarUrl || messageData.sender?.avatarUrl ? (
                  <img 
                    src={messageData.senderAvatarUrl || messageData.sender.avatarUrl} 
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
                    userId={messageData.sender?.id || ''}
                    username={messageData.senderUsername || messageData.sender?.username || ''}
                    fullName={messageData.senderFullName || messageData.sender?.fullName || ''}
                    profileRating={messageData.senderRating ? parseFloat(messageData.senderRating) : (messageData.sender?.rating || null)}
                    showRating={true}
                    className="mb-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{fullGroupName}</p>
                  <p className="text-sm text-muted-foreground mt-1">{messagePreview}{messageData.content?.length > 50 ? '...' : ''}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  
                  // Close the notification
                  if (groupNotification?.dismiss) {
                    groupNotification.dismiss();
                    
                  }
                  
                  setLocation('/messages');
                  
                  // Wait for Messages component to mount and load data
                  setTimeout(() => {
                    // Ensure we get the correct group and channel IDs
                    const groupId = data.groupId || data.message?.groupId;
                    const channelId = data.channelId || data.message?.channelId;
                    
                    window.dispatchEvent(new CustomEvent('focus-group', { 
                      detail: { 
                        groupId: groupId,
                        channelId: channelId 
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
        
        
      });

      
      
      // DON'T return cleanup function - let listeners persist
      // return () => {
      //   
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