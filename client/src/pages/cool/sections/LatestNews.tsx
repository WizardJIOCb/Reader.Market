import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Eye, Heart, ArrowRight, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function LatestNews() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const apiUrl = import.meta.env.DEV
          ? 'http://localhost:5001/api/news'
          : '/api/news';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setNews(data.slice(0, 3));
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getExcerpt = (content: string | null, maxLen = 150) => {
    if (!content) return '';
    const stripped = content.replace(/<[^>]*>/g, '');
    return stripped.length > maxLen ? stripped.substring(0, maxLen) + '...' : stripped;
  };

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

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-gradient-card border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* News Grid */}
        {!loading && news.length > 0 && (
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
                <Link href={`/news/${item.id}`}>
                  <div className="h-full p-6 rounded-2xl bg-gradient-card border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple flex flex-col cursor-pointer">
                    {/* Title */}
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gradient transition-all line-clamp-2">
                      {item.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
                      {getExcerpt(item.content)}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      {item.author && (
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {item.author}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(item.publishedAt || item.createdAt)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 pt-4 border-t border-white/5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {item.viewCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {item.reactionCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {item.commentCount ?? 0}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && news.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No news available yet</p>
          </div>
        )}

        {/* View All Button */}
        {!loading && news.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-12"
          >
            <Link href="/news">
              <Button
                variant="outline"
                className="border-white/20 hover:bg-white/5 px-8"
              >
                View All News
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
