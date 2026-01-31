import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Clock, Eye, Heart, MessageCircle, Bookmark, Trash2, Calendar } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  publishedAt: string | null;
  createdAt: string;
  author?: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  tags: Array<{ name: string; slug: string }>;
  isReadLater?: boolean;
}

export function ReadLaterPage() {
  const { t, i18n } = useTranslation(['articles', 'common']);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadArticles();
  }, [page]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/articles/read-later?page=${page}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load read later articles');
      }

      const data = await response.json();
      setArticles(prev => [...prev, ...data.articles]);
      setHasMore(data.articles.length === 20);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const removeFromReadLater = async (articleId: string) => {
    try {
      const response = await fetch(`/api/articles/${articleId}/read-later`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove from read later');
      }

      setArticles(prev => prev.filter(article => article.id !== articleId));
    } catch (err) {
      console.error('Error removing from read later:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading && articles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="h-24 w-16 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-4 pt-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('articles:readLater.error')}</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()}>
              {t('common:retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Bookmark className="h-8 w-8 text-blue-600" />
          {t('articles:readLater.title')}
        </h1>
        <p className="text-gray-600">
          {t('articles:readLater.subtitle')}
        </p>
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bookmark className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t('articles:readLater.empty.title')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('articles:readLater.empty.description')}
            </p>
            <Button asChild>
              <Link href="/articles">
                {t('articles:readLater.empty.browseArticles')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {articles.map((article) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {/* Article Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/articles/${article.slug}`} 
                          className="text-xl font-semibold hover:text-blue-600 transition-colors line-clamp-2"
                        >
                          {article.title}
                        </Link>
                        
                        {article.excerpt && (
                          <p className="text-gray-600 mt-2 line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
                          {article.section && (
                            <Badge variant="outline" className="text-xs">
                              {t(`articles:editor.sections.${article.section}` as any) || article.section}
                            </Badge>
                          )}
                                          
                          {article.format && (
                            <Badge variant="secondary" className="text-xs">
                              {t(`articles:editor.formats.${article.format}` as any) || article.format}
                            </Badge>
                          )}
                                          
                          {article.publishedAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(article.publishedAt)}
                            </div>
                          )}
                                          
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {article.views} {t('articles:viewCount', { count: article.views })}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromReadLater(article.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="text-sm text-gray-500">
                        {t('articles:addedToReadLater')} {formatDate(article.createdAt)}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/articles/${article.slug}`}>
                          {t('articles:readArticle')}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center mt-8">
              <Button 
                onClick={() => {
                  setPage(prev => prev + 1);
                  loadArticles();
                }}
                disabled={loading}
              >
                {loading ? t('common:loading') : t('articles:loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}