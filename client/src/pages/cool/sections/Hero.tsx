import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, BookOpen, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-8">
              {stats.map((stat, index) => (
                <AnimatedStat
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  delay={0.5 + index * 0.1}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
