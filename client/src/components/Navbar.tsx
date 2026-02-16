import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Search, User, Menu, MessageCircle, Rss, Shield, Home, Info, BookMarked, Users, Bookmark, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useResponsive } from '@/hooks/use-responsive';
import { MobileMenu } from '@/components/MobileMenu';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { onSocketEvent } from "@/lib/socket";
import { useTranslation } from "react-i18next";
import { scrollToAnchor } from '@/utils/scrollToAnchor';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Navbar() {
  const { user, isLoading } = useAuth();
  const { showMobileMenu, hideTextItems } = useResponsive();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation(['navigation', 'common']);
  const [location] = useLocation();
  
  // Debug logging
  useEffect(() => {
    
  }, [user, isLoading]);

  // Helper function to check if a route is active
  const isActive = (path: string, exact = true) => {
    if (exact) {
      return location === path;
    }
    return location.startsWith(path);
  };

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
    
    // Listen for real-time unread count updates via WebSocket
    const cleanupUnreadUpdate = onSocketEvent('unread-count:update', (data) => {
      
      setUnreadCount(data.count);
    });
    
    // Listen for notification events as fallback
    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      if (data.type === 'new_message') {
        // Fallback: fetch count from API if WebSocket update wasn't received
        fetchUnreadCount();
      }
    });
    
    // Listen for manual unread count updates (when user views messages)
    const handleUpdateUnreadCount = () => {
      fetchUnreadCount();
    };
    window.addEventListener('update-unread-count', handleUpdateUnreadCount);
    
    return () => {
      cleanupUnreadUpdate();
      cleanupNotification();
      window.removeEventListener('update-unread-count', handleUpdateUnreadCount);
    };
  }, [user]);

  if (isLoading) {
    return (
      <nav className="bg-background border-b fixed top-0 left-0 right-0 z-50">
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
    <nav className="bg-background border-b fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 cursor-pointer">
            <img src="/favicon.png" alt="Reader.Market Logo" className="w-6 h-6" />
            Reader.Market
          </Link>
          {user && (user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
            <Link 
              href="/admin" 
              className={`transition-colors cursor-pointer ${isActive('/admin', false) ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-label={t('navigation:adminPanel')}
              aria-current={isActive('/admin', false) ? 'page' : undefined}
              title={t('navigation:adminPanel')}
            >
              <Shield className="w-4 h-4" />
            </Link>
          )}
        </div>
        
        {showMobileMenu ? (
          <MobileMenu />
        ) : (
          <div className="flex items-center gap-3">
            {/* Show navigation menu for all users */}
            <Link 
              href="/" 
              onClick={(e) => {
                // If we're already on the homepage, scroll to how-it-works section
                if (location === '/') {
                  e.preventDefault();
                  scrollToAnchor('how-it-works');
                }
              }}
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/') ? 'page' : undefined}
              title={t('navigation:about')}
            >
              <Info className="w-4 h-4" />
              <span className="hidden">{t('navigation:about')}</span>
            </Link>
            <Link 
              href="/home" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/home') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/home') ? 'page' : undefined}
              title={t('navigation:home')}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:home')}</span>
            </Link>
            <Link 
              href="/stream" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/stream') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/stream') ? 'page' : undefined}
              title={t('navigation:stream')}
            >
              <Rss className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:stream')}</span>
            </Link>
            <Link 
              href="/users" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/users') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/users') ? 'page' : undefined}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:users')}</span>
            </Link>
            <Link 
              href="/search" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/search') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/search') ? 'page' : undefined}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:search')}</span>
            </Link>
            <Link 
              href="/collections" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/collections', false) ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/collections', false) ? 'page' : undefined}
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:collections')}</span>
            </Link>
            {user && (
              <Link 
                href="/shelves" 
                className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/shelves') ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
                aria-current={isActive('/shelves') ? 'page' : undefined}
              >
                <BookMarked className="w-4 h-4" />
                <span className="hidden sm:inline">{t('navigation:shelves')}</span>
              </Link>
            )}
            <Link 
              href="/articles" 
              className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/articles', false) ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
              aria-current={isActive('/articles', false) ? 'page' : undefined}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('navigation:articles')}</span>
            </Link>
            {user && (
              <Link 
                href="/messages" 
                className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/messages', false) ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
                aria-current={isActive('/messages', false) ? 'page' : undefined}
                title={t('navigation:messages')}
              >
                <div className="relative">
                  <MessageCircle className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 px-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] p-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </div>
                <span className={`${hideTextItems ? 'hidden' : 'hidden sm:inline'}`}>{t('navigation:messages')}</span>
              </Link>
            )}
            {user ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/profile/${user.username}`}
                      className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${isActive('/profile', false) ? 'text-[#f1680c] hover:text-[#236a1a]' : 'text-[#263542] hover:text-[#1d49ab]'}`}
                      aria-current={isActive('/profile', false) ? 'page' : undefined}
                    >
                      <User className="w-4 h-4" />
                      <span className={`${hideTextItems ? 'hidden' : 'hidden sm:inline'}`}>{t('navigation:profile')}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#f5f0e1] text-[#263542] border-[#d4c9a8]">
                    <p className="font-medium">{user.fullName || user.username}</p>
                    {user.fullName && <p className="text-xs text-[#5a5243]">@{user.username}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link href="/login" className="flex items-center gap-1 text-sm hover:text-primary transition-colors cursor-pointer text-[#263542]" title={t('navigation:profile')}>
                <User className="w-4 h-4" />
                <span className={`${hideTextItems ? 'hidden' : 'hidden 2xl:inline'}`}>{t('navigation:profile')}</span>
              </Link>
            )}
            <div className="-ml-2 -mt-0.5">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
