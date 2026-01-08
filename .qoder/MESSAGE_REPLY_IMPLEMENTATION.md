# Message Reply and Quote Feature Implementation

## Summary
This document provides step-by-step instructions to add message reply/quote functionality to the Messages.tsx component.

## Files Created
1. `QuotedMessagePreview.tsx` - Preview component above input field ✅
2. `QuotedMessageDisplay.tsx` - Display quoted message inside reply ✅

## Changes Needed in Messages.tsx

### 1. Add Imports (after line 22)
```typescript
import { QuotedMessagePreview } from '@/components/QuotedMessagePreview';
import { QuotedMessageDisplay } from '@/components/QuotedMessageDisplay';
```

### 2. Update Message Interface (add to interface around line 65-81)
```typescript
interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  readStatus: boolean;
  senderUsername: string;
  senderFullName: string | null;
  senderAvatarUrl: string | null;
  quotedMessageId?: string | null;        // NEW
  quotedText?: string | null;             // NEW
  quotedMessage?: {                       // NEW
    id: string;
    senderUsername: string;
    senderFullName: string | null;
    content: string;
  } | null;
  attachments?: {
    url: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    thumbnailUrl?: string;
  }[];
}
```

### 3. Add State Variables (after line 142)
```typescript
const [quotedMessage, setQuotedMessage] = useState<{
  id: string;
  senderName: string;
  content: string;
  quotedText?: string;
} | null>(null);
const [selectedText, setSelectedText] = useState('');
```

### 4. Add Quote Handler Function (after line 965 - sendMessage function)
```typescript
const handleReplyToMessage = (message: Message) => {
  const senderName = message.senderFullName || message.senderUsername;
  setQuotedMessage({
    id: message.id,
    senderName: senderName,
    content: message.content,
    quotedText: selectedText || undefined
  });
  setSelectedText('');
};

const clearQuote = () => {
  setQuotedMessage(null);
  setSelectedText('');
};
```

### 5. Update sendMessage Function to Include Quote Data
Around line 1040, update the payload:
```typescript
const payload: any = {
  recipientId: selectedConversation.otherUser.id,
  content: newMessage.trim(),
  conversationId: selectedConversation.id,
  attachments: uploadedFiles.map(f => f.uploadId),
  quotedMessageId: quotedMessage?.id || null,      // NEW
  quotedText: quotedMessage?.quotedText || null    // NEW
};
```

And clear quote after sending (around line 1078):
```typescript
setNewMessage('');
setAttachmentFiles([]);
setUploadedFiles([]);
clearQuote();  // NEW
```

### 6. Update Message Display (around line 1467-1512)
Replace the message rendering with:
```typescript
return (
  <div
    key={message.id}
    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    onContextMenu={(e) => {
      e.preventDefault();
      handleReplyToMessage(message);
    }}
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
        
        {/* NEW: Display quoted message if exists */}
        {message.quotedMessage && (
          <QuotedMessageDisplay
            senderName={message.quotedMessage.senderFullName || message.quotedMessage.senderUsername}
            content={message.quotedMessage.content}
            quotedText={message.quotedText || undefined}
            onClick={() => {
              // Scroll to quoted message if visible
              const quotedEl = document.getElementById(`msg-${message.quotedMessageId}`);
              if (quotedEl) {
                quotedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                quotedEl.classList.add('highlight-flash');
                setTimeout(() => quotedEl.classList.remove('highlight-flash'), 2000);
              }
            }}
          />
        )}
        
        <p className="text-sm break-words">{message.content}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2">
            <AttachmentDisplay attachments={message.attachments} />
          </div>
        )}
        <p className={`text-xs mt-1 ${
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}>
          {formatMessageTimestamp(message.createdAt)}
        </p>
      </div>
    </div>
  </div>
);
```

### 7. Add Quote Preview Above Input (around line 1519, before AttachmentPreview)
```typescript
{/* Message Input */}
<div className="p-4 border-t space-y-2">
  {/* NEW: Quote Preview */}
  {quotedMessage && (
    <QuotedMessagePreview
      quotedMessage={quotedMessage}
      onClear={clearQuote}
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
  {/* ... rest of input */}
```

### 8. Add CSS for Highlight Effect (in index.css or component)
```css
@keyframes highlight-flash {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(59, 130, 246, 0.2); }
}

.highlight-flash {
  animation: highlight-flash 2s ease-in-out;
}
```

## Group Chat Implementation
Repeat steps 5-7 for group chat messages section (starting around line 1672).

## Backend Changes Required
The backend already supports:
- `quotedMessageId` field in messages table ✅
- `quotedText` field in messages table ✅

Need to update:
1. `storage.getConversationMessages()` to join and return quoted message data
2. `storage.getChannelMessages()` to join and return quoted message data
3. POST `/api/messages` to save quote fields ✅ (already in messageData)
4. POST `/api/groups/:groupId/channels/:channelId/messages` to save quote fields

## Testing Checklist
- [ ] Right-click on message shows context menu (browser default)
- [ ] Quoted message preview appears above input
- [ ] Preview shows sender name and message text
- [ ] Clear button removes quote
- [ ] Sending message includes quote data
- [ ] Received messages with quotes display QuotedMessageDisplay
- [ ] Clicking quoted message scrolls to original (if visible)
- [ ] Quote works in both private and group chats
- [ ] Quote clears after sending message

## Next Steps
After implementing reply, add:
1. **Text Selection Quote**: Detect text selection in messages and show "Quote" button
2. **Mobile Long Press**: Add touch event handlers for mobile quote action
3. **Quote from deleted messages**: Handle case where quoted message no longer exists
