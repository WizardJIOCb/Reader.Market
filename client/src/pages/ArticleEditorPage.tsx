import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

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

interface ArticleFormData {
  title: string;
  contentJson: any;
  section: string;  // New enum field
  format: string;       // New enum field

  tags: string[];
  lang: string;
  coverImageUrl?: string;
  excerpt?: string;
}

export function ArticleEditorPage() {
  const { t } = useTranslation(['articles', 'common']);
  const [location] = useLocation();
  
  // Determine if we're in edit mode
  const isEditMode = location.startsWith('/articles/edit/');
  const articleSlug = isEditMode ? location.substring('/articles/edit/'.length) : null;
  
  // Store the article ID separately for updates
  const [articleId, setArticleId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ArticleFormData>({
    title: '',
    contentJson: null,
    section: '',
    format: '',

    tags: [],
    lang: 'ru'
  });
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; title: string; slug: string; parentId: string | null }>>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode); // Loading when editing
  const [error, setError] = useState<string | null>(null);
  
  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/article-categories');
        const data = await response.json();
        setCategories(data);
        
        // Build hierarchical category options
        const rootCategories: ArticleCategory[] = data.filter((cat: ArticleCategory) => !cat.parentId);
        const childCategories: ArticleCategory[] = data.filter((cat: ArticleCategory) => cat.parentId);
        
        // Build hierarchical category options
        const options: Array<{ id: string; title: string; slug: string; parentId: string | null }> = [];
        
        // Add root categories
        rootCategories.forEach((cat: ArticleCategory) => {
          options.push({
            id: cat.id,
            title: cat.title,
            slug: cat.slug,
            parentId: cat.parentId
          });
          
          // Add child categories with indentation
          const children = childCategories.filter((child: ArticleCategory) => child.parentId === cat.id);
          children.forEach((child: ArticleCategory) => {
            options.push({
              id: child.id,
              title: `└─ ${child.title}`, // Indented child category
              slug: child.slug,
              parentId: child.parentId
            });
          });
        });
        
        setCategoryOptions(options);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    };

    loadCategories();
  }, []);
  
  // Load existing article data when in edit mode
  useEffect(() => {
    if (isEditMode && articleSlug) {
      loadArticleData(articleSlug);
    }
  }, [isEditMode, articleSlug]);
  
  const loadArticleData = async (slug: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`/api/articles/${slug}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load article');
      }
      
      const article = await response.json();
      
      // Populate form with existing data
      setFormData({
        title: article.title,
        contentJson: article.contentJson,
        section: article.section || '',
        format: article.format || '',

        tags: article.tags || [],
        lang: article.lang || 'ru',
        coverImageUrl: article.coverImageUrl,
        excerpt: article.excerpt
      });
      
      // Store the article ID for updates
      setArticleId(article.id);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setIsLoading(false);
    }
  };
  

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError(t('articles:editor.titleRequired'));
      return;
    }
    
    if (!formData.contentJson) {
      setError(t('articles:editor.contentRequired'));
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `/api/articles/${articleId}` : '/api/articles';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          contentJson: formData.contentJson,
          section: formData.section || null,
          format: formData.format || null,

          tags: formData.tags,
          lang: formData.lang,
          coverImageUrl: formData.coverImageUrl,
          excerpt: formData.excerpt
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} article`);
      }
      
      const result = await response.json();
      // Redirect to the article using article ID in query parameter
      window.location.href = `/articles?article=${result.article.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {!isLoading && (
        <>
          <div className="mb-6">
            <Button variant="ghost" className="mb-4 pl-0" asChild>
              <Link href="/articles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common:back')}
              </Link>
            </Button>
            
            <h1 className="text-3xl font-bold">
              {isEditMode 
                ? t('articles:editor.editArticle') 
                : t('articles:editor.createArticle')}
            </h1>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('articles:editor.basicInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">{t('articles:editor.title')}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('articles:editor.titlePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="section">{t('articles:editor.section')}</Label>
                  <Select 
                    value={formData.section} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, section: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('articles:editor.selectSection')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-auto">
                      {categoryOptions.map(option => (
                        <SelectItem 
                          key={option.id} 
                          value={option.slug}
                        >
                          {option.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="format">{t('articles:editor.format')}</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, format: value }))}
                  >
                    <SelectTrigger id="format">
                      <SelectValue placeholder={t('articles:editor.selectFormat')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">{t('articles:editor.formats.announcement')}</SelectItem>
                      <SelectItem value="release">{t('articles:editor.formats.release')}</SelectItem>
                      <SelectItem value="translation">{t('articles:editor.formats.translation')}</SelectItem>
                      <SelectItem value="review">{t('articles:editor.formats.review')}</SelectItem>
                      <SelectItem value="list">{t('articles:editor.formats.list')}</SelectItem>
                      <SelectItem value="analysis">{t('articles:editor.formats.analysis')}</SelectItem>
                      <SelectItem value="event">{t('articles:editor.formats.event')}</SelectItem>
                      <SelectItem value="note">{t('articles:editor.formats.note')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="tags">{t('articles:editor.tags')}</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('articles:editor.tagsPlaceholder')}
                      className="flex-1"
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline">
                      {t('common:add')}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-secondary-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="lang">{t('articles:editor.language')}</Label>
                  <Select
                    value={formData.lang}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, lang: value }))}
                  >
                    <SelectTrigger id="lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Russian</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="excerpt">{t('articles:editor.excerpt')}</Label>
                  <Textarea
                    id="excerpt"
                    value={formData.excerpt || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                    placeholder={t('articles:editor.excerptPlaceholder')}
                  />
                </div>
                
                <div>
                  <Label htmlFor="coverImageUrl">{t('articles:editor.coverImage')}</Label>
                  <Input
                    id="coverImageUrl"
                    value={formData.coverImageUrl || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverImageUrl: e.target.value }))}
                    placeholder={t('articles:editor.coverImagePlaceholder')}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('articles:editor.content')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextEditor
                  content={formData.contentJson}
                  onChange={(content) => setFormData(prev => ({ ...prev, contentJson: content }))}
                  placeholder={t('articles:editor.contentPlaceholder')}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? t('common:updating') : t('common:creating')}
                  </>
                ) : (
                  isEditMode 
                    ? t('articles:editor.updateArticle')
                    : t('articles:editor.publish')
                )}
              </Button>
              <Button type="button" variant="outline" disabled={isSubmitting} asChild>
                <Link href="/articles">
                  {t('common:cancel')}
                </Link>
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}