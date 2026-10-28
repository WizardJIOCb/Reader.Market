import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
}

export function PageHeader({ title, showBackButton = false, backHref = "/" }: PageHeaderProps) {
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
      <h1 className="font-serif text-2xl font-bold flex-1 text-left">{title}</h1>
      <div className="w-10"></div> {/* Spacer for symmetry */}
    </header>
  );
}
