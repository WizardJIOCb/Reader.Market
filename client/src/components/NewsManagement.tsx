import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, ChevronLeft, ChevronRight, Heart, Trash2 } from 'lucide-react';
import { apiCall, newsReactionsApi } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttachmentButton } from '@/components/AttachmentButton';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { fileUploadManager, type UploadedFile } from '@/lib/fileUploadManager';

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
  reactionCount?: number;
  imageUrls?: string[];
}

interface Reaction {
  id: string;
  userId: string;
  newsId: string;
  emoji: string;
  createdAt: string;
  userFullName?: string;
  userUsername?: string;
}

const NewsManagement: React.FC = () => {
  const { t } = useTranslation(['admin', 'common']);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('admin_news_page');
    return saved ? parseInt(saved) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalNews, setTotalNews] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('admin_news_limit');
    return saved ? parseInt(saved) : 20;
  });
  
  // Reactions dialog state
  const [reactionsDialogOpen, setReactionsDialogOpen] = useState(false);
  const [selectedNewsForReactions, setSelectedNewsForReactions] = useState<NewsItem | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [published, setPublished] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const isInitialMount = useRef(true);

  // Save pagination settings to localStorage
  useEffect(() => {
    localStorage.setItem('admin_news_page', currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('admin_news_limit', itemsPerPage.toString());
  }, [itemsPerPage]);

  useEffect(() => {
    fetchNews();
  }, [currentPage, itemsPerPage]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`/api/admin/news?page=${currentPage}&limit=${itemsPerPage}`);
      const data = await response.json();
      
      // Handle both paginated response format and array format
      const items = data.items || data;
      const total = data.total || items.length;
      const totalPages = data.totalPages || Math.ceil(total / itemsPerPage);
      
      setNewsItems(items);
      setTotalNews(total);
      setTotalPages(totalPages);
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
      // Upload image files first if any
      let uploadedImageUrls: string[] = [];
      
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const uploaded = await fileUploadManager.uploadFile(file, () => {});
            uploadedImageUrls.push(uploaded.url);
          } catch (error) {
            console.error('Failed to upload image:', error);
            throw error;
          }
        }
      }
      
      // Combine existing image URLs (from editing) with newly uploaded ones
      let allImageUrls: string[] = [];
      if (editingNews && imageUrls) {
        allImageUrls = [...imageUrls]; // Use current imageUrls which may have deletions
      }
      allImageUrls = [...allImageUrls, ...uploadedImageUrls]; // Add newly uploaded images
      
      // Prepare news data with all image URLs
      const newsData = {
        title,
        titleEn: titleEn || undefined,
        slug: slug || undefined,
        content,
        contentEn: contentEn || undefined,
        imageUrls: allImageUrls,
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
    // Clean up existing local preview images to prevent memory leaks
    // Only revoke blob URLs (local previews), not actual image URLs from the database
    const localPreviewUrls = previewImages.filter(url => url.startsWith('blob:'));
    localPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    
    setEditingNews(newsItem);
    setTitle(newsItem.title);
    setTitleEn(newsItem.titleEn || '');
    setSlug(newsItem.slug || '');
    setContent(newsItem.content);
    setContentEn(newsItem.contentEn || '');
    setImageUrls(newsItem.imageUrls || []);
    setPreviewImages(newsItem.imageUrls || []);
    setImageFiles([]); // Clear any new file selections when editing
    setPublished(newsItem.published);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin:news.deleteConfirm'))) {
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

  const handleShowReactions = async (newsItem: NewsItem) => {
    setSelectedNewsForReactions(newsItem);
    setReactionsDialogOpen(true);
    
    try {
      setReactionsLoading(true);
      const response = await newsReactionsApi.getNewsReactions(newsItem.id);
      const data = await response.json();
      setReactions(data);
    } catch (err) {
      console.error('Error fetching reactions:', err);
      setError('Failed to load reactions');
    } finally {
      setReactionsLoading(false);
    }
  };

  const handleDeleteReaction = async (reactionId: string) => {
    if (!window.confirm(t('admin:news.deleteReactionConfirm'))) {
      return;
    }
    
    try {
      await newsReactionsApi.deleteReaction(reactionId);
      
      // Remove the reaction from local state
      setReactions(prevReactions => prevReactions.filter(r => r.id !== reactionId));
      
      // Refresh news list to get updated reaction count
      fetchNews();
    } catch (err) {
      console.error('Error deleting reaction:', err);
      setError('Failed to delete reaction');
    }
  };

  const resetForm = () => {
    // Clean up local preview object URLs to prevent memory leaks
    // Only revoke blob URLs (local previews), not actual image URLs
    const localPreviewUrls = previewImages.filter(url => url.startsWith('blob:'));
    localPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    
    setTitle('');
    setTitleEn('');
    setSlug('');
    setContent('');
    setContentEn('');
    setImageFiles([]);
    setImageUrls([]);
    setPreviewImages([]);
    setPublished(false);
    setEditingNews(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            {t('admin:common.loading')}
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
        <h2 className="text-2xl font-bold">{t('admin:news.title')}</h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {totalNews} {totalNews === 1 ? t('admin:news.totalNews') : t('admin:news.totalNewsPlural')}
          </p>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => {
            setItemsPerPage(parseInt(value));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 {t('admin:activity.perPage')}</SelectItem>
              <SelectItem value="10">10 {t('admin:activity.perPage')}</SelectItem>
              <SelectItem value="20">20 {t('admin:activity.perPage')}</SelectItem>
              <SelectItem value="50">50 {t('admin:activity.perPage')}</SelectItem>
              <SelectItem value="100">100 {t('admin:activity.perPage')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? t('admin:common.cancel') : editingNews ? t('admin:news.cancelEdit') : t('admin:news.addNews')}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingNews ? t('admin:news.editNews') : t('admin:news.createNews')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateNews} className="space-y-4">
              <div>
                <Label htmlFor="title">{t('admin:news.titleRussian')}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder={t('admin:news.titleRussianPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="titleEn">{t('admin:news.titleEnglish')}</Label>
                <Input
                  id="titleEn"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder={t('admin:news.titleEnglishPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="slug">{t('admin:news.slug')}</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('admin:news.slugPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin:news.slugHelp')}
                </p>
              </div>
              <div>
                <Label htmlFor="content">{t('admin:news.contentRussian')}</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={6}
                  placeholder={t('admin:news.contentRussianPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="contentEn">{t('admin:news.contentEnglish')}</Label>
                <Textarea
                  id="contentEn"
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  rows={6}
                  placeholder={t('admin:news.contentEnglishPlaceholder')}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={published}
                  onCheckedChange={setPublished}
                />
                <Label htmlFor="published">{t('admin:news.published')}</Label>
              </div>
              
              {/* Image upload section */}
              <div className="space-y-2">
                <Label>{t('admin:news.images')}</Label>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <AttachmentButton
                      onFilesSelected={(files) => {
                        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                        if (imageFiles.length === 0) {
                          // Show a toast if no image files were selected
                          // In a real implementation, you might want to import useToast hook
                        } else {
                          // Store the files and create local previews
                          setImageFiles(prev => [...prev, ...imageFiles]);
                          
                          // Create local preview URLs
                          const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
                          setPreviewImages(prev => [...prev, ...newPreviews]);
                        }
                      }}
                      disabled={false}
                    />
                  </div>
                  
                  {/* Preview for existing images from the database */}
                  {imageUrls && imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {imageUrls.map((url, index) => (
                        <div key={`existing-${index}`} className="relative group">
                          <img 
                            src={url} 
                            alt={`${t('admin:news.images')} ${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Remove the image from the imageUrls array
                                const newImageUrls = imageUrls.filter((_, i) => i !== index);
                                setImageUrls(newImageUrls);
                                
                                // Also update previewImages to stay in sync
                                // Find the corresponding index in previewImages and remove it
                                // Existing images are at the beginning of previewImages
                                const newPreviewImages = previewImages.filter((_, i) => i !== index);
                                setPreviewImages(newPreviewImages);
                              }}
                              className="text-white hover:text-red-300 p-1 rounded-full hover:bg-red-600"
                              aria-label="Delete image"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Preview for newly selected files */}
                  {previewImages.length > 0 && (
                    <AttachmentPreview 
                      files={imageFiles}
                      onRemove={(index) => {
                        // Clean up the local URL object to prevent memory leaks
                        // Only revoke blob URLs (local previews), not actual image URLs
                        if (previewImages[index]?.startsWith('blob:')) {
                          URL.revokeObjectURL(previewImages[index]);
                        }
                        
                        const newFiles = imageFiles.filter((_, i) => i !== index);
                        const newPreviews = previewImages.filter((_, i) => i !== index);
                        setImageFiles(newFiles);
                        setPreviewImages(newPreviews);
                      }}
                    />
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button type="submit">
                  {editingNews ? t('admin:news.updateNews') : t('admin:news.createNews')}
                </Button>
                {editingNews && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t('admin:common.cancel')}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin:news.newsItems')}</CardTitle>
        </CardHeader>
        <CardContent>
          {newsItems.length > 0 ? (
            <>
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
                        <a 
                          href={`/news/${newsItem.slug || newsItem.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <h3 className="font-semibold text-lg">{newsItem.title}</h3>
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('admin:news.by')}{' '}
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
                            {newsItem.published ? t('admin:news.published') : t('admin:news.draft')}
                          </span>
                          {newsItem.reactionCount !== undefined && newsItem.reactionCount > 0 && (
                            <span className="text-xs px-2 py-1 ml-2 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {newsItem.reactionCount}
                            </span>
                          )}
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
                        onClick={() => handleShowReactions(newsItem)}
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        {t('admin:news.reactions')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(newsItem)}
                      >
                        {t('admin:activity.edit')}
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDelete(newsItem.id)}
                      >
                        {t('admin:activity.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t('admin:activity.showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('admin:activity.to')} {Math.min(currentPage * itemsPerPage, totalNews)} {t('admin:activity.of')} {totalNews}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('admin:activity.previous')}
                </Button>
                <div className="text-sm text-muted-foreground px-2">
                  {t('admin:activity.page')} {currentPage} {t('admin:activity.of')} {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('admin:activity.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              {t('admin:news.noNewsItems')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reactions Dialog */}
      <Dialog open={reactionsDialogOpen} onOpenChange={setReactionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin:news.reactionsFor')} {selectedNewsForReactions?.title}</DialogTitle>
            <DialogDescription>
              {t('admin:news.totalReactions')} {reactions.length}
            </DialogDescription>
          </DialogHeader>
          
          {reactionsLoading ? (
            <div className="text-center py-8">{t('admin:news.loadingReactions')}</div>
          ) : reactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin:news.noReactions')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouped by emoji */}
              {Object.entries(
                reactions.reduce((acc, reaction) => {
                  if (!acc[reaction.emoji]) {
                    acc[reaction.emoji] = [];
                  }
                  acc[reaction.emoji].push(reaction);
                  return acc;
                }, {} as Record<string, Reaction[]>)
              ).map(([emoji, emojiReactions]) => (
                <div key={emoji} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{emoji}</span>
                    <span className="font-semibold">{emojiReactions.length} {emojiReactions.length === 1 ? t('admin:news.reaction') : t('admin:news.reactionsPlural')}</span>
                  </div>
                  <div className="space-y-2">
                    {emojiReactions.map((reaction) => (
                      <div key={reaction.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback>
                              <User className="w-3 h-3" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {reaction.userFullName || 'Unknown User'}
                            </p>
                            {reaction.userUsername && (
                              <p className="text-xs text-muted-foreground">
                                @{reaction.userUsername}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(reaction.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReaction(reaction.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactionsDialogOpen(false)}>
              {t('admin:common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsManagement;