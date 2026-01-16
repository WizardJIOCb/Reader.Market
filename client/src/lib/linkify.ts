import React from 'react';

/**
 * Converts URLs in text to clickable links
 * @param text - The text to linkify
 * @returns JSX element with clickable links
 */
export function linkifyText(text: string): React.ReactNode {
  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return React.createElement(
        'a',
        {
          key: index,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-600 hover:text-blue-800 underline break-all'
        },
        part
      );
    }
    return part;
  });
}
