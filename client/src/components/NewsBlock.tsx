import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  avatarUrl?: string | null;
  createdAt: string;
  publishedAt: string | null;
}

const NewsBlock: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['common']);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await apiCall('/api/news', { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setNewsItems(data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching news:', err);
        setError(err.message || 'Failed to load news');
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

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
    <section className="py-20 bg-muted">
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
                  <CardTitle>{newsItem.title}</CardTitle>
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
                      <span>{new Date(newsItem.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{newsItem.content}</p>
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
      </div>
    </section>
  );
};

export default NewsBlock;