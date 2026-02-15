import { motion } from 'framer-motion';
import { FileText, Lightbulb, Zap, Compass } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Concise Chapter Summaries',
    description: 'Get AI-generated summaries of each chapter to quickly grasp key concepts without missing important details.',
    gradient: 'from-purple-500 to-indigo-500',
  },
  {
    icon: Lightbulb,
    title: 'Key Ideas & Insights',
    description: 'Extract important concepts and insights from your books automatically, organized for easy reference.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Zap,
    title: 'Understand Complex Books Faster',
    description: 'AI assistance helps you comprehend difficult material more efficiently with explanations and context.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Compass,
    title: 'Personalized Recommendations',
    description: 'Receive book suggestions based on your reading history, preferences, and learning goals.',
    gradient: 'from-pink-500 to-rose-500',
  },
];

export default function AIFeatures() {
  return (
    <section id="features" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, hsl(265 85% 60% / 0.2) 0%, transparent 70%)',
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
          >
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-muted-foreground">
              Powered by Advanced AI
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">What AI Helps</span>{' '}
            <span className="text-gradient">You Do</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful AI features to enhance your reading experience and maximize your learning
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="group relative h-full p-8 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple overflow-hidden">
                {/* Background Glow */}
                <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-500`} />

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-gradient transition-all">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative Line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
