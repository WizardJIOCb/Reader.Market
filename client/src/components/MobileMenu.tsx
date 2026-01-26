import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Menu, BookOpen, Search, User, X, MessageCircle, Globe, Check, Rss, Shield, Home, Info, BookMarked, Users, Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { onSocketEvent } from '@/lib/socket';

export function MobileMenu() {
  const { user, isLoading, refreshUser } = useAuth();
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  // Helper function to check if a route is active
  const isActive = (path: string, exact = true) => {
    if (exact) {
      return location === path;
    }
    return location.startsWith(path);
  };

  // Get current section name based on location
  const getCurrentSectionName = () => {
    if (location === '/') return t('navigation:about');
    if (location === '/home') return t('navigation:home');
    if (location === '/stream') return t('navigation:stream');
    if (location === '/users') return t('navigation:users');
    if (location === '/search') return t('navigation:search');
    if (location === '/shelves') return t('navigation:shelves');
    if (location.startsWith('/messages')) return t('navigation:messages');
    if (location.startsWith('/profile')) return t('navigation:profile');
    if (location.startsWith('/admin')) return t('navigation:adminPanel');
    if (location.startsWith('/book/')) return t('navigation:home');
    if (location.startsWith('/read/')) return t('navigation:home');
    if (location.startsWith('/news')) return t('navigation:about');
    return '';
  };

  // Language configuration with flag indicators using colored blocks
  const LANGUAGES = [
    { 
      code: 'en', 
      icon: (
        <div className="relative w-5 h-5 rounded-sm border border-gray-300 overflow-hidden flex-shrink-0" style={{ backgroundColor: '#B22234' }}>
          <div className="absolute top-0 left-0 w-full h-full flex flex-col">
            <div className="w-full flex-1 bg-[#B22234]"></div>
            <div className="w-full flex-1 bg-white"></div>
            <div className="w-full flex-1 bg-[#B22234]"></div>
            <div className="w-full flex-1 bg-white"></div>
            <div className="w-full flex-1 bg-[#B22234]"></div>
            <div className="w-full flex-1 bg-white"></div>
            <div className="w-full flex-1 bg-[#B22234]"></div>
          </div>
          <div className="absolute top-0 left-0 w-[45%] h-[55%] bg-[#3C3B6E]"></div>
        </div>
      ),
      name: 'English' 
    },
    { 
      code: 'ru', 
      icon: (
        <div className="flex flex-col w-5 h-5 rounded-sm border border-gray-300 overflow-hidden flex-shrink-0">
          <div className="h-1/3 bg-white"></div>
          <div className="h-1/3 bg-[#0039A6]"></div>
          <div className="h-1/3 bg-[#D52B1E]"></div>
        </div>
      ),
      name: 'Русский' 
    },
  ];

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === i18n.language) return;
    
    try {
      await i18n.changeLanguage(newLanguage);
      
      if (user) {
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/profile/language'
          : '/api/profile/language';
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ language: newLanguage })
        });
        
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('userData', JSON.stringify(data.user));
          if (refreshUser) {
            await refreshUser();
          }
        }
      }
      
      localStorage.setItem('i18nextLng', newLanguage);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
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
      <div className="p-4">
        <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-foreground flex items-center gap-2 w-auto px-2">
          <span className="text-base font-medium text-[#263542]">{getCurrentSectionName()}</span>
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
          {/* Show navigation menu for all users */}
          <SheetClose asChild>
            <Link 
              href="/home" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/home') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/home') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/home') ? 'page' : undefined}
            >
              <Home className="w-4 h-4" />
              {t('navigation:home')}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link 
              href="/stream" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/stream') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/stream') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/stream') ? 'page' : undefined}
            >
              <Rss className="w-4 h-4" />
              {t('navigation:stream')}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link 
              href="/users" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/users') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/users') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/users') ? 'page' : undefined}
            >
              <Users className="w-4 h-4" />
              {t('navigation:users')}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link 
              href="/collections" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/collections') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/collections') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/collections') ? 'page' : undefined}
            >
              <Bookmark className="w-4 h-4" />
              Коллекции
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link 
              href="/search" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/search') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/search') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/search') ? 'page' : undefined}
            >
              <Search className="w-4 h-4" />
              {t('navigation:search')}
            </Link>
          </SheetClose>
          {user && (
            <SheetClose asChild>
              <Link 
                href="/shelves" 
                className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                  isActive('/shelves') ? 'bg-[#f1680c]/10' : ''
                }`}
                style={isActive('/shelves') ? { color: '#f1680c' } : {}}
                aria-current={isActive('/shelves') ? 'page' : undefined}
              >
                <BookMarked className="w-4 h-4" />
                {t('navigation:shelves')}
              </Link>
            </SheetClose>
          )}
          <SheetClose asChild>
            <Link 
              href="/" 
              className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                isActive('/') ? 'bg-[#f1680c]/10' : ''
              }`}
              style={isActive('/') ? { color: '#f1680c' } : {}}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              <Info className="w-4 h-4" />
              {t('navigation:about')}
            </Link>
          </SheetClose>
          {user && (
            <SheetClose asChild>
              <Link 
                href="/messages" 
                className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                  isActive('/messages', false) ? 'bg-[#f1680c]/10' : ''
                }`}
                style={isActive('/messages', false) ? { color: '#f1680c' } : {}}
                aria-current={isActive('/messages', false) ? 'page' : undefined}
              >
                <div className="relative">
                  <MessageCircle className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 px-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] p-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </div>
                {t('navigation:messages')}
              </Link>
            </SheetClose>
          )}
          {user ? (
            <SheetClose asChild>
              <Link 
                href={`/profile/${user.username}`} 
                className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                  isActive('/profile', false) ? 'bg-[#f1680c]/10' : ''
                }`}
                style={isActive('/profile', false) ? { color: '#f1680c' } : {}}
                aria-current={isActive('/profile', false) ? 'page' : undefined}
              >
                <User className="w-4 h-4" />
                {t('navigation:profile')} ({user.username})
              </Link>
            </SheetClose>
          ) : (
            <SheetClose asChild>
              <Link 
                href="/login" 
                className="px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                {t('navigation:profile')}
              </Link>
            </SheetClose>
          )}
          {user && (user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
            <SheetClose asChild>
              <Link 
                href="/admin" 
                className={`px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center gap-2 ${
                  isActive('/admin', false) ? 'bg-[#f1680c]/10' : ''
                }`}
                style={isActive('/admin', false) ? { color: '#f1680c' } : {}}
                aria-current={isActive('/admin', false) ? 'page' : undefined}
              >
                <Shield className="w-4 h-4" />
                {t('navigation:adminPanel')}
              </Link>
            </SheetClose>
          )}
          
          {/* Language Switcher Section */}
          <div className="px-6 py-3 text-sm font-medium text-muted-foreground border-b border-muted flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('navigation:language')}
          </div>
          {LANGUAGES.map((lang) => {
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center justify-between ${
                  i18n.language === lang.code ? 'bg-[#f1680c]/10' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {lang.icon}
                  <span>{lang.name}</span>
                </div>
                {i18n.language === lang.code && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            );
          })}
        </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}