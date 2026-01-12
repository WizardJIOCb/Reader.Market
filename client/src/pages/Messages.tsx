import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { fileUploadManager, type UploadedFile } from '@/lib/fileUploadManager';
import { formatMessageTimestamp } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';

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
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<{
    id: string;
    senderName: string;
    content: string;
    quotedText?: string;
  } | null>(null);
  
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
          console.log('Processing deep link for user:', userId);
          setActiveTab('private');
          
          // Wait for conversations to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if conversation exists
          const existingConv = conversations.find(
            conv => conv.otherUser?.id === userId
          );
          
          if (existingConv) {
            console.log('Found existing conversation');
            setSelectedConversation(existingConv);
          } else {
            // Create new conversation
            console.log('Creating new conversation');
            await startConversation(userId);
          }
          
          setDeepLinkProcessed(true);
        }
        
        // Handle group deep link
        else if (groupId) {
          console.log('Processing deep link for group:', groupId);
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
    console.log('Setting up global message listener for conversation list updates');
    
    const cleanupGlobalMessage = onSocketEvent('message:new', (data) => {
      console.log('Global message listener: new message received', data);
      
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
    console.log('%c[NOTIFICATION LISTENER] Setting up global notification listener', 'color: purple; font-weight: bold');
    
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      console.log('%c[NOTIFICATION LISTENER] 🔔 Notification received!', 'color: purple; font-weight: bold', data);
      console.log('[NOTIFICATION LISTENER] Event data:', JSON.stringify(data, null, 2));
      
      if (data.type === 'new_message') {
        console.log('%c[NOTIFICATION LISTENER] ✅ Type is new_message - will fetch conversations', 'color: green; font-weight: bold');
        // Update conversation list to refresh unread counts
        fetchConversations();
        // Also update navbar counter
        window.dispatchEvent(new CustomEvent('update-unread-count'));
        
        // If the message is for the currently open conversation, refresh messages
        if (selectedConversation && data.conversationId === selectedConversation.id) {
          console.log('%c[NOTIFICATION LISTENER] 🔄 Message is for current conversation, refreshing messages', 'color: blue; font-weight: bold');
          fetchMessages(selectedConversation.id);
        }
      } else {
        console.log('%c[NOTIFICATION LISTENER] ⚠️  Notification type is not new_message:', data.type, 'color: orange');
      }
    });
    
    console.log('%c[NOTIFICATION LISTENER] ✅ Listener registered successfully', 'color: green');
    
    return () => {
      console.log('%c[NOTIFICATION LISTENER] Cleaning up listener', 'color: gray');
      cleanupNotification();
    };
  }, [selectedConversation]);

  // Global WebSocket listener for all message:new events (not just current conversation)
  useEffect(() => {
    console.log('%c[MESSAGE LISTENER] Setting up global message:new listener', 'color: teal; font-weight: bold');
    
    const cleanupMessage = onSocketEvent('message:new', (data) => {
      console.log('%c[MESSAGE LISTENER] 📬 Message received', 'color: teal; font-weight: bold', data);
      console.log('%c[MESSAGE LISTENER] Message attachments:', 'color: teal', data.message?.attachments);
      
      // If message is for currently open conversation, add it to the message list
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        console.log('%c[MESSAGE LISTENER] ✅ Message is for current conversation, adding to list', 'color: green; font-weight: bold');
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(msg => msg.id === data.message.id)) {
            console.log('%c[MESSAGE LISTENER] ⚠️  Message already exists, skipping', 'color: orange');
            return prev;
          }
          console.log('%c[MESSAGE LISTENER] ➕ Adding new message to list', 'color: green');
          return [...prev, data.message];
        });
        
        // Mark as read if user is recipient
        if (data.message.senderId !== user?.id) {
          console.log('%c[MESSAGE LISTENER] 👁️ Marking message as read', 'color: blue');
          markMessageAsRead(data.message.id);
        }
        
        // Update conversation list and unread count
        fetchConversations();
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      } else {
        console.log('%c[MESSAGE LISTENER] 📁 Message is for different conversation, updating list only', 'color: gray');
        // Just update the conversation list to show unread count
        fetchConversations();
      }
    });
    
    console.log('%c[MESSAGE LISTENER] ✅ Global listener registered', 'color: green');
    
    return () => {
      console.log('%c[MESSAGE LISTENER] Cleaning up global listener', 'color: gray');
      cleanupMessage();
    };
  }, [selectedConversation, user?.id]);

  // Global WebSocket listener for typing indicators (works for all conversations)
  useEffect(() => {
    console.log('%c[TYPING LISTENER] Setting up global typing listener', 'color: cyan; font-weight: bold');
    
    const cleanupTyping = onSocketEvent('user:typing', (data) => {
      console.log('%c[TYPING LISTENER] ⌨️ Typing event received', 'color: cyan', data);
      
      // Only show typing indicator if it's for the current conversation and not from current user
      if (selectedConversation && 
          data.conversationId === selectedConversation.id && 
          data.userId !== user?.id) {
        console.log('%c[TYPING LISTENER] ✅ Showing typing indicator for current conversation', 'color: green');
        setOtherUserTyping(data.typing);
        
        // Clear typing indicator after 3 seconds of no updates
        if (data.typing) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            console.log('%c[TYPING LISTENER] ⏰ Timeout: Clearing typing indicator', 'color: orange');
            setOtherUserTyping(false);
          }, 3000);
        }
      } else {
        console.log('%c[TYPING LISTENER] 🚫 Ignoring typing event (different conversation or own typing)', 'color: gray');
      }
    });
    
    console.log('%c[TYPING LISTENER] ✅ Global listener registered', 'color: green');
    
    return () => {
      console.log('%c[TYPING LISTENER] Cleaning up global listener', 'color: gray');
      cleanupTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [selectedConversation, user?.id]);

  // Global WebSocket listener for group channel messages to update group unread counts
  useEffect(() => {
    console.log('Setting up global channel message listener for group list updates');
    
    const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
      console.log('Global channel message listener: new message received', data);
      console.log('  - Message groupId:', data.groupId);
      console.log('  - Message channelId:', data.channelId);
      console.log('  - Currently selected group:', selectedGroup?.id);
      console.log('  - Currently selected channel:', selectedChannel?.id);
      
      // Check if message is from a DIFFERENT group OR a different channel in the SAME group
      const isDifferentGroup = !selectedGroup || selectedGroup.id !== data.groupId;
      const isSameGroupDifferentChannel = selectedGroup?.id === data.groupId && 
                                           selectedChannel?.id !== data.channelId;
      
      if (isDifferentGroup || isSameGroupDifferentChannel) {
        // Increment unread count - user is NOT currently viewing this channel
        console.log('%c[GLOBAL LISTENER] Message from unwatched channel, incrementing unread count', 'color: orange; font-weight: bold');
        
        setGroups(prev => prev.map(group => {
          if (group.id === data.groupId) {
            const newCount = (group.unreadCount || 0) + 1;
            console.log(`%c[GLOBAL LISTENER] Incrementing ${group.name} unread: ${group.unreadCount} -> ${newCount}`, 'color: orange');
            return { ...group, unreadCount: newCount };
          }
          return group;
        }));
        
        // DON'T call fetchGroups() here - it would overwrite our optimistic update with backend's stale data
        // The backend query has race conditions with timestamp-based tracking
        // Rely on optimistic updates for accuracy
        console.log('%c[GLOBAL LISTENER] ✅ Optimistic update complete (not fetching to avoid overwrite)', 'color: green');
      } else {
        console.log('%c[GLOBAL LISTENER] Message in currently viewed channel, not incrementing', 'color: gray');
      }
    });
    
    return () => {
      cleanupChannelMessage();
    };
  }, [selectedChannel, selectedGroup]);

  // Clear search and selected items when switching tabs
  useEffect(() => {
    console.log('Active tab changed to:', activeTab);
    setSearchQuery('');
    setSearchResults([]);
    if (activeTab === 'groups') {
      setSelectedConversation(null);
      console.log('Switched to groups tab, cleared conversation selection');
    } else {
      setSelectedGroup(null);
      console.log('Switched to private tab, cleared group selection');
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
      console.log('Group selected, fetching channels:', selectedGroup.id);
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
      console.log('Channel selected, fetching messages:', selectedChannel.id);
      fetchChannelMessages(selectedGroup.id, selectedChannel.id);
      
      // Join channel room for real-time updates
      joinChannel(selectedChannel.id);
      
      // Set up WebSocket event listeners for channel
      const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
        console.log('Channel-specific listener: message for channel', data.channelId);
        console.log('Channel message attachments:', data.message?.attachments);
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
      console.log('Fetching conversations...');
      const token = localStorage.getItem('authToken');
      console.log('Auth token:', token?.substring(0, 20) + '...');
      
      // Decode JWT to see userId
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload (userId, username):', payload.userId, payload.username);
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }
      
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/conversations'
        : '/api/conversations';
      
      console.log('Fetching conversations from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Conversations response status:', response.status);
      console.log('Backend API version:', response.headers.get('X-API-Version'));
      if (response.ok) {
        const data = await response.json();
        console.log('Conversations data received:', data);
        console.log('Number of conversations:', data.length);
        if (data.length > 0) {
          console.log('First conversation:', JSON.stringify(data[0], null, 2));
          console.log('Unread counts per conversation:');
          data.forEach((conv: any, i: number) => {
            console.log(`  ${i + 1}. ${conv.otherUser?.username}: unreadCount = ${conv.unreadCount}`);
          });
        }
        console.log('🔄 Updating conversations state with', data.length, 'conversations');
        setConversations(data);
        console.log('✅ setConversations called - React should re-render now');
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
      console.log('%c[FETCH GROUPS] Fetching groups...', 'color: blue');
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('%c[FETCH GROUPS] Groups response status:', 'color: blue', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('%c[FETCH GROUPS] Groups data received:', 'color: blue', data);
        console.log('%c[FETCH GROUPS] Detailed unread counts:', 'color: blue');
        data.forEach((g: any) => {
          console.log(`  - ${g.name}: unreadCount = ${g.unreadCount} (type: ${typeof g.unreadCount})`);
        });
        setGroups(data);
        console.log('%c[FETCH GROUPS] ✅ Groups state updated', 'color: green');
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      console.log('Fetching full group details for:', groupId);
      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('Group details response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Group details received:', data);
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
      console.log('Fetching channels for group:', groupId);
      const response = await fetch(`/api/groups/${groupId}/channels`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('Channels response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Channels data received:', data);
        setChannels(data);
        // Auto-select first channel if available
        if (data.length > 0) {
          console.log('Auto-selecting first channel:', data[0].id);
          setSelectedChannel(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const fetchChannelMessages = async (groupId: string, channelId: string) => {
    try {
      console.log('%c[FETCH CHANNEL MESSAGES] 📨 Fetching messages for channel:', 'color: blue; font-weight: bold', channelId);
      const response = await fetch(`/api/groups/${groupId}/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('Channel messages response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('%c[FETCH CHANNEL MESSAGES] ✅ Messages received:', 'color: green', data.length, 'messages');
        setMessages(data.reverse()); // Reverse to show oldest first
        
        // Optimistically clear unread count for this group immediately
        console.log('%c[FETCH CHANNEL MESSAGES] 🔄 Optimistically clearing unread count for group', 'color: purple');
        setGroups(prev => prev.map(group => {
          if (group.id === groupId) {
            console.log(`%c[FETCH CHANNEL MESSAGES] Clearing unread count for ${group.name}: ${group.unreadCount} -> 0`, 'color: purple');
            return { ...group, unreadCount: 0 };
          }
          return group;
        }));
        
        // Mark channel as read immediately after viewing
        console.log('%c[FETCH CHANNEL MESSAGES] 🔖 Marking channel as read...', 'color: purple; font-weight: bold');
        try {
          const markReadResponse = await fetch(`/api/groups/${groupId}/channels/${channelId}/mark-read`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          if (markReadResponse.ok) {
            console.log('%c[FETCH CHANNEL MESSAGES] ✅ Channel marked as read', 'color: green; font-weight: bold');
          } else {
            console.error('%c[FETCH CHANNEL MESSAGES] ❌ Mark-read failed:', 'color: red', markReadResponse.status);
          }
        } catch (markReadError) {
          console.error('Failed to mark channel as read:', markReadError);
        }
        
        console.log('%c[FETCH CHANNEL MESSAGES] 🔄 Refreshing group list to update unread counts...', 'color: orange; font-weight: bold');
        
        // Increased delay to 300ms to ensure backend DB commit completes
        console.log('%c[FETCH CHANNEL MESSAGES] ⏱ Waiting 300ms for DB commit...', 'color: gray');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update group list to refresh unread counts
        // Now the badge should clear because we updated user's last activity timestamp
        console.log('%c[FETCH CHANNEL MESSAGES] 🔄 Fetching groups now...', 'color: orange');
        await fetchGroups();
        console.log('%c[FETCH CHANNEL MESSAGES] ✅ Group list refreshed, badge should now be cleared', 'color: green; font-weight: bold');
        
        // Update unread count in navbar after viewing group messages
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      }
    } catch (error) {
      console.error('Failed to fetch channel messages:', error);
    }
  };

  const fetchMessages = async (conversationId: string): Promise<void> => {
    try {
      console.log('%c[FETCH MESSAGES] 📨 Fetching messages for conversation:', 'color: blue; font-weight: bold', conversationId);
      const response = await fetch(`/api/messages/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('%c[FETCH MESSAGES] ✅ Messages received:', 'color: green', data.length, 'messages');
        setMessages(data.reverse()); // Reverse to show oldest first
        
        console.log('%c[FETCH MESSAGES] 🔄 Backend has marked messages as read, now refreshing conversation list...', 'color: orange; font-weight: bold');
        
        // Small delay to ensure database transaction has fully committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update conversation list to refresh unread counts
        // This ensures the badge disappears when opening a conversation with unread messages
        await fetchConversations();
        console.log('%c[FETCH MESSAGES] ✅ Conversation list refreshed, badge should now be cleared', 'color: green; font-weight: bold');
        
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
      console.log('Attempting to join group:', groupId);
      const response = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log('Join group response status:', response.status);
      console.log('Join group response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Successfully joined group, response:', data);
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
      
      console.log('Fetching user group role from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log('Role fetch response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('User group role fetched:', data.role, 'for group:', groupId);
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
      
      console.log('Deleting message:', messageId, 'using URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log('Delete response status:', response.status);
      
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
      
      console.log('Creating conversation with user:', otherUserId, 'using URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ otherUserId })
      });
      
      console.log('Create conversation response status:', response.status);
      
      if (response.ok) {
        const conversation = await response.json();
        console.log('Conversation created/found:', conversation);
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

    console.log('Attempting to send message...');

    // Stop typing indicator for private conversations
    if (selectedConversation) {
      console.log('Selected conversation:', selectedConversation);
      console.log('otherUser:', selectedConversation.otherUser);
      console.log('recipientId:', selectedConversation.otherUser?.id);
      
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
      console.log('=== SENDING MESSAGE ===');
      console.log('uploadedFiles:', uploadedFiles);
      console.log('attachmentFiles:', attachmentFiles);
      console.log('Upload IDs to send:', uploadedFiles.map(f => f.uploadId));
      console.log('quotedMessage:', quotedMessage);
      
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
        
        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        
        // Use direct backend URL in development to bypass Vite proxy
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/messages'
          : '/api/messages';
        
        console.log('Sending message to:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(payload)
        });

        console.log('Message send response status:', response.status);
        
        if (response.ok) {
          const message = await response.json();
          console.log('Message sent successfully:', message);
          console.log('Message attachments:', message.attachments);
          console.log('Message has attachments:', message.attachments && message.attachments.length > 0);
          // Message will be added via WebSocket event, but add locally as fallback
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              console.log('Message already in list, skipping');
              return prev;
            }
            console.log('Adding message to list:', message);
            return [...prev, message];
          });
          setNewMessage('');
          setAttachmentFiles([]);
          setUploadedFiles([]);
          setQuotedMessage(null); // Clear quoted message after sending
          await fetchConversations(); // Update last message in conversation list
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
        console.log('Sending channel message to:', selectedChannel.id);
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

        console.log('Channel message send response status:', response.status);
        
        if (response.ok) {
          const message = await response.json();
          console.log('Channel message sent successfully:', message);
          console.log('Channel message attachments:', message.attachments);
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
          console.log('%c[SEND MESSAGE] 🔄 Refreshing group list after sending...', 'color: orange; font-weight: bold');
          await new Promise(resolve => setTimeout(resolve, 100));
          await fetchGroups();
          console.log('%c[SEND MESSAGE] ✅ Group list refreshed', 'color: green; font-weight: bold');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
  
  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
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
                    console.log('Group search result clicked:', group);
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
                    href={`/profile/${selectedConversation.otherUser?.id}`} 
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
                    title: "Link copied!",
                    description: "Conversation link copied to clipboard"
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
                    console.log('Rendering message with attachments:', message.id, message.attachments);
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
                        >
                          {isOwn && (
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10 bg-background/80 sm:bg-transparent"
                              title={t('messages:deleteMessage')}
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          )}
                          {!isOwn && (
                            <button
                              onClick={() => handleReplyWithSelection(message)}
                              className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent bg-background/80 sm:bg-transparent"
                              title="Reply"
                            >
                              <Reply className="w-3 h-3" />
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
                          <p className="text-sm break-words overflow-wrap-anywhere">{message.content}</p>
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
                <Input
                  placeholder={t('messages:typeMessage')}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                  className="flex-1 min-w-0"
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
                        title: "Link copied!",
                        description: "Group link copied to clipboard"
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
                        console.log('Settings button clicked, userGroupRole:', userGroupRole);
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
                      onClick={() => setSelectedChannel(channel)}
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
                            >
                              {canDelete && (
                                <button
                                  onClick={() => deleteMessage(message.id)}
                                  className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10 bg-background/80 sm:bg-transparent"
                                  title="Удалить сообщение"
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              )}
                              {!isOwn && (
                                <button
                                  onClick={() => handleReplyWithSelection(message)}
                                  className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent bg-background/80 sm:bg-transparent"
                                  title="Reply"
                                >
                                  <Reply className="w-3 h-3" />
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
                              <p className="text-sm break-words overflow-wrap-anywhere">{message.content}</p>
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
                    <Input
                      placeholder={`Message #${selectedChannel.name}`}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={sending}
                      className="flex-1 min-w-0"
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
    </>
  );
}
