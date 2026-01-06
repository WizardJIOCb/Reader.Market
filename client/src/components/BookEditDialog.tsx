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
import { adminBooksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

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
          coverImage: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
        }));
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          coverImage: 'File size must be less than 5MB.',
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
          bookFile: 'Invalid file type. Supported formats: PDF, DOC, DOCX, EPUB, TXT, FB2',
        }));
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          bookFile: 'File size must be less than 100MB.',
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
      newErrors.title = 'Title is required';
    }

    if (!formData.author.trim()) {
      newErrors.author = 'Author is required';
    }

    if (formData.publishedYear) {
      const year = parseInt(formData.publishedYear);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1000 || year > currentYear) {
        newErrors.publishedYear = `Year must be between 1000 and ${currentYear}`;
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
          title: 'Book updated',
          description: `"${formData.title}" has been successfully updated.`,
        });
        onBookUpdated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update book');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update book',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Book</DialogTitle>
          <DialogDescription>
            Update book information and optionally replace the book file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
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
                Author <span className="text-destructive">*</span>
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
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={handleChange}
                disabled={saving}
                placeholder="e.g., Fiction, Mystery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publishedYear">Publication Year</Label>
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
              <Label htmlFor="publishedAt">Publication Date</Label>
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              disabled={saving}
              rows={4}
              placeholder="Book description..."
            />
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>
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
                        {coverImage ? coverImage.name : 'Upload new cover (optional)'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPEG, PNG, GIF, WebP (max 5MB)
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
            <Label>Book File</Label>
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
                    {bookFile ? bookFile.name : 'Replace book file (optional)'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX, EPUB, TXT, FB2 (max 100MB)
                  </p>
                </div>
              </div>
            </div>
            {errors.bookFile && (
              <p className="text-sm text-destructive">{errors.bookFile}</p>
            )}
            {bookFile && (
              <p className="text-sm text-muted-foreground">
                New file: {bookFile.name} ({(bookFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <h3 className="font-semibold text-sm">Current Book Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">File Type:</span> {book.fileType || 'N/A'}
              </div>
              <div>
                <span className="text-muted-foreground">File Size:</span>{' '}
                {(book.fileSize / (1024 * 1024)).toFixed(2)} MB
              </div>
              <div>
                <span className="text-muted-foreground">Uploaded By:</span>{' '}
                {book.uploaderFullName || book.uploaderUsername || 'Unknown'}
              </div>
              <div>
                <span className="text-muted-foreground">Uploaded:</span>{' '}
                {new Date(book.uploadedAt).toLocaleDateString()}
              </div>
              <div>
                <span className="text-muted-foreground">Rating:</span>{' '}
                {book.rating ? book.rating.toFixed(1) : 'N/A'}
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
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
