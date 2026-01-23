# Message Page Improvements - January 9, 2026

## Overview
Implemented two major improvements to the messaging system as requested:

1. **Changed own message background color** from blue to a lighter, more pleasant emerald green
2. **Added message reply/quote functionality** allowing users to quote entire messages or selected text portions

## Changes Implemented

### 1. Frontend Changes (Messages.tsx)

#### Updated Message Interface
Added quote-related fields to the Message interface:
- `quotedMessageId?: string` - ID of the quoted message
- `quotedText?: string` - Partial text selection if quoting specific portion
- `quotedSenderName?: string` - Name of the sender being quoted

#### New State Management
- Added `quotedMessage` state to track the message being replied to
- Imported `QuotedMessagePreview` and `QuotedMessageDisplay` components
- Imported `Reply` icon from lucide-react

#### Message Bubble Styling
**Before:** Own messages had blue background (`bg-primary text-primary-foreground`)

**After:** Own messages have light emerald background with better contrast:
```typescript
'bg-emerald-50 dark:bg-emerald-950/30 text-foreground border border-emerald-200 dark:border-emerald-900'
```

This applies to both:
- Private conversation messages
- Group channel messages

#### Reply Functionality

**Reply Button:**
- Added a Reply button (appears on hover) on all received messages
- Located in top-right corner of message bubble
- Uses `Reply` icon from lucide-react

**Reply Handlers:**
- `handleReplyToMessage(message)` - Quotes entire message
- `handleReplyWithSelection(message)` - Quotes selected text or full message if no selection

**Text Selection Feature:**
- Users can select any portion of text in a message
- Clicking Reply captures the selection as `quotedText`
- If no text is selected, quotes the entire message

**UI Components:**
- `QuotedMessageDisplay` - Shows the quoted message within the new message bubble
- `QuotedMessagePreview` - Shows in input area while composing reply (with X button to cancel)

#### Updated sendMessage Function
- Checks for `quotedMessage` state before sending
- Adds `quotedMessageId` and `quotedText` to payload if replying
- Clears `quotedMessage` state after successful send
- Works for both private and channel messages

### 2. Backend Changes (routes.ts)

#### Private Messages Endpoint (POST /api/messages)
- Added `quotedMessageId` and `quotedText` to request body extraction
- Logs quote data for debugging
- Passes quote fields to storage layer

#### Channel Messages Endpoint (POST /api/groups/:groupId/channels/:channelId/messages)
- Added `quotedMessageId` and `quotedText` to request body extraction
- Includes quote data in messageData object before creating message

### 3. Storage Layer Changes (storage.ts)

#### createMessage Function
- Accepts `quotedMessageId` and `quotedText` in messageData
- Stores quote fields in database
- Fetches quoted message sender's name
- Returns `quotedSenderName` with message data

#### getConversationMessages Function
- Retrieves `quotedMessageId` and `quotedText` from database
- For each message with a quote, fetches the quoted sender's name
- Returns formatted messages with `quotedSenderName` field

#### getChannelMessages Function
- Same quote data retrieval as conversation messages
- Fetches quoted sender name for display
- Returns formatted messages with all quote information

## Database Schema

The messages table already had these fields from previous work:
```sql
quotedMessageId: varchar("quoted_message_id").references(() => messages.id)
quotedText: text("quoted_text")
```

No database migration needed - schema was already prepared.

## User Experience

### Replying to Messages

**Method 1: Full Message Quote**
1. Hover over any received message
2. Click the Reply icon (top-right corner)
3. Entire message appears as quote in input area
4. Type response and send

**Method 2: Partial Text Quote**
1. Select specific text within a message
2. Click the Reply icon
3. Only selected text appears as quote
4. Type response and send

**Canceling a Reply:**
- Click the X button in the quote preview area

### Visual Improvements

**Own Messages:**
- Light emerald green background in light mode
- Dark emerald background in dark mode
- Better text contrast with foreground color
- Subtle border for definition

**Quoted Messages:**
- Display in a highlighted box above message content
- Shows quoted sender's name
- Shows either full message or selected text
- Reply icon indicates it's a quote

## Files Modified

### Frontend
- `client/src/pages/Messages.tsx` - Main messaging component

### Backend  
- `server/routes.ts` - API endpoints for messages
- `server/storage.ts` - Database operations

### Components (Already Existed)
- `client/src/components/QuotedMessageDisplay.tsx` - Display quotes in messages
- `client/src/components/QuotedMessagePreview.tsx` - Show quote preview in input

## Testing Recommendations

1. **Private Messages:**
   - Send messages and verify light emerald background
   - Reply to messages with full quote
   - Reply with text selection
   - Verify quoted sender name displays correctly

2. **Group Messages:**
   - Test same scenarios in group channels
   - Verify reply button only shows on others' messages
   - Check delete button shows for own messages and admin/mod messages

3. **Text Selection:**
   - Select partial text and reply
   - Select across multiple lines
   - Verify selection clears after quote capture

4. **Quote Display:**
   - Verify quoted messages show sender name
   - Check truncation works for long quotes
   - Test quote display in both light and dark modes

## Notes

- All changes are backward compatible
- Existing messages without quotes display normally
- Quote functionality works seamlessly with existing emoji and attachment features
- Reply button does not appear on own messages (only delete button does)
