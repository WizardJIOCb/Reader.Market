import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Briefcase, Brain, Check } from 'lucide-react';

const audiences = [
  {
    icon: BookOpen,
    title: 'Non-fiction readers',
    description: 'Dive deeper into complex topics with AI-powered insights and summaries.',
    features: ['Chapter summaries', 'Key concept extraction', 'Quick reference'],
  },
  {
    icon: GraduationCap,
    title: 'Students & lifelong learners',
    description: 'Accelerate your learning and retain more information from every book.',
    features: ['Study aids', 'Note organization', 'Progress tracking'],
  },
  {
    icon: Briefcase,
    title: 'Professionals who read to grow',
    description: 'Stay ahead in your field with efficient knowledge absorption.',
    features: ['Industry insights', 'Skill development', 'Time efficiency'],
  },
  {
    icon: Brain,
    title: 'People who want to remember',
    description: 'Transform reading into lasting knowledge with our retention tools.',
    features: ['Spaced repetition', 'Smart bookmarks', 'Review reminders'],
  },
];

export default function TargetAudience() {
  return (
    <section id="users" className="py-24 lg:py-32 relative overflow-hidden">
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
            <span className="text-white">Who It Is</span>{' '}
            <span className="text-gradient">For</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Perfect for readers who want to maximize their learning
          </p>
        </motion.div>

        {/* Audience Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((audience, index) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="group h-full p-6 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <audience.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gradient transition-all">
                  {audience.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {audience.description}
                </p>

                {/* Features */}
                <ul className="space-y-2">
                  {audience.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
