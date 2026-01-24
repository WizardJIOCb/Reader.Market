import React, { useEffect } from 'react';
import { onSocketEvent } from '@/lib/socket';

export function WebSocketDebugger() {
  useEffect(() => {
    
    
    const cleanupMessage = onSocketEvent('message:new', (data) => {
      
      );
      );
      
      
      
    });
    
    const cleanupChannelMessage = onSocketEvent('channel:message:new', (data) => {
      
      );
      );
      
      
      
      
    });
    
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      
      );
      
      
    });
    
    return () => {
      
      cleanupMessage();
      cleanupChannelMessage();
      cleanupNotification();
    };
  }, []);
  
  return null; // Invisible component
}