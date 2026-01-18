import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminBooksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';
import { TranslationManagement } from './TranslationManagement';
import { useTranslation } from 'react-i18next';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  genre: string;
  publishedYear: number;
  rating: number | null;
  userId: string;
  uploaderUsername: string;
  uploaderFullName: string;
  uploadedAt: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface BookEditDialogProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookUpdated: () => void;
}

export function BookEditDialog({ book, open, onOpenChange, onBookUpdated }: BookEditDialogProps) {
  const { t } = useTranslation('admin');
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    genre: '',
    publishedYear: '',
    publishedAt: '',
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || '',
        author: book.author || '',
        description: book.description || '',
        genre: book.genre || '',
        publishedYear: book.publishedYear?.toString() || '',
        publishedAt: book.publishedAt ? book.publishedAt.split('T')[0] : '',
      });
      setCoverImage(null);
      setBookFile(null);
      setErrors({});
    }
  }, [book]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          coverImage: t('books.invalidImageType'),
        }));
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          coverImage: t('books.imageSizeError'),
        }));
        return;
      }
      
      setCoverImage(file);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.coverImage;
        return newErrors;
      });
    }
  };

  const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/epub+zip',
        'text/plain',
        'application/fb2',
        'application/x-fictionbook+xml',
        'text/xml',
        'application/octet-stream'
      ];
      
      const fileName = file.name.toLowerCase();
      const isFB2File = fileName.endsWith('.fb2');
      
      if (!allowedTypes.includes(file.type) && !isFB2File) {
        setErrors((prev) => ({
          ...prev,
          bookFile: t('books.invalidBookType'),
        }));
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          bookFile: t('books.bookFileSizeError'),
        }));
        return;
      }
      
      setBookFile(file);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.bookFile;
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t('books.titleRequiredError');
    }

    if (!formData.author.trim()) {
      newErrors.author = t('books.authorRequiredError');
    }

    if (formData.publishedYear) {
      const year = parseInt(formData.publishedYear);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1000 || year > currentYear) {
        newErrors.publishedYear = t('books.yearRangeError', { currentYear });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!book || !validate()) {
      return;
    }

    setSaving(true);

    try {
      const requestData = new FormData();
      requestData.append('title', formData.title);
      requestData.append('author', formData.author);
      requestData.append('description', formData.description);
      requestData.append('genre', formData.genre);
      if (formData.publishedYear) {
        requestData.append('publishedYear', formData.publishedYear);
      }
      if (formData.publishedAt) {
        requestData.append('publishedAt', formData.publishedAt);
      }
      if (coverImage) {
        requestData.append('coverImage', coverImage);
      }
      if (bookFile) {
        requestData.append('bookFile', bookFile);
      }

      const response = await adminBooksApi.updateBook(book.id, requestData);

      if (response.ok) {
        toast({
          title: t('books.bookUpdated'),
          description: t('books.bookUpdatedMessage', { title: formData.title }),
        });
        onBookUpdated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || t('books.failedToUpdate'));
      }
    } catch (error) {
      console.error('Error updating book:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('books.failedToUpdate'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('books.editBook')}: {book.title}</DialogTitle>
          <DialogDescription>
            {t('books.updateBookInfo')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">{t('books.bookInfo')}</TabsTrigger>
            <TabsTrigger value="translations">{t('books.translationsTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    {t('books.titleRequired')}
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    disabled={saving}
                    className={errors.title ? 'border-destructive' : ''}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">
                    {t('books.authorRequired')}
                  </Label>
                  <Input
                    id="author"
                    name="author"
                    value={formData.author}
                    onChange={handleChange}
                    disabled={saving}
                    className={errors.author ? 'border-destructive' : ''}
                  />
                  {errors.author && (
                    <p className="text-sm text-destructive">{errors.author}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genre">{t('books.genreLabel')}</Label>
                  <Input
                    id="genre"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder={t('books.genrePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publishedYear">{t('books.publicationYear')}</Label>
                  <Input
                    id="publishedYear"
                    name="publishedYear"
                    type="number"
                    min="1000"
                    max={new Date().getFullYear()}
                    value={formData.publishedYear}
                    onChange={handleChange}
                    disabled={saving}
                    className={errors.publishedYear ? 'border-destructive' : ''}
                  />
                  {errors.publishedYear && (
                    <p className="text-sm text-destructive">{errors.publishedYear}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publishedAt">{t('books.publicationDate')}</Label>
                  <Input
                    id="publishedAt"
                    name="publishedAt"
                    type="date"
                    value={formData.publishedAt}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('books.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={saving}
                  rows={4}
                  placeholder={t('books.descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('books.coverImage')}</Label>
                <div className="flex items-center gap-4">
                  {book.coverImageUrl && (
                    <img
                      src={book.coverImageUrl}
                      alt="Current cover"
                      className="w-20 h-28 object-cover rounded border"
                    />
                  )}
                  <div className="flex-1">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImageChange}
                        disabled={saving}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {coverImage ? coverImage.name : t('books.uploadNewCover')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('books.imageFormats')}
                          </p>
                        </div>
                      </div>
                    </div>
                    {errors.coverImage && (
                      <p className="text-sm text-destructive mt-1">{errors.coverImage}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('books.bookFileLabel')}</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.epub,.txt,.fb2"
                    onChange={handleBookFileChange}
                    disabled={saving}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {bookFile ? bookFile.name : t('books.replaceBookFile')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('books.bookFormats')}
                      </p>
                    </div>
                  </div>
                </div>
                {errors.bookFile && (
                  <p className="text-sm text-destructive">{errors.bookFile}</p>
                )}
                {bookFile && (
                  <p className="text-sm text-muted-foreground">
                    {t('books.newFile')}: {bookFile.name} ({(bookFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <h3 className="font-semibold text-sm">{t('books.currentBookInfo')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('books.fileType')}:</span> {book.fileType || 'N/A'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('books.fileSizeLabel')}:</span>{' '}
                    {(book.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('books.uploadedBy')}:</span>{' '}
                    {book.uploaderFullName || book.uploaderUsername || 'Unknown'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('books.uploadedDate')}:</span>{' '}
                    {new Date(book.uploadedAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('books.ratingLabel')}:</span>{' '}
                    {book.rating ? (book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)) : 'N/A'}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? t('books.saving') : t('books.saveChanges')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="translations" className="mt-4">
            <TranslationManagement bookId={book.id} bookFileType={book.fileType} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
