import { motion } from 'framer-motion';
import { Star, MessageCircle, Eye, BookOpen, Library, Heart, Flame, Frown, ThumbsUp, Smile, Meh } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const books = [
  {
    id: 1,
    title: 'Сыны Императора',
    authors: 'Джон Френч, Аарон Дембски-Боуден, Ник Кайм, Грэм Макнилл, Дэн Абнетт, Крис Райт, Гай Хейли, Лори Голдинг',
    description: 'С момента таинственного появления Сынов Императора на свет и до ожесточенных битв, вспыхнувших после того, как половина легендарных примархов восстала против отца...',
    rating: 7.4,
    genres: ['Боевая фантастика', 'Героическое фэнтези', 'Технофэнтези'],
    stats: {
      comments: 11,
      views: 49,
      pages: 179,
      readers: 1,
    },
    reactions: {
      heart: 1,
      fire: 1,
      sad: 1,
    },
    cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop',
    progress: 0,
  },
  {
    id: 2,
    title: 'Звездные Войны',
    authors: 'Джордж Лукас',
    description: '«Звёздные войны» (1976), приписываемые Джорджу Лукасу — это новеллизация первого фильма (Эпизод IV: «Новая надежда»), написанная Аланом Дином Фостером...',
    rating: 7.4,
    genres: ['Космическая фантастика', 'Научная фантастика'],
    stats: {
      comments: 1,
      views: 66,
      pages: 21,
      readers: 2,
    },
    reactions: {
      thumbsUp: 1,
    },
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop',
    progress: 0,
  },
  {
    id: 3,
    title: 'Нейромант',
    authors: 'Уильям Гибсон',
    description: '"Нейромант" Уильяма Гибсона – самый знаменитый роман современной американской фантастики, каноническое произведение в жанре «киберпанк»...',
    rating: 7.3,
    genres: ['Киберпанк', 'Научная фантастика', 'Роман'],
    stats: {
      comments: 3,
      views: 21,
      pages: 39,
      readers: 1,
    },
    reactions: {
      thumbsUp: 1,
      fire: 1,
    },
    cover: 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=400&h=600&fit=crop',
    progress: 0,
  },
  {
    id: 4,
    title: 'Гиперион',
    authors: 'Дэн Симмонс',
    description: 'Гиперион — научно-фантастический роман американского писателя Дэна Симмонса 1989 года. Первая книга тетралогии «Песни Гипериона»...',
    rating: 7.3,
    genres: ['Научная фантастика', 'Роман', 'Космическая опера'],
    stats: {
      comments: 12,
      views: 165,
      pages: 102,
      readers: 7,
    },
    reactions: {
      fire: 2,
      sad: 1,
      meh: 1,
      smile: 1,
      heart: 1,
    },
    cover: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=600&fit=crop',
    progress: 0,
  },
];

const reactionIcons: Record<string, React.ElementType> = {
  heart: Heart,
  fire: Flame,
  sad: Frown,
  thumbsUp: ThumbsUp,
  smile: Smile,
  meh: Meh,
};

export default function PopularBooks() {
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
            <span className="text-white">Popular</span>{' '}
            <span className="text-gradient">Books</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most read and highly rated books from our community of passionate readers
          </p>
        </motion.div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {books.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="group relative bg-gradient-card rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-500 hover:glow-purple">
                <div className="flex flex-col sm:flex-row">
                  {/* Book Cover */}
                  <div className="relative w-full sm:w-48 h-64 sm:h-auto flex-shrink-0 overflow-hidden">
                    <motion.img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent sm:bg-gradient-to-r" />
                    
                    {/* Rating Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                      <Star className="w-4 h-4 fill-accent text-accent" />
                      <span className="text-sm font-bold text-white">{book.rating}</span>
                    </div>
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 p-5 sm:p-6">
                    {/* Title & Author */}
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gradient transition-all line-clamp-1">
                      {book.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                      {book.authors}
                    </p>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground/80 mb-4 line-clamp-2">
                      {book.description}
                    </p>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {book.genres.map((genre) => (
                        <Badge
                          key={genre}
                          variant="secondary"
                          className="text-xs bg-white/5 text-muted-foreground hover:bg-white/10"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {book.stats.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {book.stats.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {book.stats.pages}
                      </span>
                      <span className="flex items-center gap-1">
                        <Library className="w-4 h-4" />
                        {book.stats.readers}
                      </span>
                    </div>

                    {/* Reactions */}
                    <div className="flex items-center gap-2 mb-4">
                      {Object.entries(book.reactions).map(([type, count]) => {
                        const Icon = reactionIcons[type];
                        return Icon ? (
                          <span
                            key={type}
                            className="flex items-center gap-1 text-sm text-muted-foreground"
                          >
                            <Icon className="w-4 h-4" />
                            {count}
                          </span>
                        ) : null;
                      })}
                    </div>

                    {/* Progress & Actions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-muted-foreground">
                          {book.progress > 0 ? `${book.progress}%` : "Haven't started yet"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          style={{ width: `${book.progress}%` }}
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-primary hover:bg-primary/90 text-white"
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          Read
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 hover:bg-white/5"
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
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
            size="lg"
            variant="outline"
            className="border-white/20 hover:bg-white/5 px-8"
          >
            View All Books
            <BookOpen className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
