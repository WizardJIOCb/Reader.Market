import React from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
} from '@/components/ui/sheet';
import { Menu, BookOpen, Search, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MobileMenu() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation(['navigation', 'common']);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-foreground">
          <Menu className="h-6 w-6" />
          <span className="sr-only">{t('navigation:openMenu')}</span>
        </Button>
      </SheetTrigger>
      <SheetPortal>
        <SheetPrimitive.Content
          className="fixed inset-y-0 right-0 h-full w-3/4 border-l bg-background p-0 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
        >
        <div className="flex justify-between items-start p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-6 h-6" />
            Reader.Market
          </SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="text-foreground -mt-1">
              <X className="h-6 w-6" />
              <span className="sr-only">{t('navigation:closeMenu')}</span>
            </Button>
          </SheetClose>
        </div>
        <div className="flex flex-col py-4">
          {user ? (
            <>
              <SheetClose asChild>
                <Link 
                  href="/home" 
                  className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('navigation:home')}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link 
                  href="/search" 
                  className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {t('navigation:search')}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link 
                  href="/shelves" 
                  className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('navigation:shelves')}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link 
                  href="/" 
                  className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('navigation:about')}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link 
                  href={`/profile/${user.id}`} 
                  className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  {t('navigation:profile')} ({user.username})
                </Link>
              </SheetClose>
            </>
          ) : (
            <div className="space-y-2 px-4">
              <SheetClose asChild>
                <Button variant="outline" asChild className="w-full justify-start">
                  <Link href="/login" className="cursor-pointer">
                    {t('common:login')}
                  </Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild className="w-full justify-start">
                  <Link href="/register" className="cursor-pointer">
                    {t('common:register')}
                  </Link>
                </Button>
              </SheetClose>
            </div>
          )}
        </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}