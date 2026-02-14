import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Eye, 
  MessageCircle,
  Bookmark,
  Share,
  Edit,
  BookOpen,
  Reply,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { ArticleRenderer } from '@/components/editor/ArticleRenderer';
import { BookCard } from '@/components/BookCard';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentJson: any;
  section: string | null;  // New enum field
  format: string | null;      // New enum field

  lang: string;
  coverImageUrl: string | null;
  views: number;
  commentsCount: number;

  author: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  tags: Array<{ name: string; slug: string }>;
  attachedBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
  }>;

  createdAt: string;
  publishedAt: string | null;
  status: string;
}

export function ArticleDetailPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation(['articles', 'common']);
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  
  // For backward compatibility - get user from localStorage if needed
  const [legacyUser, setLegacyUser] = useState<{ id: string; username: string } | null>(null);
  const [legacyUserLoaded, setLegacyUserLoaded] = useState(false);

  useEffect(() => {
    // Get user from localStorage (temporary solution)
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setLegacyUser({ id: payload.userId, username: payload.username });
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
    setLegacyUserLoaded(true);

    const loadArticle = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/articles/${slug}`);
        
        if (response.ok) {
          const articleData = await response.json();
          
          // Handle both direct article response and { article } format for backward compatibility
          const article = articleData.article || articleData;
          
          // Normalize the article data to ensure consistent structure
          const normalized = {
            ...article,
            tags: article.tags ?? [],
            attachedBooks: article.attachedBooks ?? [],
            author: article.author ?? { id: "", username: "Reader", fullName: null, avatarUrl: null },
          };
          setArticle(normalized);
          setIsSaved(!!normalized.isReadLater);
          
          // Record view
          await fetch(`/api/articles/${article.id}/views`, { method: 'POST' });
        }
      } catch (error) {
        console.error('Error loading article:', error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      loadArticle();
    }
  }, [slug]);

  const toggleSaveArticle = async () => {
    if (!article || !legacyUser) return;
    
    try {
      const endpoint = `/api/articles/${article.id}/read-later`;
      const method = isSaved ? 'DELETE' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      if (response.ok) {
        setIsSaved(!isSaved);
      }
    } catch (error) {
      console.error('Error saving article:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ru' ? ru : enUS;
    return format(date, 'MMMM d, yyyy', { locale });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-3/4 mb-6" />
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">{t('articles:articleNotFound')}</h1>
          <p className="text-muted-foreground mb-6">{t('articles:articleNotFoundDesc')}</p>
          <Button asChild>
            <Link href="/articles">{t('articles:backToArticles')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Wait for auth to be ready before showing edit button
  const isAuthReady = !authLoading && legacyUserLoaded;
  
  const isOwner = isAuthReady && (
    legacyUser?.id === article?.author?.id || 
    authUser?.id === article?.author?.id ||
    legacyUser?.id === (article as any)?.authorUserId ||
    authUser?.id === (article as any)?.authorUserId
  );
  const isAdminOrModerator = isAuthReady && (
    authUser?.accessLevel === 'admin' || 
    authUser?.accessLevel === 'moderator'
  );
  const canEdit = isOwner || isAdminOrModerator;
  const isPublished = article.status === 'published';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" className="mb-6 pl-0" asChild>
          <Link href="/articles">
            ← {t('common:back')}
          </Link>
        </Button>



        {/* Article header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{article.title}</h1>
          
          {article.coverImageUrl && (
            <div className="mb-6">
              <img 
                src={article.coverImageUrl} 
                alt="" 
                className="w-full max-h-80 object-cover rounded-lg"
              />
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-4 mb-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              {article.author?.avatarUrl ? (
                <img 
                  src={article.author.avatarUrl} 
                  alt={article.author.username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {(article.author?.username || article.author?.fullName || "Reader").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span>by {article.author?.fullName || article.author?.username || "Reader"}</span>
            </div>
            
            {article.publishedAt && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
              </>
            )}
            
            <span>•</span>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{article.views} {t('common:views')}</span>
            </div>
          </div>

          {article.section && (
            <Badge className="mb-4">
              {t(`articles:editor.sections.${article.section}` as any) || article.section}
            </Badge>
          )}
          
          {article.format && (
            <Badge variant="secondary" className="mb-4 ml-2">
              {t(`articles:editor.formats.${article.format}` as any) || article.format}
            </Badge>
          )}
          


          {article.excerpt && (
            <p className="text-lg text-muted-foreground mb-6">
              {article.excerpt}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={toggleSaveArticle} variant="outline">
              <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? t('articles:saved') : t('articles:save')}
            </Button>
            
            <Button variant="outline">
              <Share className="mr-2 h-4 w-4" />
              {t('articles:share')}
            </Button>
            
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/articles/edit/${article.slug}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('common:edit')}
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* Article content */}
        <article className="prose prose-lg max-w-none mb-12">
          <ArticleRenderer content={article.contentJson} />
        </article>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold mb-3">{t('articles:tags')}</h3>
            <div className="flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <Badge key={tag.slug} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Attached books */}
        {article.attachedBooks.length > 0 && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t('articles:attachedBooks')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {article.attachedBooks.map(book => (
                <BookCard 
                  key={book.id}
                  book={{
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    coverImageUrl: book.coverImageUrl || undefined,
                    rating: undefined,
                    createdAt: new Date().toISOString(),
                    genre: 'Unknown',
                    description: '',
                    commentCount: 0,
                    reviewCount: 0,
                    shelfCount: 0,
                    cardViewCount: 0,
                    readerOpenCount: 0
                  }}
                />
              ))}
            </div>
          </div>
        )}



        {/* Comments section would go here */}
        <div id="comments">
          {/* Comments component will be integrated here */}
        </div>
      </div>
    </div>
  );
}