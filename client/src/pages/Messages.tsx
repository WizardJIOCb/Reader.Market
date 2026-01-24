import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Send, User, MessageCircle, Users, Plus, Hash, Settings, X as XIcon, Share2, ArrowLeft, Reply } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { joinConversation, leaveConversation, onSocketEvent, startTyping, stopTyping, joinChannel, leaveChannel } from '@/lib/socket';
import { GroupCreationDialog } from '@/components/GroupCreationDialog';
import { GroupSettingsPanel } from '@/components/GroupSettingsPanel';
import { GroupMembersModal } from '@/components/GroupMembersModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentDisplay } from '@/components/AttachmentDisplay';
import { QuotedMessagePreview } from '@/components/QuotedMessagePreview';
import { QuotedMessageDisplay } from '@/components/QuotedMessageDisplay';
import { MessageContextMenu } from '@/components/MessageContextMenu';
import { fileUploadManager, type UploadedFile } from '@/lib/fileUploadManager';
import { formatMessageTimestamp } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { usePageView } from '@/hooks/usePageView';

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  lastMessage: {
    content: string;
    createdAt: string;
  } | null;
  updatedAt: string;
  unreadCount: number;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  privacy: 'public' | 'private';
  memberCount?: number;
  createdAt: string;
  unreadCount?: number;
  books?: Array<{
    id: string;
    title: string;
    author: string;
  }>;
}

interface Channel {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: string;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  readStatus: boolean;
  senderUsername: string;
  senderFullName: string | null;
  senderAvatarUrl: string | null;
  quotedMessageId?: string;
  quotedText?: string;
  quotedSenderName?: string;
  quotedMessageContent?: string;
  attachments?: {
    url: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    thumbnailUrl?: string;
  }[];
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const { t, i18n } = useTranslation(['messages']);
  const isMobile = useIsMobile();
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  
  // Track page view for navigation logging
  usePageView('messages');
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [userGroupRole, setUserGroupRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'private' | 'groups'>('private');
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<{
    id: string;
    senderName: string;
    content: string;
    quotedText?: string;
  } | null>(null);
  
  // Context menu state for mobile long-press
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<Message | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Scroll to a specific message
  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly
      element.style.transition = 'background-color 0.3s';
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 1500);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversations and groups
  useEffect(() => {
    fetchConversations();
    fetchGroups();
  }, []);

  // Deep link processing - handle URL parameters
  useEffect(() => {
    const processDeepLink = async () => {
      // Only process once and after data is loaded
      if (deepLinkProcessed || loading) return;
      
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('user');
      const groupId = params.get('group');
      const channelId = params.get('channel');
      
      // If no params, mark as processed and return
      if (!userId && !groupId) {
        setDeepLinkProcessed(true);
        return;
      }
      
      try {
        // Handle user deep link (private conversation)
        if (userId) {
          
          setActiveTab('private');
          
          // Wait for conversations to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if conversation exists
          const existingConv = conversations.find(
            conv => conv.otherUser?.id === userId
          );
          
          if (existingConv) {
            
            setSelectedConversation(existingConv);
          } else {
            // Create new conversation
            
            await startConversation(userId);
          }
          
          setDeepLinkProcessed(true);
        }
        
        // Handle group deep link
        else if (groupId) {
          
          setActiveTab('groups');
          
          // Wait for groups to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if user is member
          const existingGroup = groups.find(g => g.id === groupId);
          
          if (existingGroup) {
            const fullGroupDetails = await fetchGroupDetails(groupId);
            if (fullGroupDetails) {
              setSelectedGroup(fullGroupDetails);
              
              // If channel is specified, select it after channels load
              if (channelId) {
                setTimeout(() => {
                  const channel = channels.find(c => c.id === channelId);
                  if (channel) {
                    setSelectedChannel(channel);
                  }
                }, 1000);
              }
            }
          } else {
            // Try to join the group if it's public
            const joined = await joinGroup(groupId);
            if (joined) {
              const fullGroupDetails = await fetchGroupDetails(groupId);
              if (fullGroupDetails) {
                setSelectedGroup(fullGroupDetails);
              }
            } else {
              toast({
                title: "Access Denied",
                description: "You don't have access to this group",
                variant: "destructive"
              });
            }
          }
          
          setDeepLinkProcessed(true);
        }
      } catch (error) {
        console.error('Deep link processing error:', error);
        toast({
          title: "Error",
          description: "Failed to open the conversation",
          variant: "destructive"
        });
        setDeepLinkProcessed(true);
      }
    };
    
    processDeepLink();
  }, [location, conversations, groups, channels, loading, deepLinkProcessed]);

  // Global WebSocket listener for updating conversation list when new messages arrive
  useEffect(() => {
    
    
    const cleanupGlobalMessage = onSocketEvent('message:new', (data) => {
      
      
      // Optimistically update conversation list
      if (data.conversationId && data.message) {
        setConversations(prevConvs => {
          // Find the conversation
          const convIndex = prevConvs.findIndex(c => c.id === data.conversationId);
          
          if (convIndex >= 0) {
            // Update existing conversation
            const updatedConvs = [...prevConvs];
            const isCurrentConversation = selectedConversation?.id === data.conversationId;
            
            updatedConvs[convIndex] = {
              ...updatedConvs[convIndex],
              lastMessage: {
                content: data.message.content,
                createdAt: data.message.createdAt
              },
              updatedAt: data.message.createdAt,
              // Increment unread count only if message is from other user and conversation is not currently open
              unreadCount: (data.message.senderId !== user?.id && !isCurrentConversation) 
                ? (updatedConvs[convIndex].unreadCount || 0) + 1 
                : updatedConvs[convIndex].unreadCount
            };
            
            // Move to top by sorting by updatedAt
            return updatedConvs.sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }
          
          // If conversation not found in list, don't change state - let fetchConversations handle it
          return prevConvs;
        });
      }
      
      // Always fetch to ensure consistency and handle new conversations
      fetchConversations();
    });
    
    // Cleanup on unmount
    return () => {
      cleanupGlobalMessage();
    };
  }, [selectedConversation, user?.id]);

  // Global WebSocket listener for notifications to update conversation list
  useEffect(() => {
    
    
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      
      );
      
      if (data.type === 'new_message') {
        
        // Update conversation list to refresh unread counts
        fetchConversations();
        // Also update navbar counter
        window.dispatchEvent(new CustomEvent('update-unread-count'));
        
        // If the message is for the currently open conversation, refresh messages
        if (selectedConversation && data.conversationId === selectedConversation.id) {
          
          fetchMessages(selectedConversation.id);
        }
      } else {
        
      }
    });
    
    
    
    return () => {
      
      cleanupNotification();
    };
  }, [selectedConversation]);

  // Global WebSocket listener for all message:new events (not just current conversation)
  useEffect(() => {
    
    
    const cleanupMessage = onSocketEvent('message:new', (data) => {
      
      
      
      // If message is for currently open conversation, add it to the message list
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(msg => msg.id === data.message.id)) {
            
            return prev;
          }
          
          return [...prev, data.message];
        });
        
        // Mark as read if user is recipient
        if (data.message.senderId !== user?.id) {
          
          markMessageAsRead(data.message.id);
        }
        
        // Update conversation list and unread count
        fetchConversations();
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      } else {
        
        // Just update the conversation list to show unread count
        fetchConversations();
      }
    });
    
    
    
    return () => {
      
      cleanupMessage();
    };
  }, [selectedConversation, user?.id]);

  // Global WebSocket listener for typing indicators (works for all conversations)
  useEffect(() => {
    
    
    const cleanupTyping = onSocketEvent('user:typing', (data) => {
      
      
      // Only show typing indicator if it's for the current conversation and not from current user
      if (selectedConversation && 
          data.conversationId === selectedConversation.id && 
          data.userId !== user?.id) {
        
        setOtherUserTyping(data.typing);
        
        // Clear typing indicator after 3 seconds of no updates
        if (data.typing) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            
            setOtherUserTyping(false);
          }, 3000);
        }
      } else {
        ', 'color: gray');
      }
    });
    
    
    
    return () => {
      
      cleanupTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [selectedConversation, user?.id]);

  // Global WebSocket listener for group channel messages to update group unread counts
  useEffect(() => {
    
    
    const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
      
      
      
      
      
      
      // Check if message is from a DIFFERENT group OR a different channel in the SAME group
      const isDifferentGroup = !selectedGroup || selectedGroup.id !== data.groupId;
      const isSameGroupDifferentChannel = selectedGroup?.id === data.groupId && 
                                           selectedChannel?.id !== data.channelId;
      
      if (isDifferentGroup || isSameGroupDifferentChannel) {
        // Increment unread count - user is NOT currently viewing this channel
        
        
        setGroups(prev => prev.map(group => {
          if (group.id === data.groupId) {
            const newCount = (group.unreadCount || 0) + 1;
            
            return { ...group, unreadCount: newCount };
          }
          return group;
        }));
        
        // DON'T call fetchGroups() here - it would overwrite our optimistic update with backend's stale data
        // The backend query has race conditions with timestamp-based tracking
        // Rely on optimistic updates for accuracy
        ', 'color: green');
      } else {
        
      }
    });
    
    return () => {
      cleanupChannelMessage();
    };
  }, [selectedChannel, selectedGroup]);

  // Handle focus events from notifications
  useEffect(() => {
    
    
    const handleFocusConversation = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      
      ));
      
      
      
      // Find and select the conversation
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        
        setSelectedConversation(conversation);
        if (isMobile) setShowMobileChat(true);
        setActiveTab('private');
        
        // Scroll to the conversation in the list
        setTimeout(() => {
          const element = document.querySelector(`[data-conversation-id="${conversationId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-accent');
            setTimeout(() => {
              element.classList.remove('bg-accent');
            }, 2000);
          }
        }, 100);
      } else {
        
        
        
        // Force refresh conversations
        fetchConversations().then(() => {
          // Retry after a delay
          setTimeout(() => {
            const retryConversation = conversations.find(c => c.id === conversationId);
            if (retryConversation) {
              
              setSelectedConversation(retryConversation);
              if (isMobile) setShowMobileChat(true);
              setActiveTab('private');
            } else {
              
              // Show error toast
              toast({
                title: "Conversation not found",
                description: "The conversation may have been deleted or you don't have access to it.",
                variant: "destructive"
              });
            }
          }, 500);
        });
      }
    };
    
    const handleFocusGroup = (event: CustomEvent) => {
      const { groupId, channelId } = event.detail;
      
      ));
      
      
      
      // Find and select the group
      const group = groups.find(g => g.id === groupId);
      if (group) {
        
        setSelectedGroup(group);
        if (isMobile) setShowMobileChat(true);
        setActiveTab('groups');
        
        // Notify MessageNotificationProvider about current group
        window.dispatchEvent(new CustomEvent('current-group-update', {
          detail: {
            groupId: group.id,
            channelId: channelId
          }
        }));
        
        // If channel ID provided, select that channel
        if (channelId) {
          const channel = channels.find(c => c.id === channelId);
          if (channel) {
            
            setSelectedChannel(channel);
          } else {
            
            // Select first channel if available
            if (channels.length > 0) {
              setSelectedChannel(channels[0]);
            }
          }
        }
      } else {
        
        
        
        // Try to fetch the specific group directly
        fetchGroupDetails(groupId).then(fullGroupDetails => {
          if (fullGroupDetails) {
            
            setSelectedGroup(fullGroupDetails);
            if (isMobile) setShowMobileChat(true);
            setActiveTab('groups');
            
            // If channel ID provided, select that channel
            if (channelId && fullGroupDetails.channels) {
              const channel = fullGroupDetails.channels.find((c: any) => c.id === channelId);
              if (channel) {
                
                setSelectedChannel(channel);
              }
            }
          } else {
            toast({
              title: "Group not found",
              description: "Unable to access this group",
              variant: "destructive"
            });
          }
        });
      }
    };
    
    window.addEventListener('focus-conversation', handleFocusConversation as EventListener);
    window.addEventListener('focus-group', handleFocusGroup as EventListener);
    
    return () => {
      
      window.removeEventListener('focus-conversation', handleFocusConversation as EventListener);
      window.removeEventListener('focus-group', handleFocusGroup as EventListener);
    };
  }, [conversations, groups, channels, isMobile]);

  // Clear search and selected items when switching tabs
  useEffect(() => {
    
    setSearchQuery('');
    setSearchResults([]);
    if (activeTab === 'groups') {
      setSelectedConversation(null);
      
      // Clear current group info
      window.dispatchEvent(new CustomEvent('current-group-update', {
        detail: {
          groupId: null,
          channelId: null
        }
      }));
    } else {
      setSelectedGroup(null);
      
    }
  }, [activeTab]);

  // Fetch messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      
      // Join conversation room for real-time updates
      joinConversation(selectedConversation.id);
      
      // Set up WebSocket event listeners for conversation-specific events
      // Note: message:new and user:typing are handled by global listeners above
      
      const cleanupMessageDeleted = onSocketEvent('message:deleted', (data) => {
        if (data.conversationId === selectedConversation.id) {
          setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        }
      });
      
      // Cleanup on conversation change or unmount
      return () => {
        leaveConversation(selectedConversation.id);
        cleanupMessageDeleted();
      };
    }
  }, [selectedConversation, user?.id]);

  // Fetch channels when group selected
  useEffect(() => {
    if (selectedGroup) {
      
      // Clear messages and reset channel when switching groups
      setMessages([]);
      setSelectedChannel(null);
      fetchChannels(selectedGroup.id);
      // Fetch user's role in this group
      fetchUserGroupRole(selectedGroup.id);
    } else {
      setChannels([]);
      setSelectedChannel(null);
      setMessages([]);
      setUserGroupRole(null);
    }
  }, [selectedGroup]);

  // Fetch channel messages when channel selected
  useEffect(() => {
    if (selectedChannel && selectedGroup) {
      
      fetchChannelMessages(selectedGroup.id, selectedChannel.id);
      
      // Join channel room for real-time updates
      joinChannel(selectedChannel.id);
      
      // Set up WebSocket event listeners for channel
      const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
        
        
        if (data.channelId === selectedChannel.id) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === data.message.id)) {
              return prev;
            }
            return [...prev, data.message];
          });
        }
      });
      
      const cleanupChannelMessageDeleted = onSocketEvent('channel:message:deleted', (data) => {
        if (data.channelId === selectedChannel.id) {
          setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        }
      });
      
      // Cleanup on channel change or unmount
      return () => {
        leaveChannel(selectedChannel.id);
        cleanupChannelMessage();
        cleanupChannelMessageDeleted();
      };
    }
  }, [selectedChannel, selectedGroup, user?.id]);

  const fetchConversations = async () => {
    try {
      
      const token = localStorage.getItem('authToken');
       + '...');
      
      // Decode JWT to see userId
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          :', payload.userId, payload.username);
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }
      
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/conversations'
        : '/api/conversations';
      
      
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      );
      if (response.ok) {
        const data = await response.json();
        
        
        if (data.length > 0) {
          );
          
          data.forEach((conv: any, i: number) => {
            
          });
        }
        
        setConversations(data);
        
      } else {
        const errorText = await response.text();
        console.error('Conversations fetch failed, status:', response.status, 'response:', errorText.substring(0, 200));
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        
        data.forEach((g: any) => {
          `);
        });
        setGroups(data);
        
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      
      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      return null;
    }
  };

  const fetchChannels = async (groupId: string) => {
    try {
      
      const response = await fetch(`/api/groups/${groupId}/channels`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setChannels(data);
        // Auto-select first channel if available
        if (data.length > 0) {
          
          setSelectedChannel(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const fetchChannelMessages = async (groupId: string, channelId: string) => {
    try {
      
      const response = await fetch(`/api/groups/${groupId}/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setMessages(data.reverse()); // Reverse to show oldest first
        
        // Optimistically clear unread count for this group immediately
        
        setGroups(prev => prev.map(group => {
          if (group.id === groupId) {
            
            return { ...group, unreadCount: 0 };
          }
          return group;
        }));
        
        // Mark channel as read immediately after viewing
        
        try {
          const markReadResponse = await fetch(`/api/groups/${groupId}/channels/${channelId}/mark-read`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          if (markReadResponse.ok) {
            
          } else {
            console.error('%c[FETCH CHANNEL MESSAGES] ❌ Mark-read failed:', 'color: red', markReadResponse.status);
          }
        } catch (markReadError) {
          console.error('Failed to mark channel as read:', markReadError);
        }
        
        
        
        // Increased delay to 300ms to ensure backend DB commit completes
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update group list to refresh unread counts
        // Now the badge should clear because we updated user's last activity timestamp
        
        await fetchGroups();
        
        
        // Update unread count in navbar after viewing group messages
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      }
    } catch (error) {
      console.error('Failed to fetch channel messages:', error);
    }
  };

  const fetchMessages = async (conversationId: string): Promise<void> => {
    try {
      
      const response = await fetch(`/api/messages/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        
        setMessages(data.reverse()); // Reverse to show oldest first
        
        
        
        // Small delay to ensure database transaction has fully committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update conversation list to refresh unread counts
        // This ensures the badge disappears when opening a conversation with unread messages
        await fetchConversations();
        
        
        // Update unread count in navbar after viewing messages
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        // Log error details but don't show to user (it's a background operation)
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn(`Failed to mark message ${messageId} as read:`, response.status, errorData);
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const joinGroup = async (groupId: string) => {
    try {
      
      const response = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      
      
      
      if (response.ok) {
        const data = await response.json();
        
        // Refresh groups list to include the newly joined group
        await fetchGroups();
        return true;
      } else {
        const error = await response.json();
        console.error('Failed to join group, status:', response.status, 'error:', error);
        toast({
          title: t('messages:error'),
          description: error.error || t('messages:failedToJoinGroup'),
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error('Join group exception:', error);
      toast({
        title: t('messages:error'),
        description: t('messages:failedToJoinGroup'),
        variant: "destructive"
      });
      return false;
    }
  };

  const fetchUserGroupRole = async (groupId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/my-role`
        : `/api/groups/${groupId}/my-role`;
      
      
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      
      
      if (response.ok) {
        const data = await response.json();
        
        setUserGroupRole(data.role);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch user group role, status:', response.status, 'response:', errorText.substring(0, 200));
      }
    } catch (error) {
      console.error('Failed to fetch user group role:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy for DELETE
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/messages/${messageId}`
        : `/api/messages/${messageId}`;
      
      
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      
      
      if (response.ok) {
        // Remove message from local state
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        toast({
          title: t('messages:messageDeleted'),
          description: t('messages:messageDeletedSuccess')
        });
      } else {
        const error = await response.json();
        console.error('Delete failed:', error);
        toast({
          title: t('messages:error'),
          description: error.error || t('messages:failedToDeleteMessage'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Delete message exception:', error);
      toast({
        title: t('messages:error'),
        description: t('messages:failedToDeleteMessage'),
        variant: "destructive"
      });
    }
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      if (activeTab === 'private') {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } else {
        // Search groups
        const response = await fetch(`/api/groups/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      }
    } catch (error) {
      console.error('Failed to search:', error);
    }
  };

  const startConversation = async (otherUserId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/conversations'
        : '/api/conversations';
      
      
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ otherUserId })
      });
      
      
      
      if (response.ok) {
        const conversation = await response.json();
        
        setSearchQuery('');
        setSearchResults([]);
        await fetchConversations();
        setSelectedConversation(conversation);
      } else {
        const error = await response.json();
        console.error('Failed to create conversation:', error);
        toast({
          title: t('messages:error'),
          description: error.error || t('messages:failedToCreateConversation'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Start conversation exception:', error);
      toast({
        title: t('messages:error'),
        description: t('messages:failedToCreateConversation'),
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    if (!selectedConversation && !selectedChannel) return;

    

    // Stop typing indicator for private conversations
    if (selectedConversation) {
      
      
      
      
      // Validate recipientId before sending
      if (!selectedConversation.otherUser?.id) {
        console.error('ERROR: No recipient ID in conversation!');
        toast({
          title: t('messages:error'),
          description: t('messages:failedToIdentifyRecipient'),
          variant: "destructive"
        });
        return;
      }
      
      stopTyping(selectedConversation.id);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    setSending(true);
    try {
      
      
      
      );
      
      
      if (selectedConversation) {
        // Send private message
        const payload: any = {
          recipientId: selectedConversation.otherUser?.id,
          content: newMessage.trim(),
          conversationId: selectedConversation.id,
          attachments: uploadedFiles.map(f => f.uploadId)
        };
        
        // Add quote data if replying to a message
        if (quotedMessage) {
          payload.quotedMessageId = quotedMessage.id;
          payload.quotedText = quotedMessage.quotedText || quotedMessage.content;
        }
        
        );
        
        // Use direct backend URL in development to bypass Vite proxy
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/messages'
          : '/api/messages';
        
        
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(payload)
        });

        
        
        if (response.ok) {
          const message = await response.json();
          
          
          
          // Message will be added via WebSocket event, but add locally as fallback
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              
              return prev;
            }
            
            return [...prev, message];
          });
          setNewMessage('');
          setAttachmentFiles([]);
          setUploadedFiles([]);
          setQuotedMessage(null); // Clear quoted message after sending
          await fetchConversations(); // Update last message in conversation list
          // Restore focus to input after sending
          setTimeout(() => messageInputRef.current?.focus(), 0);
        } else {
          const errorData = await response.json();
          console.error('Message send failed:', errorData);
          toast({
            title: "Error",
            description: errorData.error || "Failed to send message",
            variant: "destructive"
          });
        }
      } else if (selectedChannel && selectedGroup) {
        // Send channel message
        
        const payload: any = { 
          content: newMessage.trim(),
          attachments: uploadedFiles.map(f => f.uploadId)
        };
        
        // Add quote data if replying to a message
        if (quotedMessage) {
          payload.quotedMessageId = quotedMessage.id;
          payload.quotedText = quotedMessage.quotedText || quotedMessage.content;
        }
        
        const response = await fetch(`/api/groups/${selectedGroup.id}/channels/${selectedChannel.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(payload)
        });

        
        
        if (response.ok) {
          const message = await response.json();
          
          
          // Message will be added via WebSocket event, but add locally as fallback
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          setNewMessage('');
          setAttachmentFiles([]);
          setUploadedFiles([]);
          setQuotedMessage(null); // Clear quoted message after sending
          
          // Refresh group list to update unread counts after sending message
          // Backend uses user's last sent message timestamp to calculate unread counts
          
          await new Promise(resolve => setTimeout(resolve, 100));
          await fetchGroups();
          
          // Restore focus to input after sending
          setTimeout(() => messageInputRef.current?.focus(), 0);
        } else {
          const errorData = await response.json();
          console.error('Channel message send failed:', errorData);
          toast({
            title: "Error",
            description: errorData.error || "Failed to send message",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Message send exception:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Handle replying to a message (full message quote)
  const handleReplyToMessage = (message: Message) => {
    const senderName = message.senderId === user?.id 
      ? (user?.fullName || user?.username) 
      : (message.senderFullName || message.senderUsername);
    
    setQuotedMessage({
      id: message.id,
      senderName: senderName || 'Unknown',
      content: message.content,
      quotedText: undefined // Full message quote
    });
  };
  
  // Handle replying with selected text (partial quote)
  const handleReplyWithSelection = (message: Message) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (!selectedText || selectedText.length === 0) {
      // If no selection, quote full message
      handleReplyToMessage(message);
      return;
    }
    
    const senderName = message.senderId === user?.id 
      ? (user?.fullName || user?.username) 
      : (message.senderFullName || message.senderUsername);
    
    setQuotedMessage({
      id: message.id,
      senderName: senderName || 'Unknown',
      content: message.content,
      quotedText: selectedText // Partial quote
    });
    
    // Clear selection after capturing
    selection?.removeAllRanges();
  };
  
  // Long-press handlers for mobile context menu
  const handleTouchStart = (e: React.TouchEvent, message: Message, isOwn: boolean) => {
    // Only enable on mobile (< 640px)
    if (window.innerWidth >= 640) return;
    
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    
    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Show context menu
      setContextMenuTarget(message);
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
      setContextMenuOpen(true);
    }, 500);
  };
  
  // Right-click handler for desktop context menu
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenuTarget(message);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // Cancel long-press if moved more than 10px (scrolling)
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  
  const handleTouchEnd = () => {
    // Cancel long-press timer if touch ends before threshold
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };
  
  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);
  
  // Close context menu handler
  const handleCloseContextMenu = () => {
    setContextMenuOpen(false);
    setContextMenuPosition(null);
    setContextMenuTarget(null);
  };
  
  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    if (selectedConversation) {
      // Start typing indicator
      startTyping(selectedConversation.id);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(selectedConversation.id);
      }, 1000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>{t('messages:loadingConversations')}</p>
      </div>
    );
  }

  // Show login/register prompt if user is not authenticated
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="text-center space-y-4">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold">{t('messages:authRequired')}</h2>
            <p className="text-muted-foreground">
              {t('messages:authRequiredDescription')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/register">
                <Button className="w-full sm:w-auto">
                  {t('common:register')}
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full sm:w-auto">
                  {t('common:login')}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex h-[calc(100vh-8rem)] bg-background overflow-hidden rounded-lg border">
      {/* Left Panel - Conversations List */}
      <div className={`w-full md:w-80 border-r flex flex-col ${
        isMobile && showMobileChat ? 'hidden' : 'flex'
      }`}>
        <div className="p-4 border-b space-y-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'private' | 'groups')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="private" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                {t('messages:private')}
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('messages:groups')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'private' ? t('messages:searchUsers') : t('messages:searchGroups')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="pl-10"
              />
            </div>
            {activeTab === 'groups' && (
              <Button size="icon" variant="outline" onClick={() => setGroupDialogOpen(true)} title={t('messages:createGroup')}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          {searchResults.length > 0 && activeTab === 'private' && (
            <Card className="mt-2 absolute z-10 w-72 max-h-64 overflow-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                  onClick={() => startConversation(user.id)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{user.fullName || user.username}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {searchResults.length > 0 && activeTab === 'groups' && (
            <Card className="mt-2 absolute z-10 w-72 max-h-64 overflow-auto">
              {searchResults.map((group) => (
                <div
                  key={group.id}
                  className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                  onClick={async () => {
                    
                    setSearchQuery('');
                    setSearchResults([]);
                    
                    // Try to join the group first
                    const joined = await joinGroup(group.id);
                    if (joined) {
                      // Fetch full group details before selecting
                      const fullGroupDetails = await fetchGroupDetails(group.id);
                      if (fullGroupDetails) {
                        setSelectedGroup(fullGroupDetails);
                      }
                    }
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.privacy === 'private' ? t('messages:privateGroup') : t('messages:publicGroup')}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <ScrollArea className="flex-1">
          {activeTab === 'private' ? (
            conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('messages:noConversations')}</p>
                <p className="text-sm">{t('messages:findUsersToChat')}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 border-b cursor-pointer hover:bg-muted transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    setSelectedConversation(conv);
                    if (isMobile) setShowMobileChat(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={conv.otherUser?.avatarUrl || undefined} />
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      {conv.unreadCount > 0 && (
                        <div 
                          className="absolute -bottom-1 -left-1 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center border-2 border-background"
                          aria-label={`${conv.unreadCount} ${conv.unreadCount === 1 ? t('messages:unreadMessage') : t('messages:unreadMessages')}`}
                        >
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {conv.otherUser?.fullName || conv.otherUser?.username}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            groups.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('messages:noGroups')}</p>
                <p className="text-sm">{t('messages:createOrFindGroup')}</p>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className={`p-4 border-b cursor-pointer hover:bg-muted transition-colors ${
                    selectedGroup?.id === group.id ? 'bg-muted' : ''
                  }`}
                  onClick={async () => {
                    // Fetch full group details including books
                    const fullGroupDetails = await fetchGroupDetails(group.id);
                    if (fullGroupDetails) {
                      setSelectedGroup(fullGroupDetails);
                      if (isMobile) setShowMobileChat(true);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarFallback>
                          <Users className="w-4 h-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      {(typeof group.unreadCount === 'number' && group.unreadCount > 0) ? (
                        <div 
                          className="absolute -bottom-1 -left-1 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center border-2 border-background"
                          aria-label={`${group.unreadCount} ${group.unreadCount === 1 ? t('messages:unreadMessage') : t('messages:unreadMessages')}`}
                        >
                          {group.unreadCount > 99 ? '99+' : group.unreadCount}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.privacy === 'private' ? t('messages:privateGroup') : t('messages:publicGroup')}
                        {group.memberCount && ` • ${group.memberCount} ${t('messages:members')}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Display */}
      <div className={`flex-1 flex flex-col ${
        isMobile && !showMobileChat ? 'hidden' : 'flex'
      }`}>
        {selectedConversation ? (
          <>
            {/* Private Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowMobileChat(false);
                      setSelectedConversation(null);
                    }}
                    className="mr-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <Avatar>
                  <AvatarImage src={selectedConversation.otherUser?.avatarUrl || undefined} />
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Link 
                    href={`/profile/${selectedConversation.otherUser?.username || selectedConversation.otherUser?.id}`} 
                    target="_blank"
                    className="font-medium hover:underline cursor-pointer"
                  >
                    {selectedConversation.otherUser?.fullName || selectedConversation.otherUser?.username}
                  </Link>
                  {otherUserTyping ? (
                    <p className="text-sm text-muted-foreground italic flex items-center gap-1">
                      <span className="animate-pulse">⌨️</span>
                      {t('messages:typing')}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      @{selectedConversation.otherUser?.username}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/messages?user=${selectedConversation.otherUser?.id}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast({
                    title: t('messages:linkCopied'),
                    description: t('messages:conversationLinkCopied')
                  });
                }}
                title="Share conversation link"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Private Messages */}
            <ScrollArea className="flex-1 p-4 overflow-x-hidden">
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwn = message.senderId === user?.id;
                  const senderName = isOwn 
                    ? (user?.fullName || user?.username)
                    : (selectedConversation.otherUser?.fullName || selectedConversation.otherUser?.username);
                  const senderId = isOwn ? user?.id : selectedConversation.otherUser?.id;
                  
                  // Debug logging for attachments
                  if (message.attachments && message.attachments.length > 0) {
                    
                  }
                  
                  return (
                    <div
                      key={message.id}
                      ref={(el) => {
                        if (el) {
                          messageRefs.current.set(message.id, el);
                        } else {
                          messageRefs.current.delete(message.id);
                        }
                      }}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                        {!isOwn && (
                          <Link 
                            href={`/profile/${senderId}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline cursor-pointer mb-1 block"
                          >
                            {senderName}
                          </Link>
                        )}
                        <div
                          className={`rounded-lg p-3 relative group ${
                            isOwn
                              ? 'bg-slate-100 dark:bg-slate-800 text-foreground'
                              : 'bg-muted'
                          }`}
                          onTouchStart={(e) => handleTouchStart(e, message, isOwn)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onContextMenu={(e) => handleContextMenu(e, message)}
                        >
                          {isOwn && (
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="absolute top-1 right-1 hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10 sm:bg-transparent"
                              title={t('messages:deleteMessage')}
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          )}
                          {!isOwn && (
                            <button
                              onClick={() => handleReplyWithSelection(message)}
                              className="absolute top-1 right-1 hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md sm:bg-transparent"
                              style={{ backgroundColor: 'transparent' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1680c'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Reply"
                            >
                              <Reply className="w-3 h-3 text-white" />
                            </button>
                          )}
                          {message.quotedMessageId && (
                            <QuotedMessageDisplay
                              senderName={message.quotedSenderName || 'Unknown'}
                              content={message.quotedMessageContent || ''}
                              quotedText={message.quotedText}
                              onClick={() => scrollToMessage(message.quotedMessageId!)}
                            />
                          )}
                          <p className="text-sm break-words overflow-wrap-anywhere whitespace-pre-line">{message.content}</p>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2">
                              <AttachmentDisplay attachments={message.attachments} />
                            </div>
                          )}
                          <p className={`text-xs mt-1 ${
                            isOwn ? 'text-muted-foreground' : 'text-muted-foreground'
                          }`}>
                            {formatMessageTimestamp(message.createdAt, dateLocale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-2 sm:p-4 border-t space-y-2">
              {quotedMessage && (
                <QuotedMessagePreview
                  quotedMessage={quotedMessage}
                  onClear={() => setQuotedMessage(null)}
                />
              )}
              {attachmentFiles.length > 0 && (
                <AttachmentPreview
                  files={attachmentFiles}
                  onRemove={(index) => {
                    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
                    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                  }}
                  onUploadComplete={(files) => setUploadedFiles(files)}
                  autoUpload={true}
                />
              )}
              <div className="flex gap-1 sm:gap-2">
                <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
                  <EmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                  <AttachmentButton 
                    onFilesSelected={(files) => setAttachmentFiles(prev => [...prev, ...files])}
                    maxFiles={5}
                  />
                </div>
                <Textarea
                  ref={messageInputRef}
                  placeholder={t('messages:typeMessage')}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  disabled={sending}
                  className="flex-1 min-w-0 min-h-[40px] max-h-[120px] resize-none overflow-y-auto"
                  rows={1}
                />
                <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="sm" className="flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : selectedGroup ? (
          <>
            {/* Group Chat Header */}
            <div className="p-4 border-b">
              <div className="flex items-start gap-3">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowMobileChat(false);
                      setSelectedGroup(null);
                      setSelectedChannel(null);
                    }}
                    className="mr-2 flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{selectedGroup.name}</p>
                  {selectedGroup.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedGroup.description}
                    </p>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    <span>{selectedGroup.privacy === 'private' ? t('messages:privateGroup') : t('messages:publicGroup')}</span>
                    {selectedGroup.memberCount && (
                      <>
                        <span> • </span>
                        <span
                          className="hover:underline cursor-pointer inline-flex items-center gap-1"
                          onClick={() => setMemberModalOpen(true)}
                          title={t('messages:viewMembers')}
                        >
                          <Users className="w-3 h-3" />
                          {selectedGroup.memberCount} {t('messages:members')}
                        </span>
                      </>
                    )}
                  </div>
                  {selectedGroup.books && selectedGroup.books.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedGroup.books.map((book) => (
                        <Link
                          key={book.id}
                          href={`/book/${book.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded cursor-pointer transition-colors"
                        >
                          📚 {book.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/messages?group=${selectedGroup.id}`;
                      navigator.clipboard.writeText(shareUrl);
                      toast({
                        title: t('messages:linkCopied'),
                        description: t('messages:groupLinkCopied')
                      });
                    }}
                    title="Share group link"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                  {(userGroupRole === 'administrator' || userGroupRole === 'moderator') && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        
                        setGroupSettingsOpen(true);
                      }}
                      title={t('messages:groupSettings')}
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Channel Tabs */}
              {channels.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        // Notify MessageNotificationProvider about current channel
                        window.dispatchEvent(new CustomEvent('current-group-update', {
                          detail: {
                            groupId: selectedGroup?.id,
                            channelId: channel.id
                          }
                        }));
                      }}
                      className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 whitespace-nowrap transition-colors ${
                        selectedChannel?.id === channel.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <Hash className="w-3 h-3" />
                      {channel.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedChannel ? (
              <>
                {/* Channel Messages */}
                <ScrollArea className="flex-1 p-4 overflow-x-hidden">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwn = message.senderId === user?.id;
                      const canDelete = isOwn || userGroupRole === 'administrator' || userGroupRole === 'moderator';
                      return (
                        <div
                          key={message.id}
                          ref={(el) => {
                            if (el) {
                              messageRefs.current.set(message.id, el);
                            } else {
                              messageRefs.current.delete(message.id);
                            }
                          }}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%] sm:max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                            {!isOwn && message.senderUsername && (
                              <Link 
                                href={`/profile/${message.senderId}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:underline cursor-pointer mb-1 block"
                              >
                                {message.senderFullName || message.senderUsername}
                              </Link>
                            )}
                            <div
                              className={`rounded-lg p-3 relative group ${
                                isOwn
                                  ? 'bg-slate-100 dark:bg-slate-800 text-foreground'
                                  : 'bg-muted'
                              }`}
                              onTouchStart={(e) => handleTouchStart(e, message, isOwn)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              onContextMenu={(e) => handleContextMenu(e, message)}
                            >
                              {canDelete && (
                                <button
                                  onClick={() => deleteMessage(message.id)}
                                  className="absolute top-1 right-1 hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10 sm:bg-transparent"
                                  title={t('messages:deleteMessage')}
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              )}
                              {!isOwn && (
                                <button
                                  onClick={() => handleReplyWithSelection(message)}
                                  className="absolute top-1 right-1 hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md sm:bg-transparent"
                                  style={{ backgroundColor: 'transparent' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1680c'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  title="Reply"
                                >
                                  <Reply className="w-3 h-3 text-white" />
                                </button>
                              )}
                              {message.quotedMessageId && (
                                <QuotedMessageDisplay
                                  senderName={message.quotedSenderName || 'Unknown'}
                                  content={message.quotedMessageContent || ''}
                                  quotedText={message.quotedText}
                                  onClick={() => scrollToMessage(message.quotedMessageId!)}
                                />
                              )}
                              <p className="text-sm break-words overflow-wrap-anywhere whitespace-pre-line">{message.content}</p>
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2">
                                  <AttachmentDisplay attachments={message.attachments} />
                                </div>
                              )}
                              <p className={`text-xs mt-1 ${
                                isOwn ? 'text-muted-foreground' : 'text-muted-foreground'
                              }`}>
                                {formatMessageTimestamp(message.createdAt, dateLocale)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Channel Message Input */}
                <div className="p-2 sm:p-4 border-t space-y-2">
                  {quotedMessage && (
                    <QuotedMessagePreview
                      quotedMessage={quotedMessage}
                      onClear={() => setQuotedMessage(null)}
                    />
                  )}
                  {attachmentFiles.length > 0 && (
                    <AttachmentPreview
                      files={attachmentFiles}
                      onRemove={(index) => {
                        setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                      onUploadComplete={(files) => setUploadedFiles(files)}
                      autoUpload={true}
                    />
                  )}
                  <div className="flex gap-1 sm:gap-2">
                    <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
                      <EmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                      <AttachmentButton 
                        onFilesSelected={(files) => setAttachmentFiles(prev => [...prev, ...files])}
                        maxFiles={5}
                      />
                    </div>
                    <Textarea
                      ref={messageInputRef}
                      placeholder={`Message #${selectedChannel.name}`}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={sending}
                      className="flex-1 min-w-0 min-h-[40px] max-h-[120px] resize-none overflow-y-auto"
                      rows={1}
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="sm" className="flex-shrink-0">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">{t('messages:noChannels')}</p>
                  <p className="text-sm">{t('messages:noChannelsDescription')}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">{t('messages:selectConversation')}</p>
              <p className="text-sm">{t('messages:selectConversationDescription')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
      
      <GroupCreationDialog 
        open={groupDialogOpen} 
        onOpenChange={setGroupDialogOpen}
        onGroupCreated={(groupId) => {
          toast({
            title: t('messages:groupCreated'),
            description: t('messages:groupCreatedDescription')
          });
          // Refresh groups list and switch to groups tab
          fetchGroups();
          setActiveTab('groups');
        }}
      />
      
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('messages:groupSettings')}</DialogTitle>
          </DialogHeader>
          {selectedGroup && user && (
            <GroupSettingsPanel
              groupId={selectedGroup.id}
              isAdmin={userGroupRole === 'administrator'}
              isModerator={userGroupRole === 'moderator'}
              currentUserId={user.id}
              onClose={() => {
                setGroupSettingsOpen(false);
                // Refresh channels after settings change
                fetchChannels(selectedGroup.id);
              }}
              onChannelsChange={() => {
                // Refresh channels when they're modified (created/deleted)
                if (selectedGroup) {
                  fetchChannels(selectedGroup.id);
                }
              }}
              onMembersChange={() => {
                // Refresh groups list to update member count
                fetchGroups();
                // Optionally re-fetch selected group to update its member count in header
                if (selectedGroup) {
                  // Find and update the selected group with fresh data
                  fetch(`/api/groups/${selectedGroup.id}`, {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                  }).then(res => res.json()).then(updatedGroup => {
                    setSelectedGroup(updatedGroup);
                  }).catch(err => console.error('Failed to refresh group:', err));
                }
              }}
              onGroupDeleted={() => {
                // Group was deleted, clear selection and refresh list
                setSelectedGroup(null);
                setSelectedChannel(null);
                setMessages([]);
                fetchGroups();
              }}
              onGroupUpdated={() => {
                // Group was updated, refresh list and selected group
                fetchGroups();
                if (selectedGroup) {
                  fetch(`/api/groups/${selectedGroup.id}`, {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                  }).then(res => res.json()).then(updatedGroup => {
                    setSelectedGroup(updatedGroup);
                  }).catch(err => console.error('Failed to refresh group:', err));
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Group Members Modal */}
      {selectedGroup && user && (
        <GroupMembersModal
          groupId={selectedGroup.id}
          isOpen={memberModalOpen}
          onClose={() => setMemberModalOpen(false)}
          userRole={userGroupRole as 'administrator' | 'moderator' | 'member'}
          currentUserId={user.id}
          onMemberUpdate={() => {
            // Refresh group data after member changes
            fetchGroups();
            if (selectedGroup) {
              fetch(`/api/groups/${selectedGroup.id}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
              }).then(res => res.json()).then(updatedGroup => {
                setSelectedGroup(updatedGroup);
              }).catch(err => console.error('Failed to refresh group:', err));
            }
          }}
        />
      )}
      
      {/* Context Menu for Long-Press (mobile) and Right-Click (desktop) */}
      <MessageContextMenu
        isOpen={contextMenuOpen}
        onClose={handleCloseContextMenu}
        position={contextMenuPosition}
        actions={
          contextMenuTarget
            ? (() => {
                const isOwn = contextMenuTarget.senderId === user?.id;
                const isAdmin = user?.accessLevel === 'admin' || user?.accessLevel === 'moder';
                const canDeleteInGroup = selectedGroup && (userGroupRole === 'administrator' || userGroupRole === 'moderator');
                const canDelete = isOwn || isAdmin || canDeleteInGroup;
                
                const actions = [];
                
                // Reply action - always available
                actions.push({
                  label: t('messages:replyToMessage'),
                  icon: <Reply className="w-4 h-4" />,
                  onClick: () => handleReplyWithSelection(contextMenuTarget),
                  variant: 'default' as const
                });
                
                // Delete action - for own messages or admin/moder
                if (canDelete) {
                  actions.push({
                    label: t('messages:deleteMessageAction'),
                    icon: <XIcon className="w-4 h-4" />,
                    onClick: () => deleteMessage(contextMenuTarget.id),
                    variant: 'destructive' as const
                  });
                }
                
                return actions;
              })()
            : []
        }
      />
    </div>
  );
}
