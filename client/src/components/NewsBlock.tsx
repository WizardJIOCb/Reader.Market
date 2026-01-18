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
import { linkifyText } from '@/lib/linkify';

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
            newsItems.map((newsItem) => {
              const content = i18n.language === 'ru' ? newsItem.content : (newsItem.contentEn || newsItem.content);
              const title = i18n.language === 'ru' ? newsItem.title : (newsItem.titleEn || newsItem.title);
              
              // Extract first 2 sentences or ~200 characters as preview
              const getPreview = (text: string) => {
                const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
                if (sentences.length >= 2) {
                  return sentences.slice(0, 2).join(' ');
                }
                // Fallback: truncate to ~200 chars at word boundary
                if (text.length > 200) {
                  return text.substring(0, 200).split(' ').slice(0, -1).join(' ') + '...';
                }
                return text;
              };
              
              return (
                <a 
                  key={newsItem.id}
                  href={`/news/${newsItem.slug || newsItem.id}`}
                  className="block transition-transform hover:scale-[1.01]"
                >
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-[340px] md:h-[320px] flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-2" style={{ lineHeight: '21px' }}>
                        {title}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-2">
                        <Avatar className="w-8 h-8">
                          {newsItem.avatarUrl ? (
                            <AvatarImage src={newsItem.avatarUrl} alt={newsItem.author} />
                          ) : null}
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center flex-wrap gap-1">
                          <span>{t('common:by')}{' '}
                            <span className="text-primary">
                              {newsItem.author}
                            </span>
                          </span>
                          <span className="mx-1">•</span>
                          <span>{formatAbsoluteDate(newsItem.createdAt, dateLocale)}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between overflow-hidden pt-0">
                      <div className="mb-3">
                        <div className="text-muted-foreground line-clamp-4 md:line-clamp-5 whitespace-pre-line">
                          {getPreview(content)}
                        </div>
                        <div className="text-sm mt-2">
                          <span className="text-primary hover:underline font-medium">
                            {t('common:readMore')}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-4 items-center text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            👁️ {newsItem.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            ❤️ {newsItem.reactionCount}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          💬 {newsItem.commentCount} {t('common:comments')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })
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