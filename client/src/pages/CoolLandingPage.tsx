import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from './cool/sections/Navigation';
import Hero from './cool/sections/Hero';
import PopularBooks from './cool/sections/PopularBooks';
import HowItWorks from './cool/sections/HowItWorks';
import AIFeatures from './cool/sections/AIFeatures';
import WhyChooseUs from './cool/sections/WhyChooseUs';
import TargetAudience from './cool/sections/TargetAudience';
import FormatsRoadmap from './cool/sections/FormatsRoadmap';
import LatestNews from './cool/sections/LatestNews';
import Footer from './cool/sections/Footer';

export default function CoolLandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="cool-theme min-h-screen bg-background text-foreground overflow-x-hidden">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Navigation scrollY={scrollY} />
          <main>
            <Hero />
            <PopularBooks />
            <HowItWorks />
            <LatestNews />
            <AIFeatures />
            <WhyChooseUs />
            <TargetAudience />
            <FormatsRoadmap />
          </main>
          <Footer />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
