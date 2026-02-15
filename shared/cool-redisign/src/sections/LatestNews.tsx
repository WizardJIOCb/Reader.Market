import { motion } from 'framer-motion';
import { MessageSquare, Eye, Heart, ArrowRight, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const news = [
  {
    id: 1,
    title: 'Reader.Market Dev News — Feb 15, 2026',
    author: 'Rodion',
    date: '15.02.2026',
    excerpt: 'Book Chat is now "complete": API + WebSockets + attachments. New REST endpoints for fetching messages and online users.',
    content: 'Commit 290d7f6 turns book chat into a full realtime feature with WebSockets support, attachment handling, and improved API endpoints.',
    stats: {
      views: 10,
      likes: 1,
      comments: 0,
    },
    tags: ['Update', 'Feature'],
  },
  {
    id: 2,
    title: 'AI Summaries 2.0 Released',
    author: 'Team',
    date: '10.02.2026',
    excerpt: 'Major upgrade to our AI summarization engine with improved accuracy and support for more languages.',
    content: 'Our new AI model delivers 40% more accurate summaries with better context understanding and multi-language support.',
    stats: {
      views: 156,
      likes: 23,
      comments: 8,
    },
    tags: ['AI', 'Major Update'],
  },
  {
    id: 3,
    title: 'New Book Collection Features',
    author: 'Rodion',
    date: '01.02.2026',
    excerpt: 'Create and share book collections with the community. New sorting and filtering options available.',
    content: 'Organize your books into collections, share them with friends, and discover collections from other readers.',
    stats: {
      views: 89,
      likes: 15,
      comments: 4,
    },
    tags: ['Feature', 'Collections'],
  },
];

export default function LatestNews() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
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
            <span className="text-white">Latest</span>{' '}
            <span className="text-gradient">News</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with our latest announcements and features
          </p>
        </motion.div>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, index) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full p-6 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple flex flex-col">
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gradient transition-all line-clamp-2">
                  {item.title}
                </h3>

                {/* Excerpt */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
                  {item.excerpt}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {item.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {item.date}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-4 border-t border-white/5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {item.stats.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {item.stats.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {item.stats.comments}
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Button
            variant="outline"
            className="border-white/20 hover:bg-white/5 px-8"
          >
            View All News
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
