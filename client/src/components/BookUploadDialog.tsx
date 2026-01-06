import { useState } from 'react';
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
import { booksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

interface BookUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookUploaded: () => void;
}

export function BookUploadDialog({ open, onOpenChange, onBookUploaded }: BookUploadDialogProps) {
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
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
      
      const fileName = selectedFile.name.toLowerCase();
      const isFB2File = fileName.endsWith('.fb2');
      
      if (!allowedTypes.includes(selectedFile.type) && !isFB2File) {
        setErrors((prev) => ({
          ...prev,
          bookFile: 'Unsupported file format. Supported: PDF, DOC, DOCX, EPUB, TXT, FB2',
        }));
        return;
      }
      
      // Validate file size (100MB max)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          bookFile: 'File size must be less than 100MB.',
        }));
        return;
      }
      
      setFile(selectedFile);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.bookFile;
        return newErrors;
      });
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setErrors((prev) => ({
          ...prev,
          coverImage: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
        }));
        return;
      }
      
      // Validate file size (5MB max)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          coverImage: 'File size must be less than 5MB.',
        }));
        return;
      }
      
      setCoverImage(selectedFile);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.coverImage;
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

    if (!file) {
      newErrors.bookFile = 'Book file is required';
    }

    if (formData.year) {
      const year = parseInt(formData.year);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1000 || year > currentYear) {
        newErrors.year = `Year must be between 1000 and ${currentYear}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setUploading(true);

    try {
      const requestData = new FormData();
      requestData.append('title', formData.title);
      requestData.append('author', formData.author);
      requestData.append('description', formData.description);
      requestData.append('genre', formData.genre);
      requestData.append('year', formData.year);
      if (formData.publishedAt) {
        requestData.append('publishedAt', formData.publishedAt);
      }
      if (file) {
        requestData.append('bookFile', file);
      }
      if (coverImage) {
        requestData.append('coverImage', coverImage);
      }

      const response = await booksApi.uploadBook(requestData);

      if (response.ok) {
        toast({
          title: 'Book uploaded',
          description: `"${formData.title}" has been successfully uploaded.`,
        });
        
        // Reset form
        setFormData({
          title: '',
          author: '',
          description: '',
          genre: '',
          year: new Date().getFullYear().toString(),
          publishedAt: '',
        });
        setFile(null);
        setCoverImage(null);
        setErrors({});
        
        onBookUploaded();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload book');
      }
    } catch (error) {
      console.error('Error uploading book:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload book',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Book</DialogTitle>
          <DialogDescription>
            Upload a new book to the library. All fields marked with * are required.
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
                disabled={uploading}
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
                disabled={uploading}
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
                disabled={uploading}
                placeholder="e.g., Fiction, Mystery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Publication Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                min="1000"
                max={new Date().getFullYear()}
                value={formData.year}
                onChange={handleChange}
                disabled={uploading}
                className={errors.year ? 'border-destructive' : ''}
              />
              {errors.year && (
                <p className="text-sm text-destructive">{errors.year}</p>
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
                disabled={uploading}
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
              disabled={uploading}
              rows={4}
              placeholder="Book description..."
            />
          </div>

          <div className="space-y-2">
            <Label>Cover Image (optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {coverImage ? coverImage.name : 'Upload cover image'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, GIF, WebP (max 5MB)
                  </p>
                </div>
              </div>
            </div>
            {errors.coverImage && (
              <p className="text-sm text-destructive">{errors.coverImage}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Book File <span className="text-destructive">*</span>
            </Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.epub,.txt,.fb2"
                onChange={handleFileChange}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {file ? file.name : 'Upload book file'}
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
