import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Calendar, 
  Eye, 
  Plus,
  Filter,
  Bookmark
} from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  author?: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  section: string | null;  // New enum field
  format: string | null;      // New enum field
  lang: string;
  tags: Array<{ id?: string; axis?: string; name: string; slug: string }>;
  views: number;
  commentsCount: number;
  createdAt: string;
  publishedAt: string | null;
  isReadLater?: boolean;
}

export function ArticlesPage() {
  const { t, i18n } = useTranslation(['articles', 'common']);
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Track pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);

  const toggleReadLater = async (articleId: string, currentStatus: boolean | undefined) => {
    try {
      const method = currentStatus ? 'DELETE' : 'POST';
      const response = await fetch(`/api/articles/${articleId}/read-later`, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      if (response.ok) {
        // Update the local state optimistically
        setArticles(prev => prev.map(article => 
          article.id === articleId ? { ...article, isReadLater: !currentStatus } : article
        ));
      }
    } catch (error) {
      console.error('Error toggling read later status:', error);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Load articles when page, search, or category changes
  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        // Build query parameters
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: "12",
        });
        if (searchQuery) params.set("search", searchQuery);
        if (selectedCategory) params.set("section", selectedCategory);

        const response = await fetch(`/api/articles?${params.toString()}`, {
          headers: user ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : undefined,
        });

        const data = await response.json();
        setArticles(data.articles || []);
        setTotalPages(data.totalPages || 1);
        setTotalArticles(data.total || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, [currentPage, searchQuery, selectedCategory, user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ru' ? ru : enUS;
    return format(date, 'MMM d, yyyy', { locale });
  };



  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader title={t('articles:title')} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <PageHeader title={t('articles:title')} />
      
      {/* Header with search, create button, and read later */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('articles:searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {loading ? ' ' : `${t('articles:found')}: ${totalArticles}`}
          </div>
        </div>
        
        <div className="flex gap-2">
          {user && (
            <Button variant="outline" asChild>
              <Link href="/articles/read-later">
                <Bookmark className="mr-2 h-4 w-4" />
                {t('articles:readLater')}
              </Link>
            </Button>
          )}
          {user && (
            <Button asChild>
              <Link href="/articles/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('articles:createArticle')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Categories filter */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {t('articles:categories')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            {t('articles:allCategories')}
          </Button>
          <Button
            variant={selectedCategory === 'news' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('news')}
          >
            {t('articles:editor.sections.news')}
          </Button>
          <Button
            variant={selectedCategory === 'reviews' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('reviews')}
          >
            {t('articles:editor.sections.reviews')}
          </Button>
          <Button
            variant={selectedCategory === 'collections' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('collections')}
          >
            {t('articles:editor.sections.collections')}
          </Button>
          <Button
            variant={selectedCategory === 'guides' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('guides')}
          >
            {t('articles:editor.sections.guides')}
          </Button>
          <Button
            variant={selectedCategory === 'world' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('world')}
          >
            {t('articles:editor.sections.world')}
          </Button>
          <Button
            variant={selectedCategory === 'community' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('community')}
          >
            {t('articles:editor.sections.community')}
          </Button>
          <Button
            variant={selectedCategory === 'product' ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory('product')}
          >
            {t('articles:editor.sections.product')}
          </Button>
        </div>
      </div>

      {/* Articles grid */}
      {articles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            {searchQuery || selectedCategory 
              ? t('articles:noArticlesFound') 
              : t('articles:noArticles')
            }
          </div>
          {!searchQuery && !selectedCategory && (
            <Button asChild>
              <Link href="/articles/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('articles:createFirstArticle')}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: Article) => {
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">
                    <Link 
                      href={`/articles/${article.slug}`} 
                      className="hover:text-primary transition-colors"
                    >
                      {article.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      {article.author?.avatarUrl ? (
                        <img 
                          src={article.author.avatarUrl} 
                          alt={article.author.username}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {(article.author?.username || article.author?.fullName || "Reader").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span>by {article.author?.fullName || article.author?.username || "Reader"}</span>
                    </div>
                    {article.publishedAt && (
                      <div className="flex items-center gap-2">
                        <span>•</span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(article.publishedAt)}</span>
                        </div>
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                      
                <CardContent>
                  {article.excerpt && (
                    <p className="text-muted-foreground mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>
                  )}
                        
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(() => {
                      const tags = article.tags ?? [];
                      return (
                        <>
                          {tags.slice(0, 3).map((tag) => {
                            return (
                              <Badge key={tag.slug} variant="secondary" className="text-xs">
                                {tag.name}
                              </Badge>
                            );
                          })}
                          {tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{tags.length - 3} more
                            </Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                        
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {article.section && (
                      <Badge variant="outline" className="text-xs">
                        {article.section ? t('articles:editor.sections.' + article.section) : article.section}
                      </Badge>
                    )}
                                      
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{article.views}</span>
                      </div>
                                        
                      {user && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            toggleReadLater(article.id, article.isReadLater);
                          }}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={article.isReadLater ? t('articles:removeFromReadLater') : t('articles:addToReadLater')}
                        >
                          <Bookmark 
                            className={`h-3 w-3 ${article.isReadLater ? 'fill-current text-primary' : ''}`} 
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}