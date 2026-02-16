import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, BookOpen, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

interface PlatformStats {
  users: number;
  books: number;
  articles: number;
  activities: number;
  news: number;
}

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 2000, startAnimation: boolean = true) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!startAnimation || end === 0) {
      setCount(end);
      return;
    }
    
    countRef.current = 0;
    startTimeRef.current = null;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * end);
      
      if (currentCount !== countRef.current) {
        countRef.current = currentCount;
        setCount(currentCount);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    
    requestAnimationFrame(animate);
  }, [end, duration, startAnimation]);
  
  return count;
}

// Animated stat component
function AnimatedStat({ value, label, delay }: { value: number | null; label: string; delay: number }) {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const animatedValue = useAnimatedCounter(value || 0, 2000, shouldAnimate && value !== null);
  
  useEffect(() => {
    if (value !== null) {
      const timer = setTimeout(() => setShouldAnimate(true), delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="text-center"
    >
      <div className="text-3xl sm:text-4xl font-bold text-gradient mb-1">
        {value === null ? '...' : formatNumber(animatedValue)}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// OAuth Provider Icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const VKIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48" fill="currentColor">
    <path d="M0 23.04C0 12.1788 0 6.74826 3.37413 3.37413C6.74826 0 12.1788 0 23.04 0H24.96C35.8212 0 41.2517 0 44.6259 3.37413C48 6.74826 48 12.1788 48 23.04V24.96C48 35.8212 48 41.2517 44.6259 44.6259C41.2517 48 35.8212 48 24.96 48H23.04C12.1788 48 6.74826 48 3.37413 44.6259C0 41.2517 0 35.8212 0 24.96V23.04Z" fill="#0077FF"/>
    <path d="M25.54 34.5801C14.6 34.5801 8.3601 27.0801 8.1001 14.6001H13.5801C13.7601 23.7601 17.8001 27.6401 21.0601 28.4401V14.6001H26.1601V22.5001C29.3801 22.1601 32.7601 18.5601 33.8201 14.6001H38.9201C38.0601 19.4801 34.4601 23.0801 31.8801 24.5601C34.4601 25.7601 38.5601 28.9601 40.1201 34.5801H34.4601C33.2601 30.7801 30.2601 27.8401 26.1601 27.4201V34.5801H25.54Z" fill="white"/>
  </svg>
);

// OAuth Login Section Component
function OAuthLoginSection() {
  const { t } = useTranslation('landing');

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `/auth/${provider}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.8 }}
      className="mt-12 pt-8 border-t border-white/5"
    >
      <p className="text-sm text-muted-foreground mb-4 text-center">
        {t('joinCommunity')}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleOAuthLogin('google')}
          className="w-full sm:w-auto bg-white hover:bg-white/90 text-slate-800 border-white/20 font-medium px-6"
        >
          <GoogleIcon />
          <span className="ml-2">{t('continueWithGoogle')}</span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleOAuthLogin('vk')}
          className="w-full sm:w-auto bg-[#0077FF] hover:bg-[#0077FF]/90 text-white border-[#0077FF]/50 font-medium px-6"
        >
          <VKIcon />
          <span className="ml-2">{t('continueWithVK')}</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-4 text-center">
        {t('or')}{' '}
        <Link href="/register" className="text-accent hover:underline">
          {t('registerWithEmail')}
        </Link>
      </p>
    </motion.div>
  );
}

export default function Hero() {
  const { t } = useTranslation('landing');
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = import.meta.env.DEV
          ? 'http://localhost:5001/api/stats/platform'
          : '/api/stats/platform';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setPlatformStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
      }
    };
    fetchStats();
  }, []);

  const stats = [
    { value: platformStats?.users ?? null, label: t('statsActiveReaders') },
    { value: platformStats?.books ?? null, label: t('statsBooks') },
    { value: platformStats?.articles ?? null, label: t('statsArticles') },
    { value: platformStats?.news ?? null, label: t('statsNews') },
    { value: platformStats?.activities ?? null, label: t('statsActivities') },
  ];

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(265 85% 60% / 0.15) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(35 95% 55% / 0.12) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(265 85% 60% / 0.1) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, 30, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('nowWithAdvancedAI')}
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-6"
          >
            <span className="text-white">{t('aiPowered')}</span>
            <br />
            <span className="text-gradient">{t('readingExperience')}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed"
          >
            {t('heroDescription')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register">
              <Button
                size="lg"
                className="group bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-6 text-lg rounded-xl glow-green transition-all"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                {t('getStarted')}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="group font-semibold px-8 py-6 text-lg rounded-xl border-white/20 hover:bg-white/5 transition-all"
              >
                <Zap className="w-5 h-5 mr-2 text-accent" />
                {t('seeHowItWorks')}
              </Button>
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 pt-16 border-t border-white/5"
          >
            <div className="flex flex-wrap justify-center gap-4 sm:grid sm:grid-cols-5 sm:gap-8">
              {stats.map((stat, index) => (
                <div key={stat.label} className="w-[30%] sm:w-auto">
                  <AnimatedStat
                    value={stat.value}
                    label={stat.label}
                    delay={0.5 + index * 0.1}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* OAuth Login Buttons - Only for non-authenticated users */}
          <OAuthLoginSection />
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
