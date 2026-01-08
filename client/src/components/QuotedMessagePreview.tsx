import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuotedMessagePreviewProps {
  quotedMessage: {
    id: string;
    senderName: string;
    content: string;
    quotedText?: string;
  } | null;
  onClear: () => void;
}

export function QuotedMessagePreview({ quotedMessage, onClear }: QuotedMessagePreviewProps) {
  if (!quotedMessage) return null;

  const displayText = quotedMessage.quotedText || quotedMessage.content;
  const truncatedText = displayText.length > 100 
    ? displayText.substring(0, 100) + '...' 
    : displayText;

  return (
    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Replying to {quotedMessage.senderName}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {truncatedText}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-6 w-6"
        onClick={onClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
