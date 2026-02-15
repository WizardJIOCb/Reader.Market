import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, BookOpen, Home, Users, Search, FolderOpen, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface NavigationProps {
  scrollY: number;
}

const navItems = [
  { name: 'Home', href: '#home', icon: Home },
  { name: 'Books', href: '#books', icon: BookOpen },
  { name: 'How It Works', href: '#how-it-works', icon: FileText },
  { name: 'Features', href: '#features', icon: Search },
  { name: 'Collections', href: '#collections', icon: FolderOpen },
  { name: 'Users', href: '#users', icon: Users },
];

export default function Navigation({ scrollY }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isScrolled = scrollY > 50;

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
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <User className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white font-medium"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </motion.button>
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
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full justify-center bg-primary hover:bg-primary/90" onClick={() => setIsOpen(false)}>
                    Get Started — Free
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
