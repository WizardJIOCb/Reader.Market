import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Send, User, MessageCircle, Users, Plus, Hash, Settings, X as XIcon, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { joinConversation, leaveConversation, onSocketEvent, startTyping, stopTyping, joinChannel, leaveChannel } from '@/lib/socket';
import { GroupCreationDialog } from '@/components/GroupCreationDialog';
import { GroupSettingsPanel } from '@/components/GroupSettingsPanel';
import { GroupMembersModal } from '@/components/GroupMembersModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

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
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  privacy: 'public' | 'private';
  memberCount?: number;
  createdAt: string;
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
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const { t } = useTranslation(['messages']);
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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
            updatedConvs[convIndex] = {
              ...updatedConvs[convIndex],
              lastMessage: {
                content: data.message.content,
                createdAt: data.message.createdAt
              },
              updatedAt: data.message.createdAt
            };
            
            // Move to top by sorting by updatedAt
            return updatedConvs.sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }
          
          // If conversation not found in list, fetch full list
          return prevConvs;
        });
      }
      
      // Also fetch to ensure consistency
      fetchConversations();
    });
    
    // Cleanup on unmount
    return () => {
      cleanupGlobalMessage();
    };
  }, []);

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
      
      // Set up WebSocket event listeners
      const cleanupNewMessage = onSocketEvent('message:new', (data) => {
        if (data.conversationId === selectedConversation.id) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === data.message.id)) {
              return prev;
            }
            return [...prev, data.message];
          });
          
          // Mark new message as read immediately since chat is open
          markMessageAsRead(data.message.id);
          
          // Update conversation list and unread count
          fetchConversations();
          window.dispatchEvent(new CustomEvent('update-unread-count'));
        }
      });
      
      const cleanupTyping = onSocketEvent('user:typing', (data) => {
        if (data.conversationId === selectedConversation.id && data.userId !== user?.id) {
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
        }
      });
      
      const cleanupNotification = onSocketEvent('notification:new', (data) => {
        if (data.type === 'new_message') {
          // Update unread count in navbar
          window.dispatchEvent(new CustomEvent('update-unread-count'));
        }
      });
      
      const cleanupMessageDeleted = onSocketEvent('message:deleted', (data) => {
        if (data.conversationId === selectedConversation.id) {
          setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        }
      });
      
      // Cleanup on conversation change or unmount
      return () => {
        leaveConversation(selectedConversation.id);
        cleanupNewMessage();
        cleanupTyping();
        cleanupNotification();
        cleanupMessageDeleted();
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
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
      console.log('Fetching groups...');
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('Groups response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Groups data received:', data);
        setGroups(data);
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
      console.log('Fetching messages for channel:', channelId);
      const response = await fetch(`/api/groups/${groupId}/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      console.log('Channel messages response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Channel messages received:', data.length);
        setMessages(data.reverse()); // Reverse to show oldest first
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
        
        // Update unread count in navbar after viewing messages
        window.dispatchEvent(new CustomEvent('update-unread-count'));
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
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
      if (selectedConversation) {
        // Send private message
        const payload = {
          recipientId: selectedConversation.otherUser?.id,
          content: newMessage.trim(),
          conversationId: selectedConversation.id
        };
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
          // Message will be added via WebSocket event, but add locally as fallback
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          setNewMessage('');
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
        const response = await fetch(`/api/groups/${selectedGroup.id}/channels/${selectedChannel.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ content: newMessage.trim() })
        });

        console.log('Channel message send response status:', response.status);
        
        if (response.ok) {
          const message = await response.json();
          console.log('Channel message sent successfully:', message);
          // Message will be added via WebSocket event, but add locally as fallback
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          setNewMessage('');
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
      <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Left Panel - Conversations List */}
      <div className="w-80 border-r flex flex-col">
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
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={conv.otherUser?.avatarUrl || undefined} />
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
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
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
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
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Private Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                  <p className="text-sm text-muted-foreground">
                    @{selectedConversation.otherUser?.username}
                  </p>
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
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwn = message.senderId === user?.id;
                  const senderName = isOwn 
                    ? (user?.fullName || user?.username)
                    : (selectedConversation.otherUser?.fullName || selectedConversation.otherUser?.username);
                  const senderId = isOwn ? user?.id : selectedConversation.otherUser?.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
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
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {isOwn && (
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10"
                              title={t('messages:deleteMessage')}
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          )}
                          <p className="text-sm break-words">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {otherUserTyping && (
                <div className="text-sm text-muted-foreground italic mt-2">
                  {selectedConversation.otherUser?.fullName || selectedConversation.otherUser?.username} {t('messages:typing')}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={t('messages:typeMessage')}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                />
                <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
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
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwn = message.senderId === user?.id;
                      const canDelete = isOwn || userGroupRole === 'administrator' || userGroupRole === 'moderator';
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
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
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {canDelete && (
                                <button
                                  onClick={() => deleteMessage(message.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10"
                                  title="Удалить сообщение"
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              )}
                              <p className="text-sm break-words">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}>
                                {new Date(message.createdAt).toLocaleTimeString()}
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
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Message #${selectedChannel.name}`}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={sending}
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
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
