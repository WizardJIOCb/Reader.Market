import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminBooksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { BookEditDialog } from '@/components/BookEditDialog';
import { BookUploadDialog } from '@/components/BookUploadDialog';
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const BooksManagement = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: (() => {
      const saved = localStorage.getItem('admin_books_limit');
      return saved ? parseInt(saved) : 20;
    })(),
    total: 0,
    pages: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Save pagination limit to localStorage
  useEffect(() => {
    localStorage.setItem('admin_books_limit', pagination.limit.toString());
  }, [pagination.limit]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch books when debounced search or pagination changes
  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminBooksApi.getAllBooks({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        sortBy: 'uploadedAt',
        sortOrder: 'desc',
      });

      if (response.ok) {
        const data = await response.json();
        setBooks(data.books);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch books');
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:books.failedToLoad'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, toast]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [debouncedSearch]);

  const handleEdit = (book: Book) => {
    setBookToEdit(book);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (book: Book) => {
    setBookToDelete(book);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookToDelete) return;

    try {
      const response = await adminBooksApi.deleteBook(bookToDelete.id);

      if (response.ok) {
        toast({
          title: t('admin:books.bookDeleted'),
          description: t('admin:books.bookDeletedMessage', { title: `"${bookToDelete.title}"` }),
        });
        setDeleteDialogOpen(false);
        setBookToDelete(null);
        fetchBooks();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || t('admin:books.failedToDelete'));
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      toast({
        title: t('admin:common.error'),
        description: error instanceof Error ? error.message : t('admin:books.failedToDelete'),
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return t('admin:common.na');
    return new Date(dateString).toLocaleDateString();
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('admin:books.title')}</h2>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('admin:books.addNewBook')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin:books.allBooks')}</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('admin:books.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select 
              value={pagination.limit.toString()} 
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, limit: parseInt(value), page: 1 }));
              }}
            >
              <SelectTrigger className="w-[140px]">
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
            {debouncedSearch && (
              <Button
                variant="outline"
                onClick={() => setSearch('')}
              >
                {t('admin:common.clear')}
              </Button>
            )}
          </div>
          {debouncedSearch && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('admin:books.searchResults')} "{debouncedSearch}"
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('admin:common.loading')}</div>
          ) : books.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearch ? t('admin:books.noBooksFound') : t('admin:books.noBooksAvailable')}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin:books.cover')}</TableHead>
                      <TableHead>{t('admin:books.titleHeader')}</TableHead>
                      <TableHead>{t('admin:books.author')}</TableHead>
                      <TableHead>{t('admin:books.genre')}</TableHead>
                      <TableHead>{t('admin:books.year')}</TableHead>
                      <TableHead>{t('admin:books.rating')}</TableHead>
                      <TableHead>{t('admin:books.uploader')}</TableHead>
                      <TableHead>{t('admin:books.fileSize')}</TableHead>
                      <TableHead>{t('admin:books.uploaded')}</TableHead>
                      <TableHead className="text-right">{t('admin:common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          {book.coverImageUrl ? (
                            <a
                              href={`/book/${book.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={book.coverImageUrl}
                                alt={book.title}
                                className="w-10 h-14 object-cover rounded"
                              />
                            </a>
                          ) : (
                            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xs">
                              {t('admin:books.noCover')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium w-48 min-w-[120px]">
                          <a
                            href={`/book/${book.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary cursor-pointer block line-clamp-2"
                          >
                            {book.title}
                          </a>
                        </TableCell>
                        <TableCell className="max-w-[120px]">
                          <span className="line-clamp-2">{book.author}</span>
                        </TableCell>
                        <TableCell>{book.genre || t('admin:common.na')}</TableCell>
                        <TableCell>{book.publishedYear || t('admin:common.na')}</TableCell>
                        <TableCell>
                          {book.rating ? (book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)) : t('admin:common.na')}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/profile/${book.userId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary cursor-pointer"
                          >
                            {book.uploaderFullName || book.uploaderUsername || 'Unknown'}
                          </a>
                        </TableCell>
                        <TableCell>{formatFileSize(book.fileSize)}</TableCell>
                        <TableCell>{formatDate(book.uploadedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(book)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(book)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {t('admin:activity.showing')} {(pagination.page - 1) * pagination.limit + 1} {t('admin:activity.to')}{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} {t('admin:activity.of')}{' '}
                  {pagination.total} {t('admin:books.books')}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('admin:activity.previous')}
                  </Button>
                  <div className="text-sm">
                    {t('admin:activity.page')} {pagination.page} {t('admin:activity.of')} {pagination.pages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    {t('admin:activity.next')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:books.deleteBook')}</DialogTitle>
            <DialogDescription>
              {t('admin:books.deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('admin:common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t('admin:books.deleteBook')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <BookEditDialog
        book={bookToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onBookUpdated={fetchBooks}
      />

      {/* Upload Dialog */}
      <BookUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onBookUploaded={fetchBooks}
      />
    </div>
  );
};

export default BooksManagement;
