import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from './sections/Navigation';
import Hero from './sections/Hero';
import PopularBooks from './sections/PopularBooks';
import HowItWorks from './sections/HowItWorks';
import AIFeatures from './sections/AIFeatures';
import WhyChooseUs from './sections/WhyChooseUs';
import TargetAudience from './sections/TargetAudience';
import FormatsRoadmap from './sections/FormatsRoadmap';
import LatestNews from './sections/LatestNews';
import Footer from './sections/Footer';

function App() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
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
            <AIFeatures />
            <WhyChooseUs />
            <TargetAudience />
            <FormatsRoadmap />
            <LatestNews />
          </main>
          <Footer />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
