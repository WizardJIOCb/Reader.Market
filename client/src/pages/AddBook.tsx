import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchBar } from '@/components/SearchBar';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { dataCache } from '@/lib/dataCache';
import { booksApi } from '@/lib/api';
import { Upload, BookOpen, FileText } from 'lucide-react';

export default function AddBook() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(['books']);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    genre: '',
    year: new Date().getFullYear().toString(),
    publishedAt: '',
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: t('books:error'),
        description: t('books:selectBookFile'),
        variant: "destructive",
      });
      return;
    }
    
    // Validate file type by MIME type or file extension
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/epub+zip', // .epub
      'text/plain', // .txt
      'application/fb2', // .fb2
      'application/x-fictionbook+xml', // .fb2
      'text/xml', // .fb2
      'application/octet-stream' // Generic binary (might be FB2)
    ];
    
    // Also check file extension for FB2 files
    const fileName = file.name.toLowerCase();
    const isFB2File = fileName.endsWith('.fb2');
    
    if (!allowedTypes.includes(file.type) && !isFB2File) {
      toast({
        title: t('books:error'),
        description: t('books:unsupportedFormat') + '. ' + t('books:onlyTextFiles'),
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 100MB)
    const maxFileSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxFileSize) {
      toast({
        title: t('books:error'),
        description: t('books:fileTooLarge') + '. ' + t('books:maxFileSize'),
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Prepare form data
      const requestData = new FormData();
      requestData.append('title', formData.title);
      requestData.append('author', formData.author);
      requestData.append('description', formData.description);
      requestData.append('genre', formData.genre);
      requestData.append('year', formData.year);
      if (formData.publishedAt) {
        requestData.append('publishedAt', formData.publishedAt);
      }
      
      // Add file if selected
      if (file) {
        requestData.append('bookFile', file);
      }
      
      // Add cover image if selected
      if (coverImage) {
        requestData.append('coverImage', coverImage);
      }
      
      const response = await booksApi.uploadBook(requestData);
      
      if (!response.ok) {
        let errorMessage = 'Failed to upload book';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      toast({
        title: t('books:bookUploaded'),
        description: `"${formData.title}" ${t('books:bookAddedSuccess')}`,
      });
      
      // Clear the shelves cache to force a refresh when navigating to shelves
      dataCache.shelves = { data: null, timestamp: 0 };
      
      // Navigate back to shelves
      navigate('/shelves');
    } catch (error) {
      toast({
        title: t('books:error'),
        description: error instanceof Error ? error.message : "Произошла ошибка при загрузке книги",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t('books:loginRequired')}</p>
              <Link href="/login">
                <Button>{t('books:login')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search Bar at the top */}
        <div className="mb-8">
          <SearchBar />
        </div>
        
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle className="text-3xl font-serif">{t('books:addBookTitle')}</CardTitle>
            <CardDescription>
              {t('books:uploadBookInfo')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('books:bookTitle')} *</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder={t('books:bookTitlePlaceholder')}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="author">{t('books:author')} *</Label>
                  <Input
                    id="author"
                    name="author"
                    value={formData.author}
                    onChange={handleChange}
                    placeholder={t('books:authorPlaceholder')}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genre">{t('books:genre')}</Label>
                  <Input
                    id="genre"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    placeholder={t('books:genrePlaceholder')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="year">{t('books:publishYear')}</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    min="1000"
                    max={new Date().getFullYear()}
                    value={formData.year}
                    onChange={handleChange}
                    placeholder={t('books:publishYearPlaceholder')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="publishedAt">{t('books:publishedAt')}</Label>
                  <Input
                    id="publishedAt"
                    name="publishedAt"
                    type="date"
                    value={formData.publishedAt}
                    onChange={handleChange}
                    placeholder={t('books:publishedAtPlaceholder')}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">{t('books:description')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder={t('books:descriptionPlaceholder')}
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('books:coverImage')}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && e.target.files[0] && setCoverImage(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">
                        {coverImage ? coverImage.name : t('books:selectCoverPrompt')}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('books:supportedImageFormats')}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm">
                      {t('books:selectCover')}
                    </Button>
                  </div>
                </div>
                {coverImage && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('books:fileSelected')}: {coverImage.name} ({(coverImage.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>{t('books:bookFile')} *</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.epub,.txt,.fb2"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">
                        {file ? file.name : t('books:selectFilePrompt')}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('books:supportedFileFormats')}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm">
                      {t('books:selectFile')}
                    </Button>
                  </div>
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('books:fileSelected')}: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter className="px-0 flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/shelves')}
            >
              {t('books:cancel')}
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  {t('books:uploading')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('books:addBook')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}