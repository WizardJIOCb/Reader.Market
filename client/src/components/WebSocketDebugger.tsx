import React, { useEffect } from 'react';
import { onSocketEvent } from '@/lib/socket';

export function WebSocketDebugger() {
  useEffect(() => {
    console.log('%c[DEBUGGER] WebSocket debugger mounted', 'color: orange; font-weight: bold');
    
    const cleanupMessage = onSocketEvent('message:new', (data) => {
      console.log('%c[DEBUGGER] 📩 RAW message:new event:', 'color: orange; font-weight: bold');
      console.log('%c[DEBUGGER] Data structure:', 'color: orange', JSON.stringify(data, null, 2));
      console.log('%c[DEBUGGER] Message keys:', 'color: orange', Object.keys(data));
      console.log('%c[DEBUGGER] Message content:', 'color: orange', data.message?.content);
      console.log('%c[DEBUGGER] Sender ID:', 'color: orange', data.message?.senderId);
      console.log('%c[DEBUGGER] Conversation ID:', 'color: orange', data.conversationId);
    });
    
    const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
      console.log('%c[DEBUGGER] 📢 RAW channel:message:new event:', 'color: cyan; font-weight: bold');
      console.log('%c[DEBUGGER] Data structure:', 'color: cyan', JSON.stringify(data, null, 2));
      console.log('%c[DEBUGGER] Message keys:', 'color: cyan', Object.keys(data));
      console.log('%c[DEBUGGER] Message content:', 'color: cyan', data.message?.content);
      console.log('%c[DEBUGGER] Sender ID:', 'color: cyan', data.message?.senderId);
      console.log('%c[DEBUGGER] Group ID:', 'color: cyan', data.groupId);
      console.log('%c[DEBUGGER] Channel ID:', 'color: cyan', data.channelId);
    });
    
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      console.log('%c[DEBUGGER] 🔔 RAW notification:new event:', 'color: purple; font-weight: bold');
      console.log('%c[DEBUGGER] Data structure:', 'color: purple', JSON.stringify(data, null, 2));
      console.log('%c[DEBUGGER] Type:', 'color: purple', data.type);
      console.log('%c[DEBUGGER] Conversation ID:', 'color: purple', data.conversationId);
    });
    
    return () => {
      console.log('%c[DEBUGGER] Cleaning up WebSocket listeners', 'color: gray');
      cleanupMessage();
      cleanupChannelMessage();
      cleanupNotification();
    };
  }, []);
  
  return null; // Invisible component
}