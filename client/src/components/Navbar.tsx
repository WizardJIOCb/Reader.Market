import React from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Search, User, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileMenu } from '@/components/MobileMenu';

export function Navbar() {
  const { user, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <nav className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 cursor-pointer">
            <img src="/favicon.png" alt="Reader.Market Logo" className="w-6 h-6" />
            Reader.Market
          </Link>
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-background border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 cursor-pointer">
          <img src="/favicon.png" alt="Reader.Market Logo" className="w-6 h-6" />
          Reader.Market
        </Link>
        
        {isMobile ? (
          <MobileMenu />
        ) : (
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/home" className="text-sm hover:text-primary transition-colors cursor-pointer">
                  Главная
                </Link>
                <Link href="/search" className="flex items-center gap-2 text-sm hover:text-primary transition-colors cursor-pointer">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Поиск</span>
                </Link>
                <Link href="/shelves" className="text-sm hover:text-primary transition-colors cursor-pointer">
                  Мои полки
                </Link>
                <Link href="/" className="text-sm hover:text-primary transition-colors cursor-pointer">
                  О проекте
                </Link>
                <Link href={`/profile/${user.id}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors cursor-pointer">
                  <User className="w-4 h-4" />
                  <span>Профиль ({user.username})</span>
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/login" className="cursor-pointer">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/register" className="cursor-pointer">Register</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
