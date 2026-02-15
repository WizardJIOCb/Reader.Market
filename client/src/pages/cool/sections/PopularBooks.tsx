import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageCircle, Eye, BookOpen, Library, Heart, Flame, Frown, ThumbsUp, Smile, Meh } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

const reactionIconMap: Record<string, React.ElementType> = {
  '❤️': Heart,
  '🔥': Flame,
  '😢': Frown,
  '👍': ThumbsUp,
  '😊': Smile,
  '😐': Meh,
  heart: Heart,
  fire: Flame,
  sad: Frown,
  thumbsUp: ThumbsUp,
  smile: Smile,
  meh: Meh,
};

const PLACEHOLDER_COVER = 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop';

export default function PopularBooks() {
  const { t } = useTranslation('landing');
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const apiUrl = import.meta.env.DEV
          ? 'http://localhost:5001/api/books/search?q=&sortBy=createdAt&sortDir=desc'
          : '/api/books/search?q=&sortBy=createdAt&sortDir=desc';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setBooks(data.slice(0, 4));
        }
      } catch (error) {
        console.error('Failed to fetch popular books:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const getGenres = (genre: any): string[] => {
    if (!genre) return [];
    if (Array.isArray(genre)) return genre;
    return genre.split(',').map((g: string) => g.trim()).filter(Boolean);
  };

  return (
    <section id="books" className="py-24 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">{t('popular')}</span>{' '}
            <span className="text-gradient">{t('books')}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('popularBooksSubtitle')}
          </p>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-gradient-card border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Books Grid */}
        {!loading && books.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {books.map((book, index) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="h-full"
              >
                <div className="group relative h-full bg-gradient-card rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple">
                  <div className="flex flex-col sm:flex-row h-full">
                    {/* Book Cover */}
                    <div className="relative w-full sm:w-48 h-64 sm:h-auto flex-shrink-0 overflow-hidden">
                      <motion.img
                        src={book.coverImageUrl || PLACEHOLDER_COVER}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.4 }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent sm:bg-gradient-to-r" />

                      {/* Rating Badge */}
                      {book.rating && (
                        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                          <Star className="w-4 h-4 fill-accent text-accent" />
                          <span className="text-sm font-bold text-white">{book.rating}</span>
                        </div>
                      )}
                    </div>

                    {/* Book Info */}
                    <div className="flex-1 p-5 sm:p-6 flex flex-col">
                      {/* Title & Author */}
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gradient transition-all line-clamp-1">
                        {book.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                        {book.author}
                      </p>

                      {/* Description */}
                      {book.description && (
                        <p className="text-sm text-muted-foreground/80 mb-4 line-clamp-2">
                          {book.description}
                        </p>
                      )}

                      {/* Genres */}
                      {getGenres(book.genre).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {getGenres(book.genre).slice(0, 3).map((genre: string) => (
                            <Badge
                              key={genre}
                              variant="secondary"
                              className="text-xs bg-white/5 text-muted-foreground hover:bg-white/10"
                            >
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                        {book.commentCount != null && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {book.commentCount}
                          </span>
                        )}
                        {book.cardViewCount != null && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {book.cardViewCount}
                          </span>
                        )}
                        {book.readerOpenCount != null && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {book.readerOpenCount}
                          </span>
                        )}
                        {book.shelfCount != null && (
                          <span className="flex items-center gap-1">
                            <Library className="w-4 h-4" />
                            {book.shelfCount}
                          </span>
                        )}
                      </div>

                      {/* Reactions */}
                      {book.reactions && book.reactions.length > 0 && (
                        <div className="flex items-center gap-2 mb-4">
                          {book.reactions.map((reaction: any) => {
                            const Icon = reactionIconMap[reaction.emoji];
                            return Icon ? (
                              <span
                                key={reaction.emoji}
                                className="flex items-center gap-1 text-sm text-muted-foreground"
                              >
                                <Icon className="w-4 h-4" />
                                {reaction.count}
                              </span>
                            ) : (
                              <span
                                key={reaction.emoji}
                                className="flex items-center gap-1 text-sm text-muted-foreground"
                              >
                                <span>{reaction.emoji}</span>
                                {reaction.count}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Progress & Actions */}
                      <div className="space-y-3 mt-auto">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t('progress')}</span>
                          <span className="text-muted-foreground">
                            {book.readingProgress?.percentage > 0
                              ? `${Math.round(book.readingProgress.percentage)}%`
                              : t('notStartedYet')}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                            style={{ width: `${book.readingProgress?.percentage || 0}%` }}
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Link href={`/read/${book.id}`}>
                            <Button
                              size="sm"
                              className="flex-1 bg-primary hover:bg-primary/90 text-white"
                            >
                              <BookOpen className="w-4 h-4 mr-2" />
                              {t('read')}
                            </Button>
                          </Link>
                          <Link href={`/book/${book.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 hover:bg-white/5"
                            >
                              {t('details')}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && books.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">{t('noBooksAvailable')}</p>
          </div>
        )}

        {/* View All Button */}
        {!loading && books.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-12"
          >
            <Link href="/home">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 hover:bg-white/5 px-8"
              >
                {t('viewAllBooks')}
                <BookOpen className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
