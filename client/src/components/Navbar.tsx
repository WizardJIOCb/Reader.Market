import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Search, User, Menu, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileMenu } from '@/components/MobileMenu';
import { onSocketEvent } from '@/lib/socket';
import { useTranslation } from 'react-i18next';

export function Navbar() {
  const { user, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation(['navigation', 'common']);

  // Fetch unread message count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        // Use direct backend URL in development to bypass Vite proxy
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/messages/unread-count'
          : '/api/messages/unread-count';
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    // Poll for updates every 30 seconds as fallback
    const interval = setInterval(fetchUnreadCount, 30000);
    
    // Listen for real-time notification events
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      if (data.type === 'new_message') {
        // Increment unread count immediately
        setUnreadCount(prev => prev + 1);
      }
    });
    
    // Listen for manual unread count updates (when user views messages)
    const handleUpdateUnreadCount = () => {
      fetchUnreadCount();
    };
    window.addEventListener('update-unread-count', handleUpdateUnreadCount);
    
    return () => {
      clearInterval(interval);
      cleanupNotification();
      window.removeEventListener('update-unread-count', handleUpdateUnreadCount);
    };
  }, [user]);

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
                  {t('navigation:home')}
                </Link>
                <Link href="/search" className="flex items-center gap-2 text-sm hover:text-primary transition-colors cursor-pointer">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('navigation:search')}</span>
                </Link>
                <Link href="/shelves" className="text-sm hover:text-primary transition-colors cursor-pointer">
                  {t('navigation:shelves')}
                </Link>
                <Link href="/" className="text-sm hover:text-primary transition-colors cursor-pointer">
                  {t('navigation:about')}
                </Link>
                <Link href="/messages" className="flex items-center gap-2 text-sm hover:text-primary transition-colors cursor-pointer relative">
                  <div className="relative">
                    <MessageCircle className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 px-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] p-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </div>
                  <span className="hidden sm:inline">{t('navigation:messages')}</span>
                </Link>
                <Link href={`/profile/${user.id}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors cursor-pointer">
                  <User className="w-4 h-4" />
                  <span>{t('navigation:profile')} ({user.username})</span>
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/login" className="cursor-pointer">{t('common:login')}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register" className="cursor-pointer">{t('common:register')}</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
