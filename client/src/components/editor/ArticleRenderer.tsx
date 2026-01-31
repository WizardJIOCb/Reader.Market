import React from 'react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

interface ArticleRendererProps {
  content: any;
}

export function ArticleRenderer({ content }: ArticleRendererProps) {
  // Convert JSON content to HTML
  const htmlContent = generateHTML(content, [
    StarterKit,
    Link,
    Underline,
    TextAlign,
  ]);

  return (
    <div 
      className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-p:leading-relaxed prose-a:text-blue-600 hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}