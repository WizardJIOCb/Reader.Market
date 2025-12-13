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
}

export function BookReader({ chapter, onNext, onPrev, hasPrev, hasNext, fontSize = 18 }: BookReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top on chapter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [chapter.id]);

  return (
    <motion.div
      key={chapter.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-3xl mx-auto px-6 py-12 md:py-20"
    >
      <header className="mb-12 text-center">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 block">
          Глава {chapter.id}
        </span>
        <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground leading-tight mb-8">
          {chapter.title.split(': ')[1] || chapter.title}
        </h1>
        <div className="w-24 h-1 bg-accent/30 mx-auto rounded-full" />
      </header>

      <article 
        ref={contentRef}
        className="prose prose-lg dark:prose-invert prose-stone mx-auto font-reading leading-loose text-foreground/90"
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: chapter.content }}
      />

      <div className="mt-24 flex items-center justify-between pt-8 border-t">
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
          {chapter.id}
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
    </motion.div>
  );
}
