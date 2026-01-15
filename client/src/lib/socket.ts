import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export interface SocketEvents {
  // Message events
  'message:new': (data: { message: any; conversationId: string }) => void;
  'message:deleted': (data: { messageId: string; conversationId: string }) => void;
  'channel:message:new': (data: { message: any; channelId: string; groupId: string }) => void;
  'channel:message:deleted': (data: { messageId: string; channelId: string }) => void;
  
  // Reaction events
  'reaction:new': (data: { reaction: any; messageId: string; conversationId: string }) => void;
  'reaction:removed': (data: { reactionId: string; messageId: string; conversationId: string }) => void;
  'channel:reaction:new': (data: { reaction: any; messageId: string; channelId: string }) => void;
  'channel:reaction:removed': (data: { reactionId: string; messageId: string; channelId: string }) => void;
  
  // Typing indicators
  'user:typing': (data: { userId: string; conversationId: string; typing: boolean }) => void;
  'channel:user:typing': (data: { userId: string; channelId: string; typing: boolean }) => void;
  
  // Notification events
  'notification:new': (data: { type: string; conversationId?: string; senderId?: string }) => void;
  
  // Book chat events
  'book-chat:new-message': (data: any) => void;
  'book-chat:user-joined': (data: { userId: string; bookId: string }) => void;
  'book-chat:presence-update': (data: { bookId: string; userId: string; action: 'joined' | 'left' }) => void;
  'book-chat:online-users': (data: { bookId: string; userIds: string[] }) => void;
  'book-chat:user-typing': (data: { userId: string; bookId: string; typing: boolean }) => void;
  'book-chat:message-deleted': (data: { messageId: string }) => void;
  'book-chat:error': (data: { error: string }) => void;
}

export function initializeSocket(token?: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  // Connect to WebSocket server (with or without token)
  socket = io('/', {
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Store in local variable for TypeScript
  const socketInstance = socket;

  // Connection event handlers
  socketInstance.on('connect', () => {
    console.log('%c[SOCKET.IO] ✅ WebSocket connected', 'color: green; font-weight: bold');
    console.log('[SOCKET.IO] Socket ID:', socketInstance.id);
    if (token) {
      console.log('[SOCKET.IO] Connected to server with authentication, personal room should be auto-joined');
    } else {
      console.log('[SOCKET.IO] Connected to server without authentication (guest mode)');
    }
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('%c[SOCKET.IO] ❌ WebSocket disconnected', 'color: red; font-weight: bold');
    console.log('[SOCKET.IO] Reason:', reason);
  });

  socketInstance.on('connect_error', (error) => {
    console.error('%c[SOCKET.IO] ⚠️  WebSocket connection error', 'color: orange; font-weight: bold');
    console.error('[SOCKET.IO] Error details:', error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Helper functions for joining/leaving rooms
export function joinConversation(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('join:conversation', conversationId);
  }
}

export function leaveConversation(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('leave:conversation', conversationId);
  }
}

export function joinChannel(channelId: string): void {
  if (socket?.connected) {
    socket.emit('join:channel', channelId);
  }
}

export function leaveChannel(channelId: string): void {
  if (socket?.connected) {
    socket.emit('leave:channel', channelId);
  }
}

// Typing indicator helpers
export function startTyping(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('typing:start', { conversationId });
  }
}

export function stopTyping(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('typing:stop', { conversationId });
  }
}

export function startChannelTyping(channelId: string): void {
  if (socket?.connected) {
    socket.emit('channel:typing:start', { channelId });
  }
}

export function stopChannelTyping(channelId: string): void {
  if (socket?.connected) {
    socket.emit('channel:typing:stop', { channelId });
  }
}

// Book chat helpers
export function joinBookChat(bookId: string): void {
  if (socket?.connected) {
    socket.emit('join:book-chat', bookId);
  }
}

export function leaveBookChat(bookId: string): void {
  if (socket?.connected) {
    socket.emit('leave:book-chat', bookId);
  }
}

export function sendBookChatMessage(bookId: string, content: string, mentionedUserId?: string, quotedMessageId?: string, attachmentUrls?: string[], attachmentMetadata?: any): void {
  if (socket?.connected) {
    socket.emit('book-chat:send-message', { bookId, content, mentionedUserId, quotedMessageId, attachmentUrls, attachmentMetadata });
  }
}

export function startBookChatTyping(bookId: string): void {
  if (socket?.connected) {
    socket.emit('book-chat:typing', { bookId, typing: true });
  }
}

export function stopBookChatTyping(bookId: string): void {
  if (socket?.connected) {
    socket.emit('book-chat:typing', { bookId, typing: false });
  }
}

export function deleteBookChatMessage(bookId: string, messageId: string): void {
  console.log('[SOCKET] deleteBookChatMessage called with:', { bookId, messageId, socketConnected: socket?.connected });
  if (socket?.connected) {
    console.log('[SOCKET] Emitting book-chat:delete-message', { bookId, messageId });
    socket.emit('book-chat:delete-message', { bookId, messageId });
  } else {
    console.error('[SOCKET] Cannot delete message - socket not connected');
  }
}

// Event listener helper with type safety
export function onSocketEvent<K extends keyof SocketEvents>(
  event: K,
  handler: SocketEvents[K]
): () => void {
  if (socket) {
    socket.on(event, handler as any);
    // Return cleanup function
    return () => {
      socket?.off(event, handler as any);
    };
  }
  return () => {};
}
