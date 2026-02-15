import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, BookOpen, Home, Users, Search, FolderOpen, FileText, User, MessageSquare, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import { onSocketEvent } from '@/lib/socket';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavigationProps {
  scrollY: number;
}

export default function Navigation({ scrollY }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isScrolled = scrollY > 50;
  const { user } = useAuth();
  const { t, i18n } = useTranslation('landing');
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { name: t('navBooks'), href: '#books', icon: BookOpen },
    { name: t('navHowItWorks'), href: '#how-it-works', icon: FileText },
    { name: t('navFeatures'), href: '#features', icon: Search },
    { name: t('navCollections'), href: '#collections', icon: FolderOpen },
    { name: t('navUsers'), href: '#users', icon: Users },
  ];

  // Fetch unread message count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
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

    const cleanupUnreadUpdate = onSocketEvent('unread-count:update', (data) => {
      setUnreadCount(data.count);
    });

    const cleanupNotification = onSocketEvent('notification:new', (data) => {
      if (data.type === 'new_message') {
        fetchUnreadCount();
      }
    });

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

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <motion.a
            href="#home"
            className="flex items-center gap-3 group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl group-hover:blur-2xl transition-all" />
            </div>
            <span className="text-xl font-bold text-gradient">
              Reader.Market
            </span>
          </motion.a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <motion.a
                key={item.name}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.name}
              </motion.a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2">
            

            {/* Messages - temporarily disabled
            {user && (
              <Link href="/messages">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground relative"
                >
                  <MessageSquare className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-[10px] font-bold text-background rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
            */}
            

            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <User className="w-4 h-4 mr-2" />
                {t('signIn')}
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-black font-medium"
              >
                {t('getStarted')}
              </Button>
            </Link>

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground px-3 h-8 rounded-md text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span>{i18n.language === 'ru' ? 'RU' : 'EN'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('ru')}>
                  Русский
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Mobile Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground px-3 h-8 rounded-md text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span>{i18n.language === 'ru' ? 'RU' : 'EN'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('ru')}>
                  Русский
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Messages - temporarily disabled
            {user && (
              <Link href="/messages">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground relative p-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-[10px] font-bold text-background rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
            */}

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-white/5"
          >
            <nav className="px-4 py-4 space-y-1">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </motion.a>
              ))}
              <div className="pt-4 space-y-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full justify-center" onClick={() => setIsOpen(false)}>
                    <User className="w-4 h-4 mr-2" />
                    {t('signIn')}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full justify-center bg-primary hover:bg-primary/90 text-black" onClick={() => setIsOpen(false)}>
                    {t('getStarted')}
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
