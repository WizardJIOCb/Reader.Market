# Fix: 403 Forbidden Error When Marking Messages as Read

## Problem
Users were encountering a 403 (Forbidden) error when sending or receiving messages:

```
PUT http://localhost:3001/api/messages/b638baf0-78e9-47f0-b2c1-83c380785698/read 403 (Forbidden)
```

## Root Cause

The backend endpoint `/api/messages/:messageId/read` checks if the current user is the **recipient** of the message before allowing them to mark it as read:

```typescript
// backend: server/routes.ts line 2393
if (message.recipientId !== userId) {
  return res.status(403).json({ error: "Access denied" });
}
```

However, the frontend was attempting to mark **all** new messages as read when they arrived via WebSocket, including messages sent by the current user themselves:

```typescript
// frontend: client/src/pages/Messages.tsx line 346 (before fix)
const cleanupNewMessage = onSocketEvent('message:new', (data) => {
  if (data.conversationId === selectedConversation.id) {
    setMessages((prev) => [...prev, data.message]);
    
    // ❌ This tries to mark ALL messages as read, even ones sent by current user
    markMessageAsRead(data.message.id);
  }
});
```

**Issue**: When user A sends a message to user B:
1. User A's WebSocket receives the `message:new` event (because they're in the conversation room)
2. User A tries to mark the message as read
3. Backend checks: "Is user A the recipient?" → NO (user A is the sender)
4. Backend returns 403 Forbidden

## Solution

### Change 1: Only Mark Messages as Read if Current User is Recipient

Modified the `message:new` event handler to check if the current user is the sender before attempting to mark the message as read:

```typescript
// client/src/pages/Messages.tsx line 335-352
const cleanupNewMessage = onSocketEvent('message:new', (data) => {
  if (data.conversationId === selectedConversation.id) {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some(msg => msg.id === data.message.id)) {
        return prev;
      }
      return [...prev, data.message];
    });
    
    // ✅ Only mark as read if current user is the recipient (not the sender)
    if (data.message.senderId !== user?.id) {
      markMessageAsRead(data.message.id);
    }
    
    // Update conversation list and unread count
    fetchConversations();
    window.dispatchEvent(new CustomEvent('update-unread-count'));
  }
});
```

### Change 2: Improved Error Handling

Enhanced the `markMessageAsRead` function to properly handle and log errors without showing them to users (since marking as read is a background operation):

```typescript
// client/src/pages/Messages.tsx line 609-626
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
```

## Files Modified

1. **`client/src/pages/Messages.tsx`** - Lines 335-352
   - Added sender check before marking message as read
   
2. **`client/src/pages/Messages.tsx`** - Lines 609-626
   - Enhanced error handling in `markMessageAsRead` function

## Expected Behavior After Fix

✅ **Correct Flow**:

**Scenario 1: User receives a message**
1. User B has chat open with User A
2. User A sends a message
3. User B receives `message:new` event
4. Check: Is User B the sender? → NO
5. ✅ Mark message as read (User B is the recipient)

**Scenario 2: User sends a message**
1. User A has chat open with User B
2. User A sends a message
3. User A receives `message:new` event (echoed back)
4. Check: Is User A the sender? → YES
5. ✅ Skip marking as read (User A is the sender, not recipient)

## Testing

1. Open two browser windows with different users
2. Have User A send a message to User B
3. Check browser console - should see NO 403 errors
4. Verify messages are marked as read for the recipient only
5. Verify unread counts update correctly

## Related Backend Logic

The backend correctly enforces that only recipients can mark messages as read:

```typescript
// server/routes.ts line 2382-2403
app.put("/api/messages/:messageId/read", authenticateToken, async (req, res) => {
  const userId = (req as any).user.userId;
  const { messageId } = req.params;
  
  try {
    const message = await storage.getMessage(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    // Only recipient can mark as read
    if (message.recipientId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await storage.markMessageAsRead(messageId);
    res.json({ success: true });
  } catch (error) {
    console.error("Mark message as read error:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});
```

This is correct behavior - the frontend just needed to respect this rule.

## Date
2026-01-07
