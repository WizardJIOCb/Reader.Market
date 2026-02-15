import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Search, 
  Upload, 
  Lightbulb, 
  Bookmark, 
  MessageSquare, 
  Star, 
  Users 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const { t } = useTranslation('landing');

  const steps = [
    {
      icon: Sparkles,
      title: t('step1Title'),
      description: t('step1Description'),
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: Search,
      title: t('step2Title'),
      description: t('step2Description'),
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Upload,
      title: t('step3Title'),
      description: t('step3Description'),
      color: 'from-green-500 to-green-600',
    },
    {
      icon: Lightbulb,
      title: t('step4Title'),
      description: t('step4Description'),
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: Bookmark,
      title: t('step5Title'),
      description: t('step5Description'),
      color: 'from-pink-500 to-rose-500',
    },
    {
      icon: MessageSquare,
      title: t('step6Title'),
      description: t('step6Description'),
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: Star,
      title: t('step7Title'),
      description: t('step7Description'),
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: Users,
      title: t('step8Title'),
      description: t('step8Description'),
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
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
            <span className="text-white">{t('howIt')}</span>{' '}
            <span className="text-gradient">{t('works')}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('howItWorksSubtitle')}
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <div className="group relative h-full">
                {/* Card */}
                <div className="relative h-full p-6 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 group-hover:glow-purple">
                  {/* Step Number */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-gradient transition-all">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Connection Line (except last item in row) */}
                {(index + 1) % 4 !== 0 && index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-white/20 to-transparent" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
