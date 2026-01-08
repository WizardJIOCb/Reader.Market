import React from 'react';
import { Reply } from 'lucide-react';

interface QuotedMessageDisplayProps {
  senderName: string;
  content: string;
  quotedText?: string;
  onClick?: () => void;
}

export function QuotedMessageDisplay({ 
  senderName, 
  content, 
  quotedText,
  onClick 
}: QuotedMessageDisplayProps) {
  const displayText = quotedText || content;
  const truncatedText = displayText.length > 80 
    ? displayText.substring(0, 80) + '...' 
    : displayText;

  return (
    <div 
      className={`mb-2 pl-3 py-1 border-l-3 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 rounded ${onClick ? 'cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Reply className="h-3 w-3 text-blue-500" />
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {senderName}
        </span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {truncatedText}
      </p>
    </div>
  );
}
