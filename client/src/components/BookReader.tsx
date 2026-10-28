import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Chapter } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface BookReaderProps {
  chapter: Chapter;
  onNext?: () => void;
  onPrev?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  fontSize?: number;
  totalPages?: number;
  currentPageIndex?: number;
}

export function BookReader({ chapter, onNext, onPrev, hasPrev, hasNext, fontSize = 18, totalPages = 0, currentPageIndex = 0 }: BookReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Ensure content fits properly
  useEffect(() => {
    if (contentRef.current) {
      // Force reflow to ensure proper sizing
      contentRef.current.offsetHeight;
    }
  }, [chapter.content, fontSize]);

  return (
    <motion.div
      key={chapter.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-3xl mx-auto px-6 py-6 flex flex-col h-[calc(100vh-160px)] overflow-hidden"
      style={{ height: 'calc(100vh - 160px)', maxHeight: 'calc(100vh - 160px)' }}
    >
      <header className="mb-4 text-center flex-shrink-0">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">
          {totalPages > 0 ? `Страница ${currentPageIndex + 1} из ${totalPages}` : `Страница ${chapter.id}`}
        </span>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-tight mb-2">
          {chapter.title.split(': ')[1] || chapter.title}
        </h1>
        <div className="w-16 h-0.5 bg-accent/30 mx-auto rounded-full" />
      </header>

      <article 
        ref={contentRef}
        className="prose prose-base dark:prose-invert prose-stone mx-auto font-reading leading-relaxed text-foreground/90 flex-grow overflow-hidden"
        style={{ 
          fontSize: `${fontSize}px`, 
          lineHeight: '1.6',
          height: 'calc(100vh - 220px)',
          maxHeight: 'calc(100vh - 220px)', 
          overflowY: 'hidden',
          padding: '0.5rem',
          boxSizing: 'border-box'
        }}
        dangerouslySetInnerHTML={{ __html: chapter.content }}
      />

      <div className="mt-auto pt-8 border-t flex-shrink-0">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onPrev}
            disabled={!hasPrev}
            className={`flex items-center gap-2 hover:bg-transparent hover:text-primary ${!hasPrev ? 'invisible' : ''}`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Предыдущая</span>
          </Button>

          <span className="text-sm text-muted-foreground font-medium">
            {totalPages > 0 ? `${currentPageIndex + 1} / ${totalPages}` : `Страница ${currentPageIndex + 1}`}
          </span>

          <Button
            variant="ghost"
            onClick={onNext}
            disabled={!hasNext}
            className={`flex items-center gap-2 hover:bg-transparent hover:text-primary ${!hasNext ? 'invisible' : ''}`}
          >
            <span className="hidden sm:inline">Следующая</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
