import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { apiCall } from '@/lib/api';

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
  published: boolean;
  createdAt: string;
  publishedAt: string | null;
}

const NewsManagement: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [published, setPublished] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchNews();
    }
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/admin/news');
      const data = await response.json();
      setNewsItems(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Failed to load news items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newsData = {
        title,
        titleEn: titleEn || undefined,
        slug: slug || undefined,
        content,
        contentEn: contentEn || undefined,
        published
      };
      
      if (editingNews) {
        // Update existing news
        await apiCall(`/api/admin/news/${editingNews.id}`, { 
          method: 'PUT',
          body: JSON.stringify(newsData)
        });
      } else {
        // Create new news
        await apiCall('/api/admin/news', { 
          method: 'POST', 
          body: JSON.stringify(newsData) 
        });
      }
      
      resetForm();
      fetchNews();
    } catch (err) {
      console.error('Error saving news:', err);
      setError('Failed to save news item');
    }
  };

  const handleEdit = (newsItem: NewsItem) => {
    setEditingNews(newsItem);
    setTitle(newsItem.title);
    setTitleEn(newsItem.titleEn || '');
    setSlug(newsItem.slug || '');
    setContent(newsItem.content);
    setContentEn(newsItem.contentEn || '');
    setPublished(newsItem.published);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this news item?')) {
      return;
    }
    
    try {
      await apiCall(`/api/admin/news/${id}`, { method: 'DELETE' });
      fetchNews();
    } catch (err) {
      console.error('Error deleting news:', err);
      setError('Failed to delete news item');
    }
  };

  const resetForm = () => {
    setTitle('');
    setTitleEn('');
    setSlug('');
    setContent('');
    setContentEn('');
    setPublished(false);
    setEditingNews(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            Loading news items...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-red-500">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">News Management</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : editingNews ? 'Cancel Edit' : 'Add News'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingNews ? 'Edit News' : 'Create News'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateNews} className="space-y-4">
              <div>
                <Label htmlFor="title">Title (Russian)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Заголовок на русском"
                />
              </div>
              <div>
                <Label htmlFor="titleEn">Title (English)</Label>
                <Input
                  id="titleEn"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Title in English (optional)"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (URL alias)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., reader-launch"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. Leave empty to use ID in URL. Use lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              <div>
                <Label htmlFor="content">Content (Russian)</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={6}
                  placeholder="Содержание на русском"
                />
              </div>
              <div>
                <Label htmlFor="contentEn">Content (English)</Label>
                <Textarea
                  id="contentEn"
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  rows={6}
                  placeholder="Content in English (optional)"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={published}
                  onCheckedChange={setPublished}
                />
                <Label htmlFor="published">Published</Label>
              </div>
              <div className="flex space-x-2">
                <Button type="submit">
                  {editingNews ? 'Update News' : 'Create News'}
                </Button>
                {editingNews && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>News Items</CardTitle>
        </CardHeader>
        <CardContent>
          {newsItems.length > 0 ? (
            <div className="space-y-4">
              {newsItems.map((newsItem) => (
                <div key={newsItem.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        {newsItem.avatarUrl ? (
                          <AvatarImage src={newsItem.avatarUrl} alt={newsItem.author} />
                        ) : null}
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{newsItem.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          By{' '}
                          <a 
                            href={`/profile/${newsItem.authorId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {newsItem.author}
                          </a>
                          {' '}• {new Date(newsItem.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${newsItem.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {newsItem.published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="mt-2 text-muted-foreground line-clamp-2">
                          {newsItem.content.substring(0, 150)}{newsItem.content.length > 150 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(newsItem)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDelete(newsItem.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No news items found. Create your first news item!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NewsManagement;