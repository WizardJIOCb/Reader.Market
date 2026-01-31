import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit3, 
  Plus,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'hidden' | 'deleted';
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author?: {
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
  category?: {
    title: string;
  };
}

interface ArticleCategory {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  sortOrder: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminArticlesPage() {
  const { t } = useTranslation(['articles', 'common']);
  const { toast } = useToast();
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Category management state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    slug: '',
    description: ''
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  
  // Category management functions
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };
  
  const handleCategoryNameChange = (title: string) => {
    setCategoryForm(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }));
  };
  
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryForm.title.trim() || !categoryForm.slug.trim()) {
      toast({
        title: "Error",
        description: "Name and slug are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingCategory(true);
      const token = localStorage.getItem('authToken');
      
      const requestData = {
        name: categoryForm.title,
        slug: categoryForm.slug,
        description: categoryForm.description || undefined,
        sortOrder: editingCategory?.sortOrder ?? 0  // Preserve existing sortOrder or default to 0
      };
      
      const method = editingCategory ? 'PUT' : 'POST';
      const url = editingCategory 
        ? `/api/admin/article-categories/${editingCategory.id}`
        : '/api/admin/article-categories';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save category');
      }

      await loadCategories(); // Reload categories
      
      toast({
        title: "Success",
        description: editingCategory 
          ? "Category updated successfully" 
          : "Category created successfully"
      });

      // Reset form
      setCategoryForm({ title: '', slug: '', description: '' });
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive"
      });
    } finally {
      setSavingCategory(false);
    }
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm(t('articles:admin.confirmDeleteCategory'))) {
      return;
    }

    try {
      setDeletingCategoryId(categoryId);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/admin/article-categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
      toast({
        title: "Success",
        description: "Category deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete category",
        variant: "destructive"
      });
    } finally {
      setDeletingCategoryId(null);
    }
  };
  
  // Update loadCategories to return data properly

  useEffect(() => {
    loadArticles();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/article-categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      
      const data = await response.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadArticles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/articles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load articles');
      }
      
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Error loading articles:', error);
      toast({
        title: "Error",
        description: "Failed to load articles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleArticleVisibility = async (articleId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'published' ? 'hidden' : 'published';
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/admin/articles/${articleId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, status: newStatus as any }
          : article
      ));

      toast({
        title: "Success",
        description: `Article ${newStatus === 'published' ? 'published' : 'hidden'}`
      });
    } catch (error) {
      console.error('Error updating article:', error);
      toast({
        title: "Error",
        description: "Failed to update article",
        variant: "destructive"
      });
    }
  };

  const deleteArticle = async (articleId: string) => {
    if (!window.confirm(t('articles:admin.confirmDelete'))) {
      return;
    }

    try {
      setDeletingId(articleId);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/admin/articles/${articleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      setArticles(prev => prev.filter(article => article.id !== articleId));
      
      toast({
        title: "Success",
        description: "Article deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      published: 'default',
      hidden: 'destructive',
      deleted: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {t(`articles:admin.${status}`)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('articles:admin.title')}</h1>
        <p className="text-muted-foreground">Manage articles and categories</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Articles Management */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('articles:admin.manageArticles')}</h2>
            <Button asChild>
              <Link href="/articles/create">
                <Plus className="w-4 h-4 mr-2" />
                {t('articles:createArticle')}
              </Link>
            </Button>
          </div>

          <div className="space-y-4">
            {articles.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('articles:noArticles')}</p>
                </CardContent>
              </Card>
            ) : (
              articles.map((article) => (
                <Card key={article.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{article.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                          <span>by {article.author?.username || 'Unknown Author'}</span>
                          {article.category && (
                            <span>• {article.category.title}</span>
                          )}
                          <span>• {article.viewCount} views</span>
                        </div>
                        <div className="mt-2">
                          {getStatusBadge(article.status)}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleArticleVisibility(article.id, article.status)}
                          disabled={deletingId === article.id}
                        >
                          {article.status === 'published' ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-1" />
                              {t('articles:admin.makeHidden')}
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              {t('articles:admin.makeVisible')}
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={`/articles/edit/${article.slug}`}>
                            <Edit3 className="w-4 h-4 mr-1" />
                            {t('articles:editArticle')}
                          </Link>
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteArticle(article.id)}
                          disabled={deletingId === article.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Integrated Categories Management */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('articles:admin.categories')}</h2>
            <Button variant="outline" onClick={() => setShowCategoryForm(!showCategoryForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {showCategoryForm ? t('common:cancel') : t('articles:admin.createCategory')}
            </Button>
          </div>

          {/* Category Creation Form */}
          {showCategoryForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{editingCategory ? t('articles:admin.editCategory') : t('articles:admin.createCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('articles:admin.categoryName')} *
                    </label>
                    <Input
                      value={categoryForm.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCategoryNameChange(e.target.value)}
                      placeholder="Enter category name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('articles:admin.categorySlug')}
                    </label>
                    <Input
                      value={categoryForm.slug}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="category-slug"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used in URLs. Lowercase letters, numbers, and hyphens only.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('articles:admin.categoryDescription')}
                    </label>
                    <Textarea
                      value={categoryForm.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter category description (optional)"
                      rows={3}
                    />
                  </div>
                  
                  <Button type="submit" disabled={savingCategory}>
                    {savingCategory ? t('common:saving') : (editingCategory ? t('common:update') : t('articles:admin.createCategory'))}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    {t('articles:admin.noCategoriesFound')}
                  </p>
                ) : (
                  categories.map((category) => (
                    <div key={category.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <h4 className="font-medium">{category.title}</h4>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{category.slug}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({
                              title: category.title,
                              slug: category.slug,
                              description: category.description || ''
                            });
                            setShowCategoryForm(true);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          disabled={deletingCategoryId === category.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}