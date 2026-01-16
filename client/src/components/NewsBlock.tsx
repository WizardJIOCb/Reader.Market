import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { formatAbsoluteDate } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { Link } from 'wouter';

interface NewsItem {
  id: string;
  title: string;
  titleEn?: string;
  content: string;
  contentEn?: string;
  slug?: string;
  author: string;
  authorId: string;
  avatarUrl?: string | null;
  createdAt: string;
  publishedAt: string | null;
  viewCount: number;
  commentCount: number;
  reactionCount: number;
}

interface NewsBlockProps {
  limit?: number;
  showViewAllButton?: boolean;
}

const NewsBlock: React.FC<NewsBlockProps> = ({ limit, showViewAllButton = false }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation(['common']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await apiCall('/api/news', { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        console.log('[NewsBlock] Fetched news:', data);
        console.log('[NewsBlock] Current i18n.language:', i18n.language);
        if (data.length > 0) {
          console.log('[NewsBlock] First news item:', {
            title: data[0].title,
            titleEn: data[0].titleEn,
            content: data[0].content?.substring(0, 50),
            contentEn: data[0].contentEn?.substring(0, 50)
          });
        }
        
        const newsToDisplay = limit ? data.slice(0, limit) : data;
        setNewsItems(newsToDisplay);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching news:', err);
        setError(err.message || 'Failed to load news');
        setLoading(false);
      }
    };

    fetchNews();
  }, [limit, i18n.language]);

  if (loading) {
    return (
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('common:latestNews')}</h2>
            <p className="text-xl text-muted-foreground">{t('common:stayUpdated')}</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                {t('common:loadingNews')}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('common:latestNews')}</h2>
            <p className="text-xl text-muted-foreground">{t('common:stayUpdated')}</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6 text-center text-red-500">
                {error}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="news" className="py-20 bg-muted">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('common:latestNews')}</h2>
          <p className="text-xl text-muted-foreground">{t('common:stayUpdated')}</p>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-6">
          {newsItems.length > 0 ? (
            newsItems.map((newsItem) => (
              <Card key={newsItem.id}>
                <CardHeader>
                  <CardTitle>
                    <a 
                      href={`/news/${newsItem.slug || newsItem.id}`}
                      className="text-primary hover:underline"
                    >
                      {i18n.language === 'ru' ? newsItem.title : (newsItem.titleEn || newsItem.title)}
                    </a>
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Avatar className="w-8 h-8">
                      {newsItem.avatarUrl ? (
                        <AvatarImage src={newsItem.avatarUrl} alt={newsItem.author} />
                      ) : null}
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center">
                      <span>{t('common:by')}{' '}
                        <a 
                          href={`/profile/${newsItem.authorId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {newsItem.author}
                        </a>
                      </span>
                      <span className="mx-2">•</span>
                      <span>{formatAbsoluteDate(newsItem.createdAt, dateLocale)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line mb-3">
                    {i18n.language === 'ru' ? newsItem.content : (newsItem.contentEn || newsItem.content)}
                  </p>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      👁️ {newsItem.viewCount} {t('common:views')}
                    </span>
                    <span className="flex items-center gap-1">
                      💬 {newsItem.commentCount} {t('common:comments')}
                    </span>
                    <span className="flex items-center gap-1">
                      ❤️ {newsItem.reactionCount} {t('common:reactions')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">{t('common:noNews')}</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {showViewAllButton && newsItems.length > 0 && (
          <div className="text-center mt-8">
            <Link href="/news">
              <Button size="lg" variant="outline">
                {t('common:viewAllNews')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default NewsBlock;