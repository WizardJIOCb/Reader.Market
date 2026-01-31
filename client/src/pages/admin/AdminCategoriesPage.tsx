import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Trash2, 
  Edit3, 
  Plus,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export function AdminCategoriesPage() {
  const { t } = useTranslation(['articles', 'common']);
  const { toast } = useToast();
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
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
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast({
        title: "Error",
        description: "Name and slug are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      const method = editingCategory ? 'PUT' : 'POST';
      const url = editingCategory 
        ? `/api/admin/article-categories/${editingCategory.id}`
        : '/api/admin/article-categories';

      const requestData = {
        name: formData.title,
        slug: formData.slug,
        description: formData.description || undefined,
        sortOrder: editingCategory?.sortOrder ?? 0  // Preserve existing sortOrder or default to 0
      };

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

      await loadCategories();
      
      toast({
        title: "Success",
        description: editingCategory 
          ? "Category updated successfully" 
          : "Category created successfully"
      });

      // Reset form
      setFormData({ title: '', slug: '', description: '' });
      setShowForm(false);
      setEditingCategory(null);
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: ArticleCategory) => {
    setEditingCategory(category);
    setFormData({
      title: category.title,
      slug: category.slug,
      description: category.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!window.confirm(t('articles:admin.confirmDeleteCategory'))) {
      return;
    }

    try {
      setDeletingId(categoryId);
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
      setDeletingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setFormData({ title: '', slug: '', description: '' });
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
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
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/admin/articles">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('articles:admin.backToArticles')}
          </Link>
        </Button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('articles:admin.manageCategoriesTitle')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('articles:admin.manageCategories')}
            </p>
          </div>
          
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('articles:admin.createCategory')}
            </Button>
          )}
        </div>
      </div>

      {/* Category Form */}
      {(showForm || editingCategory) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {editingCategory 
                ? t('articles:admin.editCategory') 
                : t('articles:admin.createCategory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">
                    {t('articles:admin.categoryName')} *
                  </label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter category name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="slug" className="block text-sm font-medium mb-2">
                    {t('articles:admin.categorySlug')}
                  </label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="category-slug"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used in URLs. Lowercase letters, numbers, and hyphens only.
                  </p>
                </div>
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  {t('articles:admin.categoryDescription')}
                </label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter category description (optional)"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? t('common:saving') : (editingCategory ? t('common:update') : t('articles:admin.createCategory'))}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  {t('common:cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('articles:admin.categories')}</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('articles:admin.noCategoriesFound')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('articles:admin.createFirstCategory')}
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('articles:admin.createCategory')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{category.title}</h3>
                      <Badge variant="secondary">{category.slug}</Badge>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      {t('common:edit')}
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                      disabled={deletingId === category.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}