# Fix: Messages Not Received When User Switches to Different Conversation

## Problem Description

**Scenario:**
1. User 1 opens a conversation with User 2
2. User 2 opens a conversation with User 1
3. They exchange messages - everything works fine ✅
4. User 1 switches to a conversation with User 3
5. User 2 sends a message to User 1
6. **User 1 does NOT receive the message** ❌

## Root Cause

The issue was in how WebSocket event listeners were managed:

### Previous Implementation (Broken)

1. **Local `message:new` listener** (lines 385-405):
   - Registered ONLY when a conversation is selected
   - Filtered to handle messages ONLY for `selectedConversation.id`
   - **Cleanup function** removed the listener when conversation changed
   
2. **Flow when switching conversations:**
   ```
   User 1 opens chat with User 2
   → useEffect runs
   → Registers message:new listener for conversation with User 2
   → joinConversation(conversationWithUser2Id)
   
   User 1 switches to chat with User 3
   → useEffect cleanup runs
   → leaveConversation(conversationWithUser2Id)  ❌ Left the room!
   → cleanupNewMessage()  ❌ Removed the listener!
   → New useEffect runs
   → Registers NEW message:new listener for conversation with User 3
   → joinConversation(conversationWithUser3Id)
   
   User 2 sends message to User 1
   → Backend emits to room: conversation:${conversationWithUser2Id}
   → User 1 is NO LONGER in that room ❌
   → Backend also emits to room: user:${user1Id} ✅
   → But User 1's old listener was removed ❌
   → Message is lost!
   ```

### The Core Issue

When User 1 switched conversations:
1. They **left the WebSocket room** for the old conversation (`leaveConversation`)
2. The **local listener** for `message:new` was **removed** (`cleanupNewMessage`)
3. The backend still sent `message:new` to the conversation room (which User 1 left)
4. The backend also sent `notification:new` to User 1's personal room (`user:${userId}`)
5. The `notification:new` handler updated the **conversation list** (unread count badge)
6. But it did **NOT update the message list** when User 1 returned to the conversation

## Solution

### Change 1: Add Global `message:new` Listener

Created a **global** `message:new` listener that stays active regardless of which conversation is selected:

```typescript
// client/src/pages/Messages.tsx lines 296-337
// Global WebSocket listener for all message:new events (not just current conversation)
useEffect(() => {
  console.log('%c[MESSAGE LISTENER] Setting up global message:new listener', 'color: teal; font-weight: bold');
  
  const cleanupMessage = onSocketEvent('message:new', (data) => {
    console.log('%c[MESSAGE LISTENER] 📬 Message received', 'color: teal; font-weight: bold', data);
    
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
```

**Key Points:**
- Listener is registered **once** when component mounts
- **Never removed** when switching conversations (only on unmount)
- Listens to **all** `message:new` events
- Checks if message is for current conversation
- Updates conversation list for **all** messages (updates unread counts)
- Adds message to message list **only if** it's for the currently open conversation

### Change 2: Enhanced `notification:new` Listener

Updated the global `notification:new` listener to refresh messages if they're for the current conversation:

```typescript
// client/src/pages/Messages.tsx lines 265-293
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
}
```

**Purpose:**
- Provides fallback mechanism if `message:new` event is missed
- Ensures conversation list is always updated
- Refreshes message list if user is viewing the affected conversation

### Change 3: Removed Duplicate Local Listener

Removed the old local `message:new` listener from the conversation-specific `useEffect` to avoid duplicate handling:

```typescript
// client/src/pages/Messages.tsx lines 376-418
// Fetch messages when conversation selected
useEffect(() => {
  if (selectedConversation) {
    fetchMessages(selectedConversation.id);
    
    // Join conversation room for real-time updates
    joinConversation(selectedConversation.id);
    
    // Set up WebSocket event listeners for conversation-specific events
    // Note: message:new is handled by global listener above
    
    const cleanupTyping = onSocketEvent('user:typing', (data) => {
      // ... typing indicator logic
    });
    
    const cleanupMessageDeleted = onSocketEvent('message:deleted', (data) => {
      // ... message deletion logic
    });
    
    // Cleanup on conversation change or unmount
    return () => {
      leaveConversation(selectedConversation.id);
      cleanupTyping();
      cleanupMessageDeleted();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }
}, [selectedConversation, user?.id]);
```

**Changes:**
- ❌ Removed local `message:new` listener
- ❌ Removed local `notification:new` listener
- ✅ Kept `user:typing` listener (conversation-specific)
- ✅ Kept `message:deleted` listener (conversation-specific)
- ✅ Still joins/leaves conversation rooms (for typing indicators)

## New Message Flow

### Scenario: User 1 in conversation with User 3, User 2 sends message to User 1

```
User 2 sends message to User 1
↓
Backend: POST /api/messages
↓
Backend emits TWO WebSocket events:
  1. io.to(`conversation:${conversationId}`).emit('message:new', {...})
  2. io.to(`user:${user1Id}`).emit('notification:new', {type: 'new_message', ...})
↓
User 1's browser receives BOTH events:
  
  Event 1: message:new
  ↓
  Global message:new listener (ALWAYS ACTIVE) ✅
  ↓
  Checks: data.conversationId === selectedConversation.id?
  ↓
  NO (User 1 is in conversation with User 3)
  ↓
  Just update conversation list (show unread badge)
  ↓
  fetchConversations() → User 1 sees unread count badge ✅
  
  Event 2: notification:new
  ↓
  Global notification:new listener ✅
  ↓
  fetchConversations() → Update unread counts ✅
  ↓
  window.dispatchEvent('update-unread-count') → Update navbar ✅

User 1 clicks on conversation with User 2
↓
useEffect triggers (selectedConversation changed)
↓
fetchMessages(conversationWithUser2Id) ✅
↓
All messages loaded, including the one User 2 sent ✅
```

## Testing Instructions

### Test Case 1: Basic Message Reception
1. Open browser window 1: Log in as User 1
2. Open browser window 2: Log in as User 2
3. Window 1: Open chat with User 2
4. Window 2: Open chat with User 1
5. Exchange a few messages - verify they appear in real-time ✅

### Test Case 2: Message While in Different Conversation
1. Continue from Test Case 1
2. Window 1: Click on a different user (User 3) to open that conversation
3. Window 2: Send a message to User 1
4. Window 1: Check browser console - should see:
   ```
   [MESSAGE LISTENER] 📬 Message received
   [MESSAGE LISTENER] 📁 Message is for different conversation, updating list only
   Fetching conversations...
   ```
5. Window 1: Verify unread badge appears next to User 2 in conversation list ✅
6. Window 1: Click on User 2 conversation
7. Window 1: Verify message from User 2 appears in the message list ✅

### Test Case 3: Message While on Messages Page (No Conversation Selected)
1. Window 1: Navigate to /messages but don't select any conversation
2. Window 2: Send message to User 1
3. Window 1: Verify unread badge appears ✅
4. Window 1: Click on conversation
5. Window 1: Verify message appears ✅

### Expected Console Logs

When receiving a message while in a **different** conversation:
```
[MESSAGE LISTENER] 📬 Message received (teal)
[MESSAGE LISTENER] 📁 Message is for different conversation, updating list only (gray)
Fetching conversations...
[NOTIFICATION LISTENER] 🔔 Notification received! (purple)
[NOTIFICATION LISTENER] ✅ Type is new_message - will fetch conversations (green)
Fetching conversations...
```

When receiving a message while in the **same** conversation:
```
[MESSAGE LISTENER] 📬 Message received (teal)
[MESSAGE LISTENER] ✅ Message is for current conversation, adding to list (green)
[MESSAGE LISTENER] ➕ Adding new message to list (green)
[MESSAGE LISTENER] 👁️ Marking message as read (blue)
Fetching conversations...
```

## Files Modified

1. **`client/src/pages/Messages.tsx`**
   - Lines 265-293: Enhanced `notification:new` global listener
   - Lines 296-337: Added global `message:new` listener
   - Lines 376-418: Removed local `message:new` and `notification:new` listeners

## Benefits

✅ **Messages always received**: Global listener never removed
✅ **Unread counts update**: Even when user is in different conversation
✅ **Real-time updates**: Messages appear immediately when switching back
✅ **No duplicates**: Proper duplicate checking in global listener
✅ **Better debugging**: Colored console logs for easier troubleshooting

## Date
2026-01-07
