import { motion } from 'framer-motion';
import { Brain, Library, Shield, BookOpen, MessageCircle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WhyChooseUs() {
  const { t } = useTranslation('landing');

  const reasons = [
    {
      icon: Brain,
      title: t('benefit1Title'),
      subtitle: t('benefit1Subtitle'),
      description: t('benefit1Description'),
    },
    {
      icon: Library,
      title: t('benefit2Title'),
      subtitle: t('benefit2Subtitle'),
      description: t('benefit2Description'),
    },
    {
      icon: Shield,
      title: t('benefit3Title'),
      subtitle: t('benefit3Subtitle'),
      description: t('benefit3Description'),
    },
    {
      icon: BookOpen,
      title: t('benefit4Title'),
      subtitle: t('benefit4Subtitle'),
      description: t('benefit4Description'),
    },
    {
      icon: MessageCircle,
      title: t('benefit5Title'),
      subtitle: t('benefit5Subtitle'),
      description: t('benefit5Description'),
    },
    {
      icon: Star,
      title: t('benefit6Title'),
      subtitle: t('benefit6Subtitle'),
      description: t('benefit6Description'),
    },
  ];

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, hsl(35 95% 55% / 0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">{t('why')}</span>{' '}
            <span className="text-gradient">Reader.market</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('whyReaderMarketSubtitle')}
          </p>
        </motion.div>

        {/* Reasons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason, index) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <div className="group h-full p-6 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-green">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <reason.icon className="w-6 h-6 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-gradient transition-all">
                  {reason.title}
                </h3>
                <p className="text-sm text-accent font-medium mb-3">
                  {reason.subtitle}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
