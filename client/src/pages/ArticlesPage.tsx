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

interface ArticleCategory {
  id: string;
  parentId: string | null;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

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
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [showTreeView, setShowTreeView] = useState(true);
  const [showOnlyWithNew, setShowOnlyWithNew] = useState(false);

  // Track pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);

  // State for category article counts
  const [categoryCounts, setCategoryCounts] = useState<Record<string, { count: number, newCount: number }>>({});

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

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/article-categories');
        const data = await response.json();
        setCategories(data);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    };

    loadCategories();
  }, []);

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

  // Function to fetch article counts for all categories
  useEffect(() => {
    const fetchCategoryCounts = async () => {
      try {
        const response = await fetch('/api/articles/stats-by-category');
        const data = await response.json();
        
        // Transform the data to match our expected format
        const countsMap: Record<string, { count: number, newCount: number }> = {};
        data.forEach((item: any) => {
          countsMap[item.section] = {
            count: item.count,
            newCount: item.newCount || 0
          };
        });
        
        setCategoryCounts(countsMap);
      } catch (error) {
        console.error('Error fetching category counts:', error);
        
        // Fallback: create a map with zeros for all categories
        const fallbackCounts: Record<string, { count: number, newCount: number }> = {};
        categories.forEach(cat => {
          fallbackCounts[cat.slug] = { count: 0, newCount: 0 };
        });
        setCategoryCounts(fallbackCounts);
      }
    };

    if (categories.length > 0) {
      fetchCategoryCounts();
    }
  }, [categories]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ru' ? ru : enUS;
    return format(date, 'MMM d, yyyy', { locale });
  };

  // Function to build category tree
  const buildCategoryTree = () => {
    const rootCategories = categories.filter(cat => !cat.parentId);
    const childCategories = categories.filter(cat => cat.parentId);
    
    return rootCategories.map(rootCat => ({
      ...rootCat,
      children: childCategories.filter(child => child.parentId === rootCat.id)
    }));
  };

  // Function to get article count for a category
  const getCategoryArticleCount = (slug: string) => {
    return categoryCounts[slug]?.count || 0;
  };

  // Function to check if a category has new articles
  const hasNewArticles = (slug: string) => {
    return (categoryCounts[slug]?.newCount || 0) > 0;
  };

  // Filter categories based on showOnlyWithNew flag
  const filteredCategories = showOnlyWithNew 
    ? buildCategoryTree().filter(cat => hasNewArticles(cat.slug) || 
        cat.children.some(child => hasNewArticles(child.slug)))
    : buildCategoryTree();

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
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href="/articles/read-later">
                <Bookmark className="mr-2 h-4 w-4" />
                {t('articles:readLater')}
              </Link>
            </Button>
          )}
          {user && (
            <Button size="sm" className="h-9" asChild>
              <Link href="/articles/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('articles:createArticle')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Toggle for Tree View */}
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTreeView(!showTreeView)}
          className="h-8 text-xs"
        >
          {showTreeView ? t('articles:treeView.listView') : t('articles:treeView.treeView')}
        </Button>
      </div>

      {/* Tree View or Categories Filter */}
      {showTreeView ? (
        <div className="mb-8 bg-[#fffaf7] p-4 rounded-lg border border-amber-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-amber-800">{t('articles:categories')}</h3>
            <div className="flex gap-2">
              <Button
                variant={showOnlyWithNew ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyWithNew(!showOnlyWithNew)}
                className="h-8 text-xs"
              >
                {t('articles:newOnly')}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <div key={category.id} className="space-y-1">
                {/* Main Category (H2 equivalent) */}
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 ${selectedCategory === category.slug ? 'bg-amber-200 font-medium' : ''}`}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === category.slug ? null : category.slug);
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <span className="font-medium truncate">{category.title}</span>
                    {hasNewArticles(category.slug) && (
                      <span className="ml-2 text-xs text-red-500">●</span>
                    )}
                  </div>
                  <div className="flex items-center ml-2">
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryArticleCount(category.slug)}
                    </Badge>
                  </div>
                </div>
                
                {/* Child Categories */}
                {category.children.length > 0 && (
                  <div className="ml-4 pl-4 border-l border-amber-300 space-y-1">
                    {category.children.map((subCategory) => (
                      <div 
                        key={subCategory.id}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 ${selectedCategory === subCategory.slug ? 'bg-amber-200 font-medium' : ''}`}
                        onClick={() => {
                          setSelectedCategory(selectedCategory === subCategory.slug ? null : subCategory.slug);
                          setCurrentPage(1);
                        }}
                      >
                        <div className="flex items-center min-w-0 flex-1">
                          <span className="text-muted-foreground text-sm mr-2">•</span>
                          <span className="truncate text-sm">{subCategory.title}</span>
                          {hasNewArticles(subCategory.slug) && (
                            <span className="ml-2 text-xs text-red-500">●</span>
                          )}
                        </div>
                        <div className="flex items-center ml-2">
                          <Badge variant="secondary" className="text-xs">
                            {getCategoryArticleCount(subCategory.slug)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
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
            {filteredCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.slug ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategory(selectedCategory === category.slug ? null : category.slug);
                  setCurrentPage(1);
                }}
              >
                {category.title}
              </Button>
            ))}
          </div>
        </div>
      )}

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
            <Button size="sm" className="h-9" asChild>
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
            <Button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              size="sm"
              className="h-9"
            >
              Previous
            </Button>
            
            <span className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              size="sm"
              className="h-9"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
