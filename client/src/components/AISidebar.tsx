import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Lightbulb, FileText, ChevronRight } from 'lucide-react';
import { Chapter } from '@/lib/mockData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface AISidebarProps {
  chapter: Chapter;
  isOpen: boolean;
  onClose: () => void;
}

export function AISidebar({ chapter, isOpen, onClose }: AISidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-card border-l shadow-2xl flex flex-col"
        >
          <div className="p-4 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2 text-primary">
              <Brain className="w-5 h-5" />
              <h2 className="font-semibold text-lg">Нейро-Анализ</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8">
              {/* Summary Section */}
              <section>
                <div className="flex items-center gap-2 mb-3 text-primary/80">
                  <FileText className="w-4 h-4" />
                  <h3 className="font-medium uppercase tracking-wider text-xs">Краткий пересказ</h3>
                </div>
                <div className="bg-background border rounded-lg p-4 text-sm leading-relaxed text-muted-foreground shadow-sm">
                  {chapter.summary}
                </div>
              </section>

              <Separator />

              {/* Takeaways Section */}
              <section>
                <div className="flex items-center gap-2 mb-3 text-primary/80">
                  <Lightbulb className="w-4 h-4" />
                  <h3 className="font-medium uppercase tracking-wider text-xs">Ключевые выводы</h3>
                </div>
                <ul className="space-y-3">
                  {chapter.keyTakeaways.map((point, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-foreground/80 group">
                      <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-accent group-hover:bg-primary transition-colors" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Ollama Context Mock */}
              <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2 mb-2 text-xs font-mono text-primary/60">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Ollama v3.2 (7b) Connected
                </div>
                <p className="text-xs text-muted-foreground">
                  Анализ контекста выполнен за 0.4с. Связи с предыдущими главами обнаружены.
                </p>
              </div>
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
