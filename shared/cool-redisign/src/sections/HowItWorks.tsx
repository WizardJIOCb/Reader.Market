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

const steps = [
  {
    icon: Sparkles,
    title: 'Read with AI assistance',
    description: 'Get summaries, key ideas, and explanations as you read.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Search,
    title: 'Search available books',
    description: 'Find books already in our community library.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Upload,
    title: 'Upload your book',
    description: 'Add your own books to your personal library (multiple formats supported).',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: Lightbulb,
    title: 'Remember more & discover',
    description: 'Save insights and get recommendations based on what you actually read.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: Bookmark,
    title: 'Bookmarks & Collections',
    description: 'Create personal book collections and manage bookmarks for easy access.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: MessageSquare,
    title: 'In-book Chat',
    description: 'Discuss books in real-time with other readers right within the text.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Star,
    title: 'Book Ratings',
    description: 'Rate books on a 10-point scale and view community ratings.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Users,
    title: 'User Ratings',
    description: 'Give and receive feedback on other readers based on their activity.',
    color: 'from-indigo-500 to-purple-500',
  },
];

export default function HowItWorks() {
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
            <span className="text-white">How It</span>{' '}
            <span className="text-gradient">Works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Eight simple steps to enhance your reading experience with AI-powered insights
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
