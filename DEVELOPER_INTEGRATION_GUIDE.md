# Developer Integration Guide: Message Citations, Emoji & File Attachments

This guide provides step-by-step instructions for integrating the new messaging features into your existing UI components.

## Quick Start

All components are ready to use. Import and integrate them into your existing message, comment, and review interfaces.

## Component Imports

```typescript
// Emoji
import { EmojiPicker } from '@/components/EmojiPicker';

// File Attachments
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentDisplay } from '@/components/AttachmentDisplay';

// Message Quotes
import { QuotedMessagePreview } from '@/components/QuotedMessagePreview';
import { MessageWithQuote } from '@/components/MessageWithQuote';

// File Upload Service
import { fileUploadManager, type UploadedFile } from '@/lib/fileUploadManager';
```

## Example 1: Adding Emoji Picker to Text Input

```typescript
function MessageInput() {
  const [message, setMessage] = useState('');

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  return (
    <div className="flex gap-2">
      <Textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <EmojiPicker onEmojiSelect={handleEmojiSelect} />
      <Button onClick={sendMessage}>Send</Button>
    </div>
  );
}
```

## Example 2: Adding File Attachments

```typescript
function MessageInputWithAttachments() {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFilesSelected = (files: File[]) => {
    setAttachments(prev => [...prev, ...files]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadComplete = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const sendMessage = async () => {
    // Send message with attachment IDs
    await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message,
        attachments: uploadedFiles.map(f => f.uploadId)
      })
    });

    // Reset
    setMessage('');
    setAttachments([]);
    setUploadedFiles([]);
  };

  return (
    <div className="space-y-2">
      <AttachmentPreview 
        files={attachments}
        onRemove={handleRemoveAttachment}
        onUploadComplete={handleUploadComplete}
        autoUpload={true}
      />
      
      <div className="flex gap-2">
        <Textarea 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <AttachmentButton onFilesSelected={handleFilesSelected} />
        <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
        <Button onClick={sendMessage} disabled={uploadedFiles.length !== attachments.length}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

## Example 3: Displaying Messages with Attachments

```typescript
interface Message {
  id: string;
  content: string;
  attachmentMetadata?: {
    attachments: Array<{
      url: string;
      filename: string;
      fileSize: number;
      mimeType: string;
      thumbnailUrl?: string;
    }>;
  };
}

function MessageDisplay({ message }: { message: Message }) {
  const attachments = message.attachmentMetadata?.attachments || [];

  return (
    <div className="message">
      <p>{message.content}</p>
      {attachments.length > 0 && (
        <AttachmentDisplay attachments={attachments} className="mt-2" />
      )}
    </div>
  );
}
```

## Example 4: Message Reply with Quote

```typescript
function MessagesWithQuotes() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const handleReply = (message: Message) => {
    setQuotedMessage(message);
  };

  const sendMessage = async () => {
    await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: newMessage,
        quotedMessageId: quotedMessage?.id
      })
    });

    setNewMessage('');
    setQuotedMessage(null);
  };

  return (
    <div>
      {/* Message List */}
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message-container">
            <MessageWithQuote 
              message={message}
              quotedMessage={getQuotedMessage(message.quotedMessageId)}
              onQuoteClick={(msgId) => scrollToMessage(msgId)}
            >
              <div className="message-content">
                {message.content}
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleReply(message)}
                >
                  Reply
                </Button>
              </div>
            </MessageWithQuote>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="input-area">
        <QuotedMessagePreview 
          quotedMessage={quotedMessage}
          onClear={() => setQuotedMessage(null)}
        />
        <Textarea 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}
```

## Example 5: Text Selection Quote

```typescript
function MessageWithTextSelection({ message }: { message: Message }) {
  const [selectedText, setSelectedText] = useState('');

  const handleTextSelect = () => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text.length > 0 && text.length <= 500) {
      setSelectedText(text);
      // Trigger quote action
      onQuoteText(message, text);
    }
  };

  return (
    <div 
      onMouseUp={handleTextSelect}
      className="message-text selectable"
    >
      {message.content}
    </div>
  );
}
```

## Backend Integration

### Update Message Creation API

Add support for quotes and attachments in your message creation endpoint:

```typescript
app.post("/api/messages", authenticateToken, async (req, res) => {
  const userId = (req as any).user.userId;
  const { 
    content, 
    conversationId, 
    channelId,
    quotedMessageId,
    quotedText,
    attachments // Array of upload IDs
  } = req.body;

  try {
    // Create message
    const message = await db.insert(messages).values({
      senderId: userId,
      content,
      conversationId,
      channelId,
      quotedMessageId: quotedMessageId || null,
      quotedText: quotedText || null,
      attachmentUrls: attachments ? JSON.stringify(attachments) : '[]',
      attachmentMetadata: null // Will be populated below
    }).returning();

    // If attachments exist, link them to the message
    if (attachments && attachments.length > 0) {
      const attachmentDetails = [];
      
      for (const uploadId of attachments) {
        // Update file upload entity
        await storage.updateFileUploadEntity(uploadId, 'message', message[0].id);
        
        // Get file details
        const fileUpload = await storage.getFileUpload(uploadId);
        if (fileUpload) {
          attachmentDetails.push({
            url: fileUpload.fileUrl,
            filename: fileUpload.filename,
            fileSize: fileUpload.fileSize,
            mimeType: fileUpload.mimeType,
            thumbnailUrl: fileUpload.thumbnailUrl
          });
        }
      }

      // Update message with attachment metadata
      await db.update(messages)
        .set({ 
          attachmentMetadata: JSON.stringify({ attachments: attachmentDetails })
        })
        .where(eq(messages.id, message[0].id));
    }

    // Fetch quoted message if present
    let quotedMessageData = null;
    if (quotedMessageId) {
      const quoted = await db.select().from(messages).where(eq(messages.id, quotedMessageId));
      if (quoted[0]) {
        const quotedSender = await db.select().from(users).where(eq(users.id, quoted[0].senderId));
        quotedMessageData = {
          ...quoted[0],
          senderUsername: quotedSender[0]?.username,
          senderFullName: quotedSender[0]?.fullName
        };
      }
    }

    // Return complete message
    res.json({
      ...message[0],
      quotedMessage: quotedMessageData
    });
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
});
```

### Update Comment/Review APIs

Similar pattern for comments and reviews:

```typescript
// Comments
app.post("/api/books/:bookId/comments", authenticateToken, async (req, res) => {
  const { content, attachments } = req.body;
  // ... similar attachment handling
});

// Reviews
app.post("/api/books/:bookId/reviews", authenticateToken, async (req, res) => {
  const { content, rating, attachments } = req.body;
  // ... similar attachment handling
});
```

## Common Patterns

### 1. Combined Input with All Features

```typescript
function RichMessageInput() {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [quotedText, setQuotedText] = useState('');

  return (
    <div className="space-y-2">
      {/* Quote Preview */}
      {(quotedMessage || quotedText) && (
        <QuotedMessagePreview 
          quotedMessage={quotedMessage}
          quotedText={quotedText}
          onClear={() => {
            setQuotedMessage(null);
            setQuotedText('');
          }}
        />
      )}

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <AttachmentPreview 
          files={attachments}
          onRemove={(index) => {
            setAttachments(prev => prev.filter((_, i) => i !== index));
            setUploadedFiles(prev => prev.filter((_, i) => i !== index));
          }}
          onUploadComplete={setUploadedFiles}
          autoUpload={true}
        />
      )}

      {/* Input Toolbar */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            rows={3}
          />
        </div>
        
        <div className="flex gap-1">
          <AttachmentButton onFilesSelected={(files) => setAttachments(prev => [...prev, ...files])} />
          <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
          <Button 
            onClick={handleSend}
            disabled={!message.trim() || (attachments.length > 0 && uploadedFiles.length !== attachments.length)}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Message Display with All Features

```typescript
function CompleteMessageDisplay({ message }: { message: Message }) {
  const attachments = message.attachmentMetadata?.attachments || [];
  const quotedMsg = useQuotedMessage(message.quotedMessageId);

  return (
    <div className="message">
      <MessageWithQuote 
        message={message}
        quotedMessage={quotedMsg}
        onQuoteClick={scrollToMessage}
      >
        <div className="message-body">
          <p className="message-content">{message.content}</p>
          {attachments.length > 0 && (
            <AttachmentDisplay attachments={attachments} className="mt-2" />
          )}
        </div>
      </MessageWithQuote>
      
      <div className="message-actions">
        <Button size="sm" variant="ghost" onClick={() => handleReply(message)}>
          Reply
        </Button>
      </div>
    </div>
  );
}
```

## Styling Customization

All components use Tailwind CSS and support dark mode. Customize by:

1. **Modifying component classes**:
```typescript
<EmojiPicker className="custom-emoji-btn" />
<AttachmentDisplay className="custom-attachment-layout" />
```

2. **Theme colors**:
- Quote borders use `border-blue-500`
- Can be changed to match your brand colors

3. **Responsive breakpoints**:
- Components adapt to mobile/desktop automatically
- Customize in component files if needed

## Performance Tips

1. **Lazy load images**: Attachment images load on demand
2. **Compress before upload**: fileUploadManager automatically compresses images
3. **Limit attachments**: Max 5 per message enforced
4. **Cache uploaded files**: Store uploadedFiles in state to avoid re-uploads

## Error Handling

```typescript
try {
  const uploadedFile = await fileUploadManager.uploadFile(file);
} catch (error) {
  toast({
    title: "Upload failed",
    description: error.message,
    variant: "destructive"
  });
}
```

## Testing Checklist

- [ ] Emoji picker opens and inserts emoji
- [ ] Files validate before upload
- [ ] Upload progress displays
- [ ] Attachments display correctly
- [ ] Images open in lightbox
- [ ] Documents download
- [ ] Quotes display sender info
- [ ] Reply creates quote
- [ ] Text selection creates quote

## Troubleshooting

**Emoji picker not showing**: Check that `emoji-picker-react` is installed
**Upload fails**: Verify API endpoints and authentication token
**Attachments not displaying**: Check attachment_metadata JSON structure
**Quotes not working**: Ensure quoted message fetch logic is implemented

## Support

- Design doc: `.qoder/quests/citation-and-reply-feature.md`
- Implementation status: `IMPLEMENTATION_STATUS_CITATIONS_ATTACHMENTS.md`
- Summary: `IMPLEMENTATION_COMPLETE_SUMMARY.md`
