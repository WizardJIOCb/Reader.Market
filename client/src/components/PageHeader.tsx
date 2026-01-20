import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { VelvetRibbon } from '@/components/VelvetRibbon';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
  showRibbon?: boolean;
}

export function PageHeader({ title, showBackButton = false, backHref = "/", showRibbon = false }: PageHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleWidth, setTitleWidth] = useState(120);

  useEffect(() => {
    if (titleRef.current) {
      setTitleWidth(titleRef.current.offsetWidth);
    }
  }, [title]);

  return (
    <header className="flex items-center justify-between mb-8">
      {showBackButton ? (
        <Link href={backHref}>
          <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Назад</span>
          </Button>
        </Link>
      ) : (
        <div></div> // Empty div to maintain flex spacing
      )}
      <div className="flex-1 text-left relative">
        <h1 ref={titleRef} className="font-serif text-2xl font-bold inline-block relative">
          {title}
          {showRibbon && false && <VelvetRibbon titleWidth={titleWidth} debug={true} />}
        </h1>
      </div>
      <div className="w-10"></div> {/* Spacer for symmetry */}
    </header>
  );
}
