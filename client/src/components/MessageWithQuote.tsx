import React from 'react';
import { Reply } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface QuotedMessage {
  id: string;
  senderUsername: string;
  senderFullName?: string | null;
  senderAvatarUrl?: string | null;
  content: string;
}

interface MessageWithQuoteProps {
  message: {
    id: string;
    content: string;
    quotedMessageId?: string | null;
    quotedText?: string | null;
  };
  quotedMessage?: QuotedMessage | null;
  onQuoteClick?: (messageId: string) => void;
  children: React.ReactNode;
}

export function MessageWithQuote({ 
  message, 
  quotedMessage, 
  onQuoteClick,
  children 
}: MessageWithQuoteProps) {
  const hasQuote = message.quotedMessageId || message.quotedText;

  if (!hasQuote) {
    return <>{children}</>;
  }

  const displayName = quotedMessage?.senderFullName || quotedMessage?.senderUsername || 'Unknown User';
  const displayText = message.quotedText || quotedMessage?.content || '';
  const isDeleted = !quotedMessage && message.quotedMessageId;

  // Truncate text to 3 lines (approximately 120 characters for inline display)
  const truncatedText = displayText.length > 120 
    ? displayText.substring(0, 120) + '...' 
    : displayText;

  const handleQuoteClick = () => {
    if (message.quotedMessageId && onQuoteClick) {
      onQuoteClick(message.quotedMessageId);
    }
  };

  return (
    <div>
      {/* Quoted message */}
      <div 
        className={`bg-gray-100 dark:bg-gray-800 border-l-3 border-blue-500 rounded px-3 py-2 mb-2 ${
          message.quotedMessageId && !isDeleted ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : ''
        }`}
        onClick={handleQuoteClick}
      >
        <div className="flex items-start gap-2">
          <Reply className="h-3 w-3 text-blue-500 flex-shrink-0 mt-1" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {quotedMessage?.senderAvatarUrl && !isDeleted && (
                <Avatar className="h-4 w-4">
                  <AvatarImage src={quotedMessage.senderAvatarUrl} />
                  <AvatarFallback className="text-xs">{displayName[0]}</AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {isDeleted ? '[Message Deleted]' : displayName}
              </span>
            </div>
            {!isDeleted && (
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words line-clamp-3">
                {truncatedText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Original message content */}
      {children}
    </div>
  );
}
